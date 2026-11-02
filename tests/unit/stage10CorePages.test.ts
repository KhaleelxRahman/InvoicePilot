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
});
