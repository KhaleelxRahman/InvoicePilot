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

describe('Stage 14: Remaining Pages, Controls, Templates, Deletion & Webhooks', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage14-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage14.sqlite');
    const db = openAndMigrateDatabase(dbFilePath);
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);
    const { demoUser } = repo.resetAndSeedDemoTenant();

    const config = loadAppConfig({
      DATABASE_URL: dbFilePath,
      PAYPAL_MODE: 'mock'
    });
    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(config, adapter, repo);

    const { session, rawToken } = repo.createSession(demoUser.id);

    return { app, repo, db, demoUser, rawDemoToken: rawToken };
  }

  afterEach(() => {
    for (const d of openDbs) {
      try {
        d.close();
      } catch {
        // ignore
      }
    }
    for (const p of tempDirs) {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  describe('Invoice Item Templates Presets', () => {
    it('GET /api/templates returns default seeded presets for owner', async () => {
      const { app, rawDemoToken } = createTestSetup();

      const res = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${rawDemoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.templates)).toBe(true);
      expect(res.body.templates.length).toBeGreaterThanOrEqual(3);

      const names = res.body.templates.map((t: any) => t.name);
      expect(names.some((n: string) => n.includes('Architecture'))).toBe(true);
      expect(names.some((n: string) => n.includes('Retainer'))).toBe(true);
      expect(names.some((n: string) => n.includes('Security Audit'))).toBe(true);
    });

    it('POST /api/templates creates a custom preset template', async () => {
      const { app, rawDemoToken } = createTestSetup();

      const res = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${rawDemoToken}`)
        .send({
          name: 'Custom UX Design Audit',
          description: 'Comprehensive usability evaluation',
          unitPriceMinor: 125000,
          currencyCode: 'USD'
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.template.name).toBe('Custom UX Design Audit');
      expect(res.body.template.unitPriceMinor).toBe(125000);
      expect(res.body.template.currencyCode).toBe('USD');

      // Verify it appears in list
      const listRes = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${rawDemoToken}`);
      expect(listRes.body.templates.some((t: any) => t.name === 'Custom UX Design Audit')).toBe(true);
    });

    it('DELETE /api/templates/:id deletes the owner preset template', async () => {
      const { app, rawDemoToken } = createTestSetup();

      const createRes = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${rawDemoToken}`)
        .send({
          name: 'Temporary Item',
          description: 'To be deleted',
          unitPriceMinor: 5000,
          currencyCode: 'USD'
        });

      const templateId = createRes.body.template.id;

      const delRes = await request(app)
        .delete(`/api/templates/${templateId}`)
        .set('Authorization', `Bearer ${rawDemoToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.ok).toBe(true);

      const listRes = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${rawDemoToken}`);
      expect(listRes.body.templates.some((t: any) => t.id === templateId)).toBe(false);
    });

    it('enforces owner isolation on template operations', async () => {
      const { app, repo, rawDemoToken } = createTestSetup();

      // Create a second user
      const user2 = repo.createUser({
        email: 'otheruser@example.com',
        displayName: 'Other User',
        passwordHash: 'hash',
        isDemo: false
      });
      const { rawToken: token2 } = repo.createSession(user2.id);

      // Create template under user 2
      const createRes = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          name: 'User 2 Private Template',
          description: 'Private',
          unitPriceMinor: 9900,
          currencyCode: 'USD'
        });

      const tId = createRes.body.template.id;

      // Demo user attempting to delete User 2 template should fail (404 not found under owner)
      const delRes = await request(app)
        .delete(`/api/templates/${tId}`)
        .set('Authorization', `Bearer ${rawDemoToken}`);

      expect(delRes.status).toBe(404);
    });
  });

  describe('PayPal Webhook Events Viewer', () => {
    it('GET /api/webhooks/paypal/events lists verified incoming webhook events', async () => {
      const { app, repo, rawDemoToken } = createTestSetup();

      // Record a test webhook event in repo
      repo.recordWebhookEvent({
        providerEventId: 'WH-TEST-STAGE14-001',
        eventType: 'INVOICING.INVOICE.PAID',
        verificationStatus: 'VERIFIED',
        processingStatus: 'PROCESSED',
        payload: { id: 'WH-TEST-STAGE14-001', event_type: 'INVOICING.INVOICE.PAID', summary: 'Invoice INV2-TEST paid by buyer' }
      });

      const res = await request(app)
        .get('/api/webhooks/paypal/events')
        .set('Authorization', `Bearer ${rawDemoToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);

      const found = res.body.events.find((e: any) => e.providerEventId === 'WH-TEST-STAGE14-001');
      expect(found).toBeDefined();
      expect(found.eventType).toBe('INVOICING.INVOICE.PAID');
      expect(found.verificationStatus).toBe('VERIFIED');
      expect(found.payload).toBeDefined();
      expect(found.payload.id).toBe('WH-TEST-STAGE14-001');
    });

    it('rejects unauthenticated requests to webhook events viewer', async () => {
      const { app } = createTestSetup();
      const res = await request(app)
        .get('/api/webhooks/paypal/events')
        .set('x-auth-strict', 'true');
      expect(res.status).toBe(401);
    });
  });

  describe('Account Deletion & Data Privacy', () => {
    it('POST /api/account/delete safely resets demo user to seed state', async () => {
      const { app, repo, demoUser, rawDemoToken } = createTestSetup();

      const res = await request(app)
        .post('/api/account/delete')
        .set('Authorization', `Bearer ${rawDemoToken}`)
        .send({ confirmEmail: demoUser.email });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message).toContain('reset');

      // Demo user still exists with clean seed data
      const checkUser = repo.getUserByEmail(demoUser.email);
      expect(checkUser).toBeDefined();
      expect(checkUser?.isDemo).toBe(true);
    });

    it('POST /api/account/delete permanently purges a real user and their records', async () => {
      const { app, repo } = createTestSetup();

      // Create a real non-demo user
      const realUser = repo.createUser({
        email: 'freelancer@example.com',
        displayName: 'Real Freelancer',
        passwordHash: 'secret_hash',
        isDemo: false
      });
      const { rawToken: realToken } = repo.createSession(realUser.id);

      // Add a client and invoice for realUser
      const client = repo.createClient(realUser.id, {
        fullName: 'Client To Delete',
        email: 'client@example.com',
        defaultCurrency: 'USD'
      });

      repo.createInvoiceDraft(realUser.id, {
        clientId: client.id,
        invoiceNumber: 'INV-DEL-01',
        currencyCode: 'USD',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        items: [{ description: 'Dev Work', quantity: 1, unitAmountMinor: 50000 }]
      });

      // Attempt deletion with mismatched email -> fails 400
      const failRes = await request(app)
        .post('/api/account/delete')
        .set('Authorization', `Bearer ${realToken}`)
        .send({ confirmEmail: 'wrong@example.com' });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error.code).toBe('VALIDATION_ERROR');

      // Attempt deletion with matching email -> succeeds 200
      const okRes = await request(app)
        .post('/api/account/delete')
        .set('Authorization', `Bearer ${realToken}`)
        .send({ confirmEmail: 'freelancer@example.com' });

      expect(okRes.status).toBe(200);
      expect(okRes.body.ok).toBe(true);
      expect(okRes.body.message).toContain('permanently deleted');

      // Verify user and data are completely deleted
      expect(repo.getUserById(realUser.id)).toBeNull();
      expect(repo.getUserByEmail('freelancer@example.com')).toBeNull();
      expect(repo.listClientsForOwner(realUser.id)).toHaveLength(0);
      expect(repo.listInvoicesForOwner(realUser.id)).toHaveLength(0);
    });

    it('rejects account deletion without authentication', async () => {
      const { app } = createTestSetup();
      const res = await request(app)
        .post('/api/account/delete')
        .set('x-auth-strict', 'true')
        .send({ confirmEmail: 'demo@invoicepilot.local' });

      expect(res.status).toBe(401);
    });
  });
});
