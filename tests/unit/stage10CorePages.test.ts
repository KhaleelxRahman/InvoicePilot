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

describe('Stage 10 — Core Product Pages Backend API & Data Integrity', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(options?: {
    providerMode?: 'sandbox' | 'mock';
  }): {
    app: ReturnType<typeof createApiApp>;
    repo: InvoicePilotRepository;
    db: DatabaseSync;
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage10-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage10.sqlite');
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

  it('retrieves and updates settings via GET and PATCH /api/settings', async () => {
    const { app } = createTestSetup();

    // 1. Register a user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'settings-user@example.com',
        password: 'password123',
        displayName: 'Acme Advisory LLC'
      });
    expect(regRes.status).toBe(201);
    const token = regRes.body.sessionToken;

    // 2. GET /api/settings
    const getRes = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.settings).toBeDefined();
    expect(getRes.body.settings.businessName).toBe('Acme Advisory LLC');
    expect(getRes.body.settings.defaultCurrency).toBe('USD');
    expect(getRes.body.settings.maxInvoiceAmountMinor).toBe(1000000);
    expect(getRes.body.providerMode).toBe('mock');
    expect(getRes.body.isMock).toBe(true);

    // 3. PATCH /api/settings
    const patchRes = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessName: 'Acme Global Ventures',
        businessEmail: 'billing@acmeglobal.com',
        defaultCurrency: 'EUR',
        maxInvoiceAmountMinor: 2000000,
        defaultPaymentTermsDays: 45
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ok).toBe(true);
    expect(patchRes.body.settings.businessName).toBe('Acme Global Ventures');
    expect(patchRes.body.settings.businessEmail).toBe('billing@acmeglobal.com');
    expect(patchRes.body.settings.defaultCurrency).toBe('EUR');
    expect(patchRes.body.settings.maxInvoiceAmountMinor).toBe(2000000);
    expect(patchRes.body.settings.defaultPaymentTermsDays).toBe(45);

    // 4. Activity log recorded the settings update
    const actRes = await request(app)
      .get('/api/activity')
      .set('Authorization', `Bearer ${token}`);
    expect(actRes.status).toBe(200);
    const logItem = actRes.body.activities.find(
      (a: { action: string }) => a.action === 'SETTINGS_UPDATED'
    );
    expect(logItem).toBeDefined();
    const detail = JSON.parse(logItem.detailJson);
    expect(detail.businessName).toBe('Acme Global Ventures');
  });

  it('manages notifications via GET, PATCH /api/notifications/:id/read, and POST /api/notifications/mark-all-read', async () => {
    const { app, repo } = createTestSetup();

    // 1. Create user and seed notifications
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'notif-user@example.com',
        password: 'password123',
        displayName: 'Notif Test User'
      });
    const token = regRes.body.sessionToken;
    const userId = regRes.body.user.id;

    // Seed 2 notifications directly via repo
    const n1 = repo.createNotification(userId, {
      title: 'Invoice INV-2026-001 viewed',
      body: 'Acme Corp viewed invoice INV-2026-001 for $1,200.00 USD.'
    });
    const n2 = repo.createNotification(userId, {
      title: 'PayPal Sandbox connected',
      body: 'Your sandbox credentials were successfully verified.'
    });

    // 2. GET /api/notifications
    const getRes = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.notifications.length).toBe(2);
    expect(getRes.body.notifications[0].isRead).toBe(false);

    // 3. Mark single notification as read
    const patchRes = await request(app)
      .patch(`/api/notifications/${n1.id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ok).toBe(true);

    const getRes2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    const foundN1 = getRes2.body.notifications.find((n: { id: string }) => n.id === n1.id);
    const foundN2 = getRes2.body.notifications.find((n: { id: string }) => n.id === n2.id);
    expect(foundN1.isRead).toBe(true);
    expect(foundN2.isRead).toBe(false);

    // 4. Mark all as read
    const markAllRes = await request(app)
      .post('/api/notifications/mark-all-read')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(markAllRes.status).toBe(200);

    const getRes3 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes3.body.notifications.every((n: { isRead: boolean }) => n.isRead)).toBe(true);
  });

  it('exports workspace data bundle via GET /api/export with secrets redacted', async () => {
    const { app } = createTestSetup();

    // 1. Create user and sample client + invoice
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'export-user@example.com',
        password: 'password123',
        displayName: 'Export Test User'
      });
    const token = regRes.body.sessionToken;

    // Create a client
    const clientRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Export Client',
        email: 'exportclient@example.com'
      });
    expect(clientRes.status).toBe(201);

    // 2. GET /api/export
    const exportRes = await request(app)
      .get('/api/export')
      .set('Authorization', `Bearer ${token}`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.header['content-type']).toContain('application/json');
    expect(exportRes.header['content-disposition']).toContain('attachment; filename=');

    const bundle = exportRes.body;
    expect(bundle.exportedAt).toBeDefined();
    expect(bundle.user).toBeDefined();
    expect(bundle.user.email).toBe('export-user@example.com');
    // Ensure passwordHash is never leaked
    expect(bundle.user.passwordHash).toBeUndefined();
    expect(bundle.settings).toBeDefined();
    expect(bundle.clients.length).toBe(1);
    expect(bundle.clients[0].fullName).toBe('Export Client');
    expect(Array.isArray(bundle.invoices)).toBe(true);
    expect(Array.isArray(bundle.activity)).toBe(true);
    expect(Array.isArray(bundle.notifications)).toBe(true);
  });

  it('generates real-event in-app notifications on approval slip creation, invoice dispatch, and payment recording', async () => {
    const { app, repo } = createTestSetup();

    // 1. Register test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'notif-user@example.com',
        password: 'password123',
        displayName: 'Notification Tester'
      });
    expect(regRes.status).toBe(201);
    const token = regRes.body.sessionToken;

    // 2. Create client & invoice
    const clientRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        fullName: 'Notif Client',
        email: 'notifclient@example.com'
      });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.client.id;

    const invRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId,
        invoiceNumber: 'INV-NOTIF-01',
        currencyCode: 'USD',
        issueDate: '2026-11-03',
        dueDate: '2026-11-17',
        taxRateBps: 0,
        items: [
          {
            description: 'Brand Sprint Consulting',
            quantity: 10,
            unitAmountMinor: 10000 // $100.00
          }
        ]
      });
    expect(invRes.status).toBe(201);
    const invoiceId = invRes.body.invoice.id;

    // 3. Submit approval request -> Should generate "Approval slip ready" notification
    const approvalRes = await request(app)
      .post(`/api/invoices/${invoiceId}/approval-request`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(approvalRes.status).toBe(201);
    const actionId = approvalRes.body.action.id;

    const notifs1 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    expect(notifs1.status).toBe(200);
    const readyNotif = notifs1.body.notifications.find((n: { title: string }) =>
      n.title.includes('Approval slip ready')
    );
    expect(readyNotif).toBeDefined();
    expect(readyNotif.body).toContain('INV-NOTIF-01');

    // 4. Approve and execute send -> Should generate "Invoice sent" notification
    const approveRes = await request(app)
      .post(`/api/actions/${actionId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(approveRes.status).toBe(200);

    const sendRes = await request(app)
      .post(`/api/invoices/${invoiceId}/paypal/send`)
      .set('Authorization', `Bearer ${token}`)
      .send({ actionId });
    expect(sendRes.status).toBe(200);

    const notifs2 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    const sentNotif = notifs2.body.notifications.find((n: { title: string }) =>
      n.title.includes('Invoice sent via')
    );
    expect(sentNotif).toBeDefined();
    expect(sentNotif.body).toContain('INV-NOTIF-01');

    // 5. Record partial payment -> Should generate "Payment recorded" notification
    const payRes = await request(app)
      .post(`/api/invoices/${invoiceId}/partial-payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 40000 }); // $400.00
    expect(payRes.status).toBe(200);

    const notifs3 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    const partialNotif = notifs3.body.notifications.find((n: { title: string }) =>
      n.title.includes('Payment recorded')
    );
    expect(partialNotif).toBeDefined();
    expect(partialNotif.body).toContain('INV-NOTIF-01');

    // 6. Settle remaining balance -> Should generate "Invoice paid in full" notification
    const payRes2 = await request(app)
      .post(`/api/invoices/${invoiceId}/partial-payment`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amountMinor: 60000 }); // $600.00
    expect(payRes2.status).toBe(200);

    const notifs4 = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${token}`);
    const settledNotif = notifs4.body.notifications.find((n: { title: string }) =>
      n.title.includes('Invoice paid in full')
    );
    expect(settledNotif).toBeDefined();
    expect(settledNotif.body).toContain('INV-NOTIF-01');
  });
});
