import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import {
  DEMO_TENANT_USER_ID,
  InvoicePilotRepository
} from '../../src/server/db/repository.js';
import {
  MockPayPalAdapter,
  type CreateDraftAdapterInput,
  type OAuthVerifySnapshot,
  type PayPalAdapter,
  type PayPalAdapterResult,
  type ProviderInvoiceSnapshot,
  type SendInvoiceAdapterInput
} from '../../src/server/paypal/adapter.js';
import type { AppConfig } from '../../src/server/config.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore Windows file lock cleanup race
      }
    }
  }
});

function createTestEnv(customAdapter?: PayPalAdapter, webhookId = 'WH-STAGE08-TEST-ID') {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage08-'));
  tempDirs.push(tmpDir);
  const dbFilePath = path.join(tmpDir, 'stage08.sqlite');
  const db = openAndMigrateDatabase(dbFilePath);
  const repo = new InvoicePilotRepository(db);
  const seeded = repo.resetAndSeedDemoTenant();
  const seed = {
    ...seeded,
    invoiceId: seeded.invoices[0].id
  };
  const adapter = customAdapter ?? new MockPayPalAdapter();
  const config: AppConfig = {
    ...loadAppConfig({
      PAYPAL_MODE: adapter.mode,
      PAYPAL_WEBHOOK_ID: webhookId,
      DATABASE_URL: `file:${dbFilePath}`
    }),
    paypalMode: adapter.mode,
    paypalWebhookId: webhookId,
    databaseUrl: `file:${dbFilePath}`
  };
  const app = createApiApp(config, adapter, repo);
  const { rawToken } = repo.createSession(DEMO_TENANT_USER_ID);
  const req = request.agent(app);
  req.set('Authorization', `Bearer ${rawToken}`);
  return { db, repo, seed, adapter, app, req };
}

