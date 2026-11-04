import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import {
  DEMO_TENANT_USER_ID,
  InvoicePilotRepository,
  OwnershipOrValidationError
} from '../../src/server/db/repository.js';
import { AsyncInvoicePilotRepository } from '../../src/server/db/asyncRepository.js';
import type { DatabaseSync } from 'node:sqlite';

describe('Stage 15 — Invoice Operational Completion Workflow', () => {
  let tempDir = '';
  let dbFile = '';
  let db: DatabaseSync | null = null;
  let repo: InvoicePilotRepository;
  let asyncRepo: AsyncInvoicePilotRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage15-'));
    dbFile = path.join(tempDir, 'stage15.sqlite');
    db = openAndMigrateDatabase(dbFile);
    repo = new InvoicePilotRepository(db!);
    asyncRepo = new AsyncInvoicePilotRepository(db! as any);
    repo.resetAndSeedDemoTenant();
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createAuthedAgent(appInstance: any, userId = DEMO_TENANT_USER_ID) {
    const { rawToken } = repo.createSession(userId);
    const agent = request.agent(appInstance);
    agent.set('Authorization', `Bearer ${rawToken}`);
    return agent;
  }

  it('marks an owned invoice as completed, records an audit log, and preserves unpaid status', async () => {
    const invoices = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    const target = invoices[0];
    expect(target).toBeDefined();
    expect(target.isCompleted).toBe(false);

    const completed = repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, target.id);
    expect(completed.isCompleted).toBe(true);
    expect(completed.completedAt).toBeDefined();
    expect(completed.localStatus).toBe(target.localStatus);
    expect(completed.providerStatus).toBe(target.providerStatus);

    // Verify audit event in activity log
    const activities = repo.listActivityForOwner(DEMO_TENANT_USER_ID);
    const completionEvent = activities.find(
      (a) => a.action === 'INVOICE_MARKED_COMPLETED' && a.entityId === target.id
    );
    expect(completionEvent).toBeDefined();
    expect(completionEvent?.actorType).toBe('user');
    expect(completionEvent?.result).toBe('EXECUTED');
    const parsedDetail = JSON.parse(completionEvent?.detailJson ?? '{}');
    expect(parsedDetail.isCompleted).toBe(true);
    expect(parsedDetail.invoiceNumber).toBe(target.invoiceNumber);
  });

  it('prevents duplicate completion of an already completed invoice', async () => {
    const invoices = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    const target = invoices[0];

    repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, target.id);

    // Second call should throw INVOICE_ALREADY_COMPLETED
    expect(() => repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, target.id)).toThrowError(
      OwnershipOrValidationError
    );
    try {
      repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, target.id);
    } catch (err: any) {
      expect(err.code).toBe('INVOICE_ALREADY_COMPLETED');
    }
  });

  it('rejects marking a cancelled invoice as completed', async () => {
    // Create a new invoice and cancel it
    const client = repo.listClientsForOwner(DEMO_TENANT_USER_ID)[0];
    const created = repo.createInvoiceDraft(DEMO_TENANT_USER_ID, {
      clientId: client.id,
      invoiceNumber: 'INV-TEST-CANCEL-01',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [
        {
          description: 'Consulting deliverable',
          quantity: 1,
          unitAmountMinor: 50000,
          currencyCode: 'USD'
        }
      ]
    });

    // Update to CANCELLED
    db!.prepare("UPDATE invoices SET local_status = 'CANCELLED' WHERE id = ?").run(created.id);

    expect(() => repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, created.id)).toThrowError(
      OwnershipOrValidationError
    );
    try {
      repo.markInvoiceCompleted(DEMO_TENANT_USER_ID, created.id);
    } catch (err: any) {
      expect(err.code).toBe('INVALID_STATE_TRANSITION');
    }
  });

  it('enforces strict owner isolation and prevents cross-owner completion (403)', async () => {
    // Register another user
    const otherUser = repo.createUser({
      email: 'other-freelancer@example.com',
      passwordHash: 'dummy_hash',
      displayName: 'Other Freelancer'
    });

    const invoices = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    const demoInvoice = invoices[0];

    // Attempting to complete demo invoice as other user must fail
    expect(() => repo.markInvoiceCompleted(otherUser.id, demoInvoice.id)).toThrowError(
      OwnershipOrValidationError
    );
    try {
      repo.markInvoiceCompleted(otherUser.id, demoInvoice.id);
    } catch (err: any) {
      expect(err.code).toBe('FORBIDDEN_OWNER_MISMATCH');
    }
  });

  it('supports mark completed via HTTP POST /api/invoices/:id/complete and alias', async () => {
    const app = createApiApp(loadAppConfig({ DATABASE_URL: dbFile }), undefined, repo);
    const req = createAuthedAgent(app);

    const invoices = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    const target = invoices[0];

    const res = await req.post(`/api/invoices/${target.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.invoice.isCompleted).toBe(true);
    expect(res.body.invoice.completedAt).toBeDefined();

    // Verify duplicate attempt returns 409 INVOICE_ALREADY_COMPLETED
    const dupRes = await req.post(`/api/invoices/${target.id}/complete`);
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('INVOICE_ALREADY_COMPLETED');
  });

  it('supports mark completed via async repository (PostgreSQL compatible path)', async () => {
    // Create a new invoice draft specifically for async repo test
    const client = repo.listClientsForOwner(DEMO_TENANT_USER_ID)[0];
    const created = await asyncRepo.createInvoiceDraft(DEMO_TENANT_USER_ID, {
      clientId: client.id,
      invoiceNumber: 'INV-ASYNC-COMP-01',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [
        {
          description: 'Async completion test deliverable',
          quantity: 1,
          unitAmountMinor: 10000,
          currencyCode: 'USD'
        }
      ]
    });

    const updated = await asyncRepo.markInvoiceCompleted(DEMO_TENANT_USER_ID, created.id);
    expect(updated.isCompleted).toBe(true);
    expect(updated.completedAt).toBeDefined();

    // Re-query from database
    const fresh = await asyncRepo.getInvoiceForOwner(DEMO_TENANT_USER_ID, created.id);
    expect(fresh.isCompleted).toBe(true);
  });
});
