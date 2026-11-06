import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { InvoicePilotRepository } from '../../src/server/db/repository.js';
import { createPayPalAdapter } from '../../src/server/paypal/adapter.js';
import { generateFallbackReminder } from '../../src/server/agent/geminiAgent.js';

describe('Stage 11 — Reminder Drafts, Client Tone & Observable Scheduling', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(options?: {
    providerMode?: 'sandbox' | 'mock';
  }): {
    app: ReturnType<typeof createApiApp>;
    repo: InvoicePilotRepository;
    db: DatabaseSync;
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage11-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage11.sqlite');
    const db = openAndMigrateDatabase(dbFilePath);
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);
    repo.resetAndSeedDemoTenant();

    const config = loadAppConfig({
      DATABASE_URL: dbFilePath,
      PAYPAL_MODE: options?.providerMode ?? 'mock'
    });
    const adapter = createPayPalAdapter({ mode: options?.providerMode ?? 'mock' });
    const app = createApiApp(config, adapter, repo);

    return { app, repo, db };
  }

  afterEach(() => {
    for (const db of openDbs.splice(0, openDbs.length)) {
      try {
        db.close();
      } catch {
        // Ignore
      }
    }
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  });

  it('determines client tone based on payment history and days overdue (polite, firm, final)', async () => {
    const { app, repo } = createTestSetup();

    // 1. Register a user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'tone-user@example.com',
        password: 'password123',
        displayName: 'Precision Advisory'
      });
    expect(regRes.status).toBe(201);
    const token = regRes.body.sessionToken;
    const userId = regRes.body.user.id;

    // 2. Create client
    const client = repo.createClient(userId, {
      fullName: 'Atlas Innovations',
      email: 'billing@atlas.example.com',
      defaultCurrency: 'USD'
    });

    // 3. Create upcoming/not overdue invoice -> expects 'polite' tone
    const futureDue = '2029-12-31';
    const invPolite = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-POLITE-001',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: futureDue,
      taxRateBps: 0,
      items: [{ description: 'Strategy session', quantity: 1, unitAmountMinor: 150000 }]
    });

    const draftRes1 = await request(app)
      .post(`/api/invoices/${invPolite.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(draftRes1.status).toBe(201);
    expect(draftRes1.body.tone).toBe('polite');
    expect(draftRes1.body.reminder.approvalState).toBe('DRAFTED');
    expect(draftRes1.body.reminder.subject).toContain('Courtesy Reminder');

    // 4. Create 10 days overdue invoice -> expects 'firm' tone
    const overdueDue = '2026-10-01'; // Overdue by ~1 month from 2026-11-01
    const invFirm = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-FIRM-002',
      currencyCode: 'USD',
      issueDate: '2026-09-15',
      dueDate: '2026-10-20', // ~12 days overdue
      taxRateBps: 0,
      items: [{ description: 'Software design', quantity: 1, unitAmountMinor: 250000 }]
    });

    const draftRes2 = await request(app)
      .post(`/api/invoices/${invFirm.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(draftRes2.status).toBe(201);
    expect(draftRes2.body.tone).toBe('firm');
    expect(draftRes2.body.reminder.subject).toContain('Overdue Notice');

    // 5. Create 45 days overdue invoice -> expects 'final' tone
    const invFinal = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-FINAL-003',
      currencyCode: 'USD',
      issueDate: '2026-08-01',
      dueDate: '2026-09-01', // 60+ days overdue
      taxRateBps: 0,
      items: [{ description: 'Enterprise Audit', quantity: 1, unitAmountMinor: 500000 }]
    });

    const draftRes3 = await request(app)
      .post(`/api/invoices/${invFinal.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(draftRes3.status).toBe(201);
    expect(draftRes3.body.tone).toBe('final');
    expect(draftRes3.body.reminder.subject).toContain('Final Notice');

    // 6. User override to polite is respected
    const draftRes4 = await request(app)
      .post(`/api/invoices/${invFinal.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tone: 'polite' });
    expect(draftRes4.status).toBe(201);
    expect(draftRes4.body.tone).toBe('polite');
  });

  it('rejects reminder drafting for PAID or CANCELLED invoices with validation error', async () => {
    const { app, repo, db } = createTestSetup();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'validation-user@example.com',
        password: 'password123',
        displayName: 'Validator Inc'
      });
    const token = regRes.body.sessionToken;
    const userId = regRes.body.user.id;

    const client = repo.createClient(userId, {
      fullName: 'Solomon Media',
      email: 'billing@solomon.example.com',
      defaultCurrency: 'USD'
    });

    // 1. Paid invoice
    const invPaid = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-PAID-001',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      taxRateBps: 0,
      items: [{ description: 'Paid Service', quantity: 1, unitAmountMinor: 10000 }]
    });
    repo.recordProviderInvoiceSync(userId, invPaid.id, {
      providerMode: 'mock',
      providerInvoiceId: 'INV2-MOCK-PAID',
      providerStatus: 'PAID'
    });

    const paidRes = await request(app)
      .post(`/api/invoices/${invPaid.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(paidRes.status).toBe(400);
    expect(paidRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(paidRes.body.error.message).toContain('already paid');

    // 2. Cancelled invoice
    const invCancelled = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-CANCEL-002',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      taxRateBps: 0,
      items: [{ description: 'Voided Service', quantity: 1, unitAmountMinor: 20000 }]
    });
    db.prepare(`UPDATE invoices SET local_status = 'CANCELLED' WHERE id = ?`).run(invCancelled.id);

    const cancelRes = await request(app)
      .post(`/api/invoices/${invCancelled.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(cancelRes.status).toBe(400);
    expect(cancelRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(cancelRes.body.error.message).toContain('cancelled');
  });

  it('generates deterministic fallback templates when AI is unavailable or offline', () => {
    const polite = generateFallbackReminder({
      clientName: 'Alice Springs',
      businessName: 'Vertex Studio',
      invoiceNumber: 'INV-1001',
      amountFormatted: '1,500.00 USD',
      dueDate: '2026-11-15',
      daysOverdue: 0,
      tone: 'polite'
    });
    expect(polite.subject).toContain('Courtesy Reminder: Invoice INV-1001 from Vertex Studio');
    expect(polite.body).toContain('Hi Alice Springs');
    expect(polite.body).toContain('1,500.00 USD is due on 2026-11-15');

    const firm = generateFallbackReminder({
      clientName: 'Bob Vance',
      businessName: 'Vance Refrigeration',
      invoiceNumber: 'INV-1002',
      amountFormatted: '2,200.00 USD',
      dueDate: '2026-10-15',
      daysOverdue: 17,
      tone: 'firm'
    });
    expect(firm.subject).toContain('Overdue Notice: Invoice INV-1002 (2,200.00 USD)');
    expect(firm.body).toContain('17 days overdue');

    const finalNotice = generateFallbackReminder({
      clientName: 'Carol Danvers',
      businessName: 'Star Navigation',
      invoiceNumber: 'INV-1003',
      amountFormatted: '9,000.00 USD',
      dueDate: '2026-09-01',
      daysOverdue: 61,
      tone: 'final'
    });
    expect(finalNotice.subject).toContain('Final Notice: Outstanding Invoice INV-1003 - Action Required');
    expect(finalNotice.body).toContain('Dear Carol Danvers');
    expect(finalNotice.body).toContain('61 days past due');
    expect(finalNotice.body).not.toMatch(/sue|jail|attorney|lawyer|penalty|arrest/i);
  });

  it('enforces the approval state machine (DRAFTED -> PENDING_APPROVAL -> APPROVED -> SENT), duplicate send prevention, and discard', async () => {
    const { app, repo } = createTestSetup();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'approval-workflow@example.com',
        password: 'password123',
        displayName: 'Workflow Pro LLC'
      });
    const token = regRes.body.sessionToken;
    const userId = regRes.body.user.id;

    const client = repo.createClient(userId, {
      fullName: 'Nexus Global',
      email: 'accounts@nexus.example.com',
      defaultCurrency: 'USD'
    });

    const invoice = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-FLOW-001',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-25',
      taxRateBps: 0,
      items: [{ description: 'Consulting sprint', quantity: 1, unitAmountMinor: 300000 }]
    });

    // 1. Create reminder draft -> DRAFTED
    const draftRes = await request(app)
      .post(`/api/invoices/${invoice.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tone: 'firm' });
    expect(draftRes.status).toBe(201);
    const reminderId = draftRes.body.reminder.id;
    expect(draftRes.body.reminder.approvalState).toBe('DRAFTED');

    // 2. Request approval -> PENDING_APPROVAL
    const reqAppRes = await request(app)
      .post(`/api/reminders/${reminderId}/request-approval`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(reqAppRes.status).toBe(200);
    expect(reqAppRes.body.reminder.approvalState).toBe('PENDING_APPROVAL');

    // 3. Approve -> APPROVED
    const appRes = await request(app)
      .post(`/api/reminders/${reminderId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(appRes.status).toBe(200);
    expect(appRes.body.reminder.approvalState).toBe('APPROVED');

    // 4. Send -> SENT
    const sendRes = await request(app)
      .post(`/api/reminders/${reminderId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.ok).toBe(true);
    expect(sendRes.body.reminder.approvalState).toBe('SENT');
    expect(sendRes.body.reminder.sentAt).toBeDefined();
    expect(sendRes.body.evidence).toBeDefined();

    // 5. Attempt duplicate send -> BLOCKED
    const dupSendRes = await request(app)
      .post(`/api/reminders/${reminderId}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(dupSendRes.status).toBe(400);
    expect(dupSendRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(dupSendRes.body.error.message).toContain('already been sent');

    // 6. Test discard/rejection blocks sending
    const invoice2 = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-FLOW-002',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-25',
      taxRateBps: 0,
      items: [{ description: 'Design Sprint', quantity: 1, unitAmountMinor: 150000 }]
    });

    const draft2Res = await request(app)
      .post(`/api/invoices/${invoice2.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({ tone: 'polite' });
    const reminder2Id = draft2Res.body.reminder.id;

    // Reject reminder
    const rejRes = await request(app)
      .post(`/api/reminders/${reminder2Id}/reject`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Client requested phone call instead' });
    expect(rejRes.status).toBe(200);
    expect(rejRes.body.reminder.approvalState).toBe('REJECTED');

    // Attempting send on rejected reminder must be blocked
    const sendRejRes = await request(app)
      .post(`/api/reminders/${reminder2Id}/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(sendRejRes.status).toBe(400);
    expect(sendRejRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(sendRejRes.body.error.message).toContain('Cannot send a rejected reminder');
  });

  it('supports observable scheduled reminders and automated processing via process-scheduled', async () => {
    const { app, repo, db } = createTestSetup();

    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'scheduler-test@example.com',
        password: 'password123',
        displayName: 'Automated Operations'
      });
    const token = regRes.body.sessionToken;
    const userId = regRes.body.user.id;

    const client = repo.createClient(userId, {
      fullName: 'Horizon Ventures',
      email: 'finance@horizon.example.com',
      defaultCurrency: 'USD'
    });

    const invoice = repo.createInvoiceDraft(userId, {
      clientId: client.id,
      invoiceNumber: 'INV-SCHED-001',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      taxRateBps: 0,
      items: [{ description: 'Tech Advisory', quantity: 1, unitAmountMinor: 400000 }]
    });

    // 1. Create reminder scheduled for a specific date/time (tomorrow)
    const futureMs = Date.now() + 86400000;
    const scheduledTarget = new Date(futureMs).toISOString();
    const draftRes = await request(app)
      .post(`/api/invoices/${invoice.id}/reminders/draft`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tone: 'firm',
        scheduledFor: scheduledTarget
      });
    expect(draftRes.status).toBe(201);
    const reminderId = draftRes.body.reminder.id;
    expect(draftRes.body.reminder.scheduledFor).toBe(scheduledTarget);

    // 2. Approve reminder -> transitions to SCHEDULED
    const appRes = await request(app)
      .post(`/api/reminders/${reminderId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(appRes.status).toBe(200);
    expect(appRes.body.reminder.approvalState).toBe('SCHEDULED');

    // 3. Process scheduled before the target time -> 0 processed
    const beforeRes = await request(app)
      .post('/api/reminders/process-scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentTimeIso: new Date(futureMs + 86400000).toISOString() });
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.results.length).toBe(0);

    // Reminder remains SCHEDULED
    const check1 = await request(app)
      .get(`/api/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(check1.body.reminder.approvalState).toBe('SCHEDULED');

    // Make the reminder due using the test database, not a client-supplied clock.
    const pastIso = new Date(Date.now() - 60000).toISOString();
    db.prepare('UPDATE reminders SET scheduled_for = ? WHERE id = ?').run(pastIso, reminderId);

    // 4. Process the now-due reminder -> 1 processed
    const dueRes = await request(app)
      .post('/api/reminders/process-scheduled')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentTimeIso: new Date(futureMs + 1000).toISOString() });
    expect(dueRes.status).toBe(200);
    expect(dueRes.body.results.length).toBe(1);
    expect(dueRes.body.results[0].id).toBe(reminderId);
    expect(dueRes.body.results[0].success).toBe(true);

    // 5. Verify reminder state in DB is now SENT
    const check2 = await request(app)
      .get(`/api/reminders/${reminderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(check2.body.reminder.approvalState).toBe('SENT');
    expect(check2.body.reminder.sentAt).toBeDefined();
    expect(check2.body.reminder.deliveryEvidence).toContain('SCHEDULED_DELIVERY_CONFIRMED');
  });

  it('enforces owner isolation across reminder endpoints', async () => {
    const { app, repo } = createTestSetup();

    // User A
    const userARes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'userA@example.com',
        password: 'password123',
        displayName: 'User A Corp'
      });
    const tokenA = userARes.body.sessionToken;
    const userAId = userARes.body.user.id;

    // User B
    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'userB@example.com',
        password: 'password123',
        displayName: 'User B Corp'
      });
    const tokenB = userBRes.body.sessionToken;
    const userBId = userBRes.body.user.id;

    const clientA = repo.createClient(userAId, {
      fullName: 'Client of User A',
      email: 'a@example.com',
      defaultCurrency: 'USD'
    });
    const invA = repo.createInvoiceDraft(userAId, {
      clientId: clientA.id,
      invoiceNumber: 'INV-USERA-01',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      taxRateBps: 0,
      items: [{ description: 'Work', quantity: 1, unitAmountMinor: 50000 }]
    });

    const reminderA = repo.createReminder(userAId, {
      invoiceId: invA.id,
      tone: 'polite',
      subject: 'Subject for A',
      body: 'Body for A'
    });

    // User B attempts to read User A's reminder -> 404
    const getRes = await request(app)
      .get(`/api/reminders/${reminderA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(getRes.status).toBe(404);

    // User B attempts to send User A's reminder -> 404
    const sendRes = await request(app)
      .post(`/api/reminders/${reminderA.id}/send`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(sendRes.status).toBe(404);

    // Create an overdue scheduled reminder owned by User B.
    const clientB = repo.createClient(userBId, {
      fullName: 'Client of User B',
      email: 'b@example.com',
      defaultCurrency: 'USD'
    });

    const invB = repo.createInvoiceDraft(userBId, {
      clientId: clientB.id,
      invoiceNumber: 'INV-USERB-SCHEDULED-01',
      currencyCode: 'USD',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      taxRateBps: 0,
      items: [{ description: 'Work', quantity: 1, unitAmountMinor: 60000 }]
    });

    const overdueTime = new Date(Date.now() - 60000).toISOString();
    const reminderBDraft = await request(app)
      .post(`/api/invoices/${invB.id}/reminders/draft`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        tone: 'polite',
        scheduledFor: overdueTime
      });

    expect(reminderBDraft.status).toBe(201);

    const reminderBId = reminderBDraft.body.reminder.id;
    const approveB = await request(app)
      .post(`/api/reminders/${reminderBId}/approve`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({});

    expect(approveB.status).toBe(200);
    expect(approveB.body.reminder.approvalState).toBe('APPROVED');

    // User A's scheduler must not process User B's overdue reminder.
    const processAsA = await request(app)
      .post('/api/reminders/process-scheduled')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(processAsA.status).toBe(200);
    expect(processAsA.body.results).toHaveLength(0);

    const reminderBCheck = await request(app)
      .get(`/api/reminders/${reminderBId}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(reminderBCheck.status).toBe(200);
    expect(reminderBCheck.body.reminder.approvalState).toBe('APPROVED');
    expect(reminderBCheck.body.reminder.sentAt).toBeUndefined();
  });
});