describe('Stage 08 — End-to-End PayPal Invoice Send, Status Refresh, Timeout Reconciliation & Webhooks', () => {
  it('requires explicit approval, executes via /api/invoices/:id/paypal/send, persists provider ID/links, and refreshes status to PAID', async () => {
    const mockAdapter = new MockPayPalAdapter();
    const { app, req, seed, db } = createTestEnv(mockAdapter);
    try {
      const invoiceId = seed.invoiceId;

      // 1. Attempting to send before approval is rejected with 400 VALIDATION_ERROR
      const unapprovedSendRes = await req
        .post(`/api/invoices/${invoiceId}/paypal/send`)
        .send({});
      expect(unapprovedSendRes.status).toBe(400);
      expect(unapprovedSendRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(unapprovedSendRes.body.error.message).toMatch(/Explicit human approval/i);

      // 2. Request approval slip (PENDING_APPROVAL) -> still cannot send before approve
      const slipRes = await req
        .post(`/api/invoices/${invoiceId}/approval-request`)
        .send({ invoiceId });
      expect(slipRes.status).toBe(201);
      const actionId = slipRes.body.action.id as string;

      const pendingSendRes = await req
        .post(`/api/invoices/${invoiceId}/paypal/send`)
        .send({ actionId });
      expect(pendingSendRes.status).toBe(400);
      expect(pendingSendRes.body.error.code).toBe('VALIDATION_ERROR');

      // 3. Approve slip -> execute via /api/invoices/:id/paypal/send
      const approveRes = await req
        .post(`/api/actions/${actionId}/approve`)
        .send({});
      expect(approveRes.status).toBe(200);
      expect(approveRes.body.action.state).toBe('APPROVED');

      const sendRes = await req
        .post(`/api/invoices/${invoiceId}/paypal/send`)
        .send({ actionId });
      expect(sendRes.status).toBe(200);
      expect(sendRes.body.action.state).toBe('EXECUTED');
      expect(sendRes.body.invoice.localStatus).toBe('SENT');
      expect(sendRes.body.invoice.providerStatus).toBe('SENT');
      expect(sendRes.body.invoice.providerInvoiceId).toBe('MOCK-LOCAL-0001');
      expect(sendRes.body.invoice.providerRecipientViewUrl).toContain('MOCK-LOCAL-0001');
      expect(sendRes.body.invoice.lastProviderSyncAt).toBeTruthy();

      // 4. Simulate buyer payment on provider and call /api/invoices/:id/paypal/refresh
      mockAdapter.setSimulatedStatus('MOCK-LOCAL-0001', 'PAID');

      const refreshRes = await req
        .post(`/api/invoices/${invoiceId}/paypal/refresh`)
        .send({});
      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.invoice.providerStatus).toBe('PAID');
      expect(refreshRes.body.invoice.localStatus).toBe('SENT');
      expect(refreshRes.body.providerSnapshot.providerStatus).toBe('PAID');

      // 5. Verify Activity log records both execution and status refresh
      const activityRes = await req.get('/api/activity');
      expect(activityRes.status).toBe(200);
      const actionsLogged = (activityRes.body.activities as Array<{ action: string }>).map(
        (a) => a.action
      );
      expect(actionsLogged).toContain('ACTION_EXECUTED');
      expect(actionsLogged).toContain('INVOICE_PROVIDER_STATUS_REFRESHED');
    } finally {
      db.close();
    }
  });

  it('rejects status refresh on an unsent local draft without providerInvoiceId and blocks duplicate execution', async () => {
    const { app, req, seed, db } = createTestEnv();
    try {
      const invoiceId = seed.invoiceId;

      // Cannot refresh status before invoice exists on provider
      const refreshBeforeSend = await req
        .post(`/api/invoices/${invoiceId}/paypal/refresh`)
        .send({});
      expect(refreshBeforeSend.status).toBe(400);
      expect(refreshBeforeSend.body.error.code).toBe('VALIDATION_ERROR');

      // Prepare, approve, and execute
      const slipRes = await req
        .post(`/api/invoices/${invoiceId}/approval-request`)
        .send({ invoiceId });
      const actionId = slipRes.body.action.id as string;

      await req.post(`/api/actions/${actionId}/approve`).send({});
      const exec1 = await req.post(`/api/actions/${actionId}/execute`).send({});
      expect(exec1.status).toBe(200);

      // Duplicate execution is rejected with 409 DUPLICATE_EVENT
      const exec2 = await req.post(`/api/actions/${actionId}/execute`).send({});
      expect(exec2.status).toBe(409);
      expect(exec2.body.error.code).toBe('DUPLICATE_EVENT');
    } finally {
      db.close();
    }
  });

  it('handles provider error on send cleanly, marking action FAILED and logging in Activity', async () => {
    const failingAdapter: PayPalAdapter = {
      mode: 'sandbox',
      isMock: false,
      modeLabel: 'PayPal Sandbox Mode (Live Sandbox API — No Real Money)',
      async verifyOAuthToken(): Promise<PayPalAdapterResult<OAuthVerifySnapshot>> {
        throw new Error('Not used');
      },
      async createDraftInvoice(
        input: CreateDraftAdapterInput
      ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        return {
          ok: true,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          data: {
            providerInvoiceId: 'INV2-FAIL-SEND-0001',
            providerStatus: 'DRAFT',
            invoiceNumber: input.invoiceNumber,
            currencyCode: input.currencyCode,
            totalValue: '1890.00'
          }
        };
      },
      async sendInvoice(): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'UNPROCESSABLE_ENTITY: Sandbox simulated provider error during send.',
            retryableAfterReconcile: false,
            reconcileRequired: false,
            httpStatus: 422
          }
        };
      },
      async retrieveInvoice(
        providerInvoiceId: string
      ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        return {
          ok: true,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          data: {
            providerInvoiceId,
            providerStatus: 'DRAFT',
            currencyCode: 'USD',
            totalValue: '1890.00'
          }
        };
      }
    };

    const { app, req, seed, db } = createTestEnv(failingAdapter);
    try {
      const slipRes = await req
        .post(`/api/invoices/${seed.invoiceId}/approval-request`)
        .send({ invoiceId: seed.invoiceId });
      const actionId = slipRes.body.action.id as string;
      await req.post(`/api/actions/${actionId}/approve`).send({});

      const execRes = await req.post(`/api/actions/${actionId}/execute`).send({});
      expect(execRes.status).toBe(502);
      expect(execRes.body.error.code).toBe('PROVIDER_ERROR');
      expect(execRes.body.action.state).toBe('FAILED');
      expect(execRes.body.invoice.providerInvoiceId).toBe('INV2-FAIL-SEND-0001');
      expect(execRes.body.invoice.providerStatus).toBe('DRAFT');
      expect(execRes.body.invoice.localStatus).not.toBe('SENT');
    } finally {
      db.close();
    }
  });

  it('reconciles ambiguous send timeouts against provider state without creating duplicate drafts or duplicate sends', async () => {
    let draftCalls = 0;
    let sendCalls = 0;
    let remoteStatus: 'DRAFT' | 'SENT' = 'DRAFT';

    const timeoutThenReconcileAdapter: PayPalAdapter = {
      mode: 'sandbox',
      isMock: false,
      modeLabel: 'PayPal Sandbox Mode (Live Sandbox API — No Real Money)',
      async verifyOAuthToken(): Promise<PayPalAdapterResult<OAuthVerifySnapshot>> {
        throw new Error('Not used');
      },
      async createDraftInvoice(
        input: CreateDraftAdapterInput
      ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        draftCalls += 1;
        return {
          ok: true,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          data: {
            providerInvoiceId: 'INV2-TIMEOUT-RECON-0001',
            providerStatus: 'DRAFT',
            invoiceNumber: input.invoiceNumber,
            currencyCode: input.currencyCode,
            totalValue: '1890.00'
          }
        };
      },
      async sendInvoice(
        _input: SendInvoiceAdapterInput
      ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        sendCalls += 1;
        if (sendCalls === 1) {
          // First send times out while provider remains DRAFT
          return {
            ok: false,
            mode: 'sandbox',
            isMock: false,
            modeLabel: this.modeLabel,
            error: {
              code: 'TIMEOUT_RECONCILE_REQUIRED',
              message: 'PayPal invoice send timed out. Reconcile before retrying.',
              retryableAfterReconcile: true,
              reconcileRequired: true
            }
          };
        }
        // Second send also times out on the wire, but the provider actually transitioned to SENT!
        remoteStatus = 'SENT';
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: {
            code: 'TIMEOUT_RECONCILE_REQUIRED',
            message: 'PayPal invoice send timed out after provider accepted send.',
            retryableAfterReconcile: true,
            reconcileRequired: true
          }
        };
      },
      async retrieveInvoice(
        providerInvoiceId: string
      ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
        return {
          ok: true,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          data: {
            providerInvoiceId,
            providerStatus: remoteStatus,
            currencyCode: 'USD',
            totalValue: '1890.00',
            recipientViewUrl: `https://www.sandbox.paypal.com/invoice/p/#${providerInvoiceId}`
          }
        };
      }
    };

    const { app, req, seed, db } = createTestEnv(timeoutThenReconcileAdapter);
    try {
      // Attempt 1: send times out while remote status is still DRAFT -> 504 TIMEOUT_RECONCILE_REQUIRED
      const slip1 = await req
        .post(`/api/invoices/${seed.invoiceId}/approval-request`)
        .send({ invoiceId: seed.invoiceId });
      const action1Id = slip1.body.action.id as string;
      await req.post(`/api/actions/${action1Id}/approve`).send({});

      const exec1 = await req.post(`/api/actions/${action1Id}/execute`).send({});
      expect(exec1.status).toBe(504);
      expect(exec1.body.error.code).toBe('TIMEOUT_RECONCILE_REQUIRED');
      expect(exec1.body.error.reconcileRequired).toBe(true);
      expect(exec1.body.invoice.providerInvoiceId).toBe('INV2-TIMEOUT-RECON-0001');
      expect(draftCalls).toBe(1);
      expect(sendCalls).toBe(1);

      // Attempt 2: user requests a fresh approval slip and executes -> reuses existing providerInvoiceId
      // (draftCalls stays 1!) and auto-reconciles the post-send timeout because retrieveInvoice returns SENT!
      const slip2 = await req
        .post(`/api/invoices/${seed.invoiceId}/approval-request`)
        .send({ invoiceId: seed.invoiceId });
      expect(slip2.status).toBe(201);
      const action2Id = slip2.body.action.id as string;
      await req.post(`/api/actions/${action2Id}/approve`).send({});

      const exec2 = await req.post(`/api/actions/${action2Id}/execute`).send({});
      expect(exec2.status).toBe(200);
      expect(exec2.body.action.state).toBe('EXECUTED');
      expect(exec2.body.invoice.localStatus).toBe('SENT');
      expect(exec2.body.invoice.providerStatus).toBe('SENT');
      expect(exec2.body.providerResult.reconciledAfterTimeout).toBe(true);
      expect(draftCalls).toBe(1); // Never created a duplicate draft!
      expect(sendCalls).toBe(2);

      const activityRes = await req.get('/api/activity');
      const actionsLogged = (activityRes.body.activities as Array<{ action: string }>).map(
        (a) => a.action
      );
      expect(actionsLogged).toContain('PROVIDER_TIMEOUT_RECONCILED');
    } finally {
      db.close();
    }
  });

  it('rejects unverified webhooks and idempotently processes signature-verified webhooks once', async () => {
    const mockAdapter = new MockPayPalAdapter();
    const { app, req, seed, repo, db } = createTestEnv(mockAdapter, 'WH-STAGE08-VERIFIED');
    try {
      // First send the invoice so it has providerInvoiceId = MOCK-LOCAL-0001
      const slipRes = await req
        .post(`/api/invoices/${seed.invoiceId}/approval-request`)
        .send({ invoiceId: seed.invoiceId });
      const actionId = slipRes.body.action.id as string;
      await req.post(`/api/actions/${actionId}/approve`).send({});
      await req.post(`/api/actions/${actionId}/execute`).send({});

      const webhookPayload = {
        id: 'WH-EVT-STAGE08-0001',
        event_type: 'INVOICING.INVOICE.PAID',
        resource: {
          invoice: {
            id: 'MOCK-LOCAL-0001',
            status: 'PAID'
          }
        }
      };

      // 1. Unverified webhook signature must be rejected with 400 and never update invoice status
      const unverifiedRes = await request(app)
        .post('/api/webhooks/paypal')
        .set('paypal-transmission-id', 'tx-001')
        .set('paypal-transmission-time', '2026-11-01T00:00:00Z')
        .set('paypal-transmission-sig', 'FORGED-INVALID-SIGNATURE')
        .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
        .set('paypal-auth-algo', 'SHA256withRSA')
        .send(webhookPayload);
      expect(unverifiedRes.status).toBe(400);
      expect(unverifiedRes.body.error.code).toBe('WEBHOOK_SIGNATURE_INVALID');

      const afterUnverified = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, seed.invoiceId);
      expect(afterUnverified.providerStatus).toBe('SENT');
      expect(afterUnverified.localStatus).toBe('SENT');

      // 2. Signature-verified webhook updates invoice status to PAID and logs WEBHOOK_EVENT_PROCESSED
      const verifiedRes = await request(app)
        .post('/api/webhooks/paypal')
        .set('paypal-transmission-id', 'tx-002')
        .set('paypal-transmission-time', '2026-11-01T00:01:00Z')
        .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
        .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
        .set('paypal-auth-algo', 'SHA256withRSA')
        .send(webhookPayload);
      expect(verifiedRes.status).toBe(200);
      expect(verifiedRes.body.received).toBe(true);
      expect(verifiedRes.body.deduplicated).toBe(false);
      expect(verifiedRes.body.updatedInvoiceId).toBe(seed.invoiceId);

      const afterVerified = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, seed.invoiceId);
      expect(afterVerified.providerStatus).toBe('PAID');
      expect(afterVerified.localStatus).toBe('SENT');

      // 3. Re-delivering the exact same webhook event ID is idempotently deduplicated
      const duplicateRes = await request(app)
        .post('/api/webhooks/paypal')
        .set('paypal-transmission-id', 'tx-002')
        .set('paypal-transmission-time', '2026-11-01T00:01:00Z')
        .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
        .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
        .set('paypal-auth-algo', 'SHA256withRSA')
        .send(webhookPayload);
      expect(duplicateRes.status).toBe(200);
      expect(duplicateRes.body.received).toBe(true);
      expect(duplicateRes.body.deduplicated).toBe(true);
    } finally {
      db.close();
    }
  });
});
