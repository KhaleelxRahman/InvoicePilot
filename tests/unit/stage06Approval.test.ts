import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../../src/server/db/repository.js';
import type { PayPalAdapter } from '../../src/server/paypal/adapter.js';

describe('Stage 06 — Approval Slip and Safe Action State Machine', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(options?: {
    paypalAdapter?: PayPalAdapter;
    providerMode?: 'sandbox' | 'mock';
  }): {
    app: ReturnType<typeof createApiApp>;
    req: ReturnType<typeof request.agent>;
    repo: InvoicePilotRepository;
    ownerA: string;
    ownerB: string;
    invoiceIdA: string;
    clientIdA: string;
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage06-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage06.sqlite');
    const db = openAndMigrateDatabase(dbFilePath);
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);
    repo.resetAndSeedDemoTenant();

    const ownerBUser = repo.createUser({
      email: 'owner-b@example.com',
      displayName: 'Owner B Consultant',
      isDemo: false
    });
    repo.updateSettings(ownerBUser.id, {
      businessName: 'Owner B Advisory',
      defaultCurrency: 'USD',
      maxInvoiceAmountMinor: 5_000_000
    });

    const config = loadAppConfig({
      DATABASE_URL: dbFilePath,
      PAYPAL_MODE: options?.providerMode ?? 'mock'
    });
    const app = createApiApp(config, options?.paypalAdapter, repo);

    const { rawToken: ownerAToken } = repo.createSession(DEMO_TENANT_USER_ID);
    const req = request.agent(app);
    req.set('Authorization', `Bearer ${ownerAToken}`);

    const invoicesA = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    const clientsA = repo.listClientsForOwner(DEMO_TENANT_USER_ID);

    return {
      app,
      req,
      repo,
      ownerA: DEMO_TENANT_USER_ID,
      ownerB: ownerBUser.id,
      invoiceIdA: invoicesA[0].id,
      clientIdA: clientsA[0].id
    };
  }

  afterEach(() => {
    for (const db of openDbs.splice(0, openDbs.length)) {
      try {
        db.close();
      } catch {
        // Ignore already-closed handles
      }
    }
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('proposes an approval slip with client, line items, currency, total, due date, warnings, and consequences, then discards/rejects safely without executing', async () => {
    const { app, req, invoiceIdA } = createTestSetup({ providerMode: 'mock' });

    const slipRes = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes.status).toBe(201);
    expect(slipRes.body.action.state).toBe('PENDING_APPROVAL');
    expect(slipRes.body.action.actionType).toBe('SEND_INVOICE');

    const slip = slipRes.body.slip;
    expect(slip.invoiceId).toBe(invoiceIdA);
    expect(slip.clientFullName).toBe('Elena Vance');
    expect(slip.clientEmail).toBe('elena.vance@northstar-demo.example.com');
    expect(slip.currencyCode).toBe('USD');
    expect(slip.totalMinor).toBe(210000);
    expect(slip.dueDate).toBe('2026-11-08');
    expect(slip.items.length).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(slip.warnings)).toBe(true);
    expect(slip.warnings.length).toBeGreaterThan(0);
    expect(slip.whatWillHappen).toContain('Elena Vance');

    const actionId = slipRes.body.action.id as string;

    // Reject / discard the slip
    const rejectRes = await req
      .post(`/api/actions/${actionId}/reject`)
      .send({ reason: 'User discarded slip during review' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.action.state).toBe('REJECTED');
    expect(rejectRes.body.action.failureReason).toBe('User discarded slip during review');

    // Invoice returns to local DRAFT
    const invRes = await req.get(`/api/invoices/${invoiceIdA}`);
    expect(invRes.status).toBe(200);
    expect(invRes.body.invoice.localStatus).toBe('DRAFT');
    expect(invRes.body.invoice.providerInvoiceId).toBeUndefined();

    // Discarded / rejected action must never approve or execute
    const approveAfterReject = await req.post(`/api/actions/${actionId}/approve`).send({});
    expect(approveAfterReject.status).toBe(400);
    expect(approveAfterReject.body.error.code).toBe('VALIDATION_ERROR');

    const executeAfterReject = await req.post(`/api/actions/${actionId}/execute`).send({});
    expect(executeAfterReject.status).toBe(400);
    expect(executeAfterReject.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces approval before execution, executes via adapter, updates invoice state, and protects against duplicate approve/execute clicks', async () => {
    const { app, req, invoiceIdA } = createTestSetup({ providerMode: 'mock' });

    const slipRes = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes.status).toBe(201);
    const actionId = slipRes.body.action.id as string;

    // Cannot execute before human approval
    const prematureExec = await req.post(`/api/actions/${actionId}/execute`).send({});
    expect(prematureExec.status).toBe(400);
    expect(prematureExec.body.error.message).toContain('PENDING_APPROVAL');

    // Approve once
    const approveRes = await req.post(`/api/actions/${actionId}/approve`).send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.action.state).toBe('APPROVED');

    // Duplicate approve click returns 409 DUPLICATE_EVENT
    const duplicateApprove = await req.post(`/api/actions/${actionId}/approve`).send({});
    expect(duplicateApprove.status).toBe(409);
    expect(duplicateApprove.body.error.code).toBe('DUPLICATE_EVENT');

    // Execute approved action
    const execRes = await req.post(`/api/actions/${actionId}/execute`).send({});
    expect(execRes.status).toBe(200);
    expect(execRes.body.action.state).toBe('EXECUTED');
    expect(execRes.body.invoice.localStatus).toBe('SENT');
    expect(execRes.body.invoice.providerInvoiceId).toMatch(/^MOCK-LOCAL-/);
    expect(execRes.body.invoice.providerStatus).toBe('SENT');

    // Duplicate execute click returns 409 DUPLICATE_EVENT
    const duplicateExec = await req.post(`/api/actions/${actionId}/execute`).send({});
    expect(duplicateExec.status).toBe(409);
    expect(duplicateExec.body.error.code).toBe('DUPLICATE_EVENT');

    // Activity log contains all transitions
    const activityRes = await req.get('/api/activity');
    expect(activityRes.status).toBe(200);
    const actionsLogged = (activityRes.body.activities as Array<{ action: string }>).map(
      (a) => a.action
    );
    expect(actionsLogged).toContain('ACTION_PROPOSED_FOR_APPROVAL');
    expect(actionsLogged).toContain('ACTION_APPROVED');
    expect(actionsLogged).toContain('ACTION_EXECUTING');
    expect(actionsLogged).toContain('ACTION_EXECUTED');
  });

  it('detects stale approval slips when invoice payload changes or expiresAt elapses', async () => {
    const { app, req, repo, ownerA, invoiceIdA, clientIdA } = createTestSetup({ providerMode: 'mock' });

    // Case 1: Invoice draft edited after approval slip requested -> payloadHash mismatch
    const slipRes1 = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes1.status).toBe(201);
    const actionId1 = slipRes1.body.action.id as string;

    // Modify invoice draft amount
    const updateRes = await req
      .patch(`/api/invoices/${invoiceIdA}`)
      .send({
        clientId: clientIdA,
        invoiceNumber: 'INV-2026-1001',
        currencyCode: 'USD',
        issueDate: '2026-10-29',
        dueDate: '2026-11-12',
        taxRatePercent: '5',
        notes: 'Updated scope after slip creation',
        items: [
          {
            description: 'Updated Architecture Sprint',
            quantity: 1,
            unitPriceDecimal: '2100.00'
          }
        ]
      });
    expect(updateRes.status).toBe(200);

    // Approving stale slip fails with 400 and marks action EXPIRED
    const staleApprove = await req.post(`/api/actions/${actionId1}/approve`).send({});
    expect(staleApprove.status).toBe(400);
    expect(staleApprove.body.error.message).toContain('stale');

    const actionAfterStale = repo.getPendingActionForOwner(ownerA, actionId1);
    expect(actionAfterStale.state).toBe('EXPIRED');

    // Case 2: Expired timestamp (`expiresAt` in the past)
    const expiredAction = repo.requestInvoiceSendApproval(ownerA, invoiceIdA, {
      providerMode: 'mock',
      expiresAt: '2020-01-01T00:05:00.000Z'
    });
    const expiredApprove = await req
      .post(`/api/actions/${expiredAction.action.id}/approve`)
      .send({});
    expect(expiredApprove.status).toBe(400);
    expect(expiredApprove.body.error.message).toContain('expired');
    expect(repo.getPendingActionForOwner(ownerA, expiredAction.action.id).state).toBe('EXPIRED');
  });

  it('blocks over-limit invoice amounts at request, approval, and execution gates', async () => {
    const { app, req, repo, ownerA, invoiceIdA } = createTestSetup({ providerMode: 'mock' });

    // Request slip while under 5,000.00 USD limit
    const slipRes = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes.status).toBe(201);
    const actionId = slipRes.body.action.id as string;

    // Lower safety cap below invoice total ($2,835.00 = 283500 minor units -> cap at $1,000.00 = 100000)
    repo.updateSettings(ownerA, {
      businessName: 'Studio K Financial Consulting',
      defaultCurrency: 'USD',
      maxInvoiceAmountMinor: 100_000
    });

    // Approval gate blocks over-limit amount
    const overLimitApprove = await req.post(`/api/actions/${actionId}/approve`).send({});
    expect(overLimitApprove.status).toBe(400);
    expect(overLimitApprove.body.error.message).toContain('exceeds the configured safety limit');

    // Requesting a new slip while over limit is also blocked
    const overLimitRequest = await req
      .post(`/api/invoices/${invoiceIdA}/approval-request`)
      .send({});
    expect(overLimitRequest.status).toBe(400);
    expect(overLimitRequest.body.error.message).toContain('exceeds the configured safety limit');
  });

  it('clearly labels sending as unavailable (503 FAILED, not successful) when provider credentials are missing in current mode', async () => {
    const unavailableAdapter: PayPalAdapter = {
      mode: 'sandbox',
      isMock: false,
      modeLabel: 'PayPal Sandbox Mode (Default)',
      verifyOAuthToken: vi.fn(),
      createDraftInvoice: vi.fn().mockResolvedValue({
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: 'PayPal Sandbox Mode (Default)',
        error: {
          code: 'CREDENTIALS_MISSING',
          message: 'PayPal Sandbox credentials are missing in environment.',
          retryable: false
        }
      }),
      sendInvoice: vi.fn(),
      retrieveInvoice: vi.fn()
    };

    const { app, req, invoiceIdA } = createTestSetup({
      providerMode: 'sandbox',
      paypalAdapter: unavailableAdapter
    });

    const slipRes = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes.status).toBe(201);
    const actionId = slipRes.body.action.id as string;
    await req.post(`/api/actions/${actionId}/approve`).send({});

    const execRes = await req.post(`/api/actions/${actionId}/execute`).send({});
    expect(execRes.status).toBe(503);
    expect(execRes.body.error.message).toContain('unavailable in current mode');
    expect(execRes.body.action.state).toBe('FAILED');
  });

  it('rejects unauthorized and cross-owner action requests with 401 and 403', async () => {
    const { app, req, repo, ownerB, invoiceIdA } = createTestSetup({ providerMode: 'mock' });

    const slipRes = await req.post(`/api/invoices/${invoiceIdA}/approval-request`).send({});
    expect(slipRes.status).toBe(201);
    const actionId = slipRes.body.action.id as string;

    // Anonymous request -> 401
    const unauthRes = await request(app)
      .post(`/api/actions/${actionId}/approve`)
      .set('x-session-user-id', 'anonymous')
      .send({});
    expect(unauthRes.status).toBe(401);

    const { rawToken: ownerBToken } = repo.createSession(ownerB);

    // Owner B attempting to read, approve, reject, or execute Owner A's action -> 403
    const getCross = await request(app)
      .get(`/api/actions/${actionId}`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(getCross.status).toBe(403);
    expect(getCross.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

    const approveCross = await request(app)
      .post(`/api/actions/${actionId}/approve`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({});
    expect(approveCross.status).toBe(403);
    expect(approveCross.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

    const rejectCross = await request(app)
      .post(`/api/actions/${actionId}/reject`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({});
    expect(rejectCross.status).toBe(403);

    const execCross = await request(app)
      .post(`/api/actions/${actionId}/execute`)
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({});
    expect(execCross.status).toBe(403);
  });
});
