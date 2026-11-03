import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../../src/server/db/repository.js';
import type { DatabaseSync } from 'node:sqlite';

describe('Stage 05 — Clients & Conventional Invoice Draft API Workflow', () => {
  let tempDir = '';
  let dbFile = '';
  let db: DatabaseSync | null = null;
  let repo: InvoicePilotRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage05-'));
    dbFile = path.join(tempDir, 'stage05.sqlite');
    db = openAndMigrateDatabase(dbFile);
    repo = new InvoicePilotRepository(db!);
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

  function createAuthedAgent(appInstance: any) {
    const { rawToken } = repo.createSession(DEMO_TENANT_USER_ID);
    const agent = request.agent(appInstance);
    agent.set('Authorization', `Bearer ${rawToken}`);
    return agent;
  }

  it('creates, lists, reads detail, edits, and deletes an owned client via /api/clients', async () => {
    const app = createApiApp(loadAppConfig({ DATABASE_URL: dbFile }), undefined, repo);
    const req = createAuthedAgent(app);

    // 1. List seeded demo clients
    const listRes1 = await req.get('/api/clients');
    expect(listRes1.status).toBe(200);
    expect(listRes1.body.clients).toHaveLength(2);

    // 2. Create a new client
    const createRes = await req.post('/api/clients').send({
      fullName: 'Priya Nair',
      companyName: 'Nair Sostenible Studio',
      email: 'priya@nair-studio.example.com',
      defaultCurrency: 'USD',
      notes: 'Include milestone code on line items.'
    });
    expect(createRes.status).toBe(201);
    const createdClient = createRes.body.client;
    expect(createdClient.id).toMatch(/^cli_/);
    expect(createdClient.fullName).toBe('Priya Nair');
    expect(createdClient.defaultCurrency).toBe('USD');

    // 3. Get client detail
    const detailRes = await req.get(`/api/clients/${createdClient.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.client.email).toBe('priya@nair-studio.example.com');
    expect(detailRes.body.invoices).toEqual([]);

    // 4. Edit client
    const patchRes = await req.patch(`/api/clients/${createdClient.id}`).send({
      companyName: 'Nair Global Advisory',
      defaultCurrency: 'EUR',
      notes: 'Updated billing notes'
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.client.companyName).toBe('Nair Global Advisory');
    expect(patchRes.body.client.defaultCurrency).toBe('EUR');
    expect(patchRes.body.client.notes).toBe('Updated billing notes');

    // 5. Delete client with zero invoices succeeds
    const delRes = await req.delete(`/api/clients/${createdClient.id}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);

    // 6. Deleting a client that has existing invoices is rejected with 400 VALIDATION_ERROR
    const linkedDeleteRes = await req.delete('/api/clients/cli_demo_northstar_01');
    expect(linkedDeleteRes.status).toBe(400);
    expect(linkedDeleteRes.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates, persists, reloads, and edits an invoice draft while recalculating totals server-side and never sending to PayPal', async () => {
    const app = createApiApp(loadAppConfig({ DATABASE_URL: dbFile }), undefined, repo);
    const req = createAuthedAgent(app);

    // Send a draft creation payload that also includes spoofed browser totals; server must ignore them
    const createRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_kestrel_02',
        invoiceNumber: 'INV-STAGE05-2001',
        currencyCode: 'USD',
        taxRatePercent: '7.5', // 750 bps
        issueDate: '2026-10-31',
        dueDate: '2026-11-15',
        notes: 'Phase 1 Logistics Platform UX',
        subtotalMinor: 1, // Spoofed browser value
        taxMinor: 1, // Spoofed browser value
        totalMinor: 2, // Spoofed browser value
        items: [
          {
            description: 'Core workflow wireframes',
            quantity: 3,
            unitPriceDecimal: '400.00', // 3 * 40000 = 120000 ($1,200.00)
            lineTotalMinor: 1 // Spoofed browser value
          },
          {
            description: 'Accessibility contrast audit',
            quantity: 1,
            unitPriceDecimal: '300.00' // 1 * 30000 = 30000 ($300.00)
          }
        ]
      });

    expect(createRes.status).toBe(201);
    const created = createRes.body.invoice;
    // Subtotal = 120000 + 30000 = 150000 ($1,500.00)
    // Tax (7.5%) = Math.round(150000 * 750 / 10000) = 11250 ($112.50)
    // Total = 161250 ($1,612.50)
    expect(created.subtotalMinor).toBe(150000);
    expect(created.taxRateBps).toBe(750);
    expect(created.taxMinor).toBe(11250);
    expect(created.totalMinor).toBe(161250);
    expect(created.localStatus).toBe('DRAFT');
    expect(created.providerStatus).toBe('NONE');
    expect(created.providerInvoiceId).toBeUndefined();
    expect(created.items).toHaveLength(2);
    expect(created.items[0].lineTotalMinor).toBe(120000);
    expect(created.items[1].lineTotalMinor).toBe(30000);

    // Reload from GET /api/invoices/:id
    const detailRes = await req.get(`/api/invoices/${created.id}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.invoice.totalMinor).toBe(161250);
    expect(detailRes.body.client.id).toBe('cli_demo_kestrel_02');

    // Edit draft via PATCH /api/invoices/:id and verify server recalculates totals
    const patchRes = await req
      .patch(`/api/invoices/${created.id}`)
      .send({
        taxRatePercent: '10', // 1000 bps
        dueDate: '2026-11-20',
        notes: 'Updated scope with extra sprint',
        items: [
          {
            description: 'Core workflow wireframes (expanded)',
            quantity: 4,
            unitPriceDecimal: '450.00' // 4 * 45000 = 180000 ($1,800.00)
          }
        ]
      });

    expect(patchRes.status).toBe(200);
    const updated = patchRes.body.invoice;
    expect(updated.subtotalMinor).toBe(180000);
    expect(updated.taxRateBps).toBe(1000);
    expect(updated.taxMinor).toBe(18000);
    expect(updated.totalMinor).toBe(198000);
    expect(updated.dueDate).toBe('2026-11-20');
    expect(updated.notes).toBe('Updated scope with extra sprint');
    expect(updated.items).toHaveLength(1);
    expect(updated.localStatus).toBe('DRAFT');
    expect(updated.providerStatus).toBe('NONE');
  });

  it('rejects invalid amount, currency, calendar dates, date ordering, and line item data', async () => {
    const app = createApiApp(loadAppConfig({ DATABASE_URL: dbFile }), undefined, repo);
    const req = createAuthedAgent(app);

    // 1. Invalid calendar date (Feb 30)
    const badDateRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-BAD-DATE',
        currencyCode: 'USD',
        issueDate: '2026-02-30',
        dueDate: '2026-03-10',
        items: [{ description: 'Work', quantity: 1, unitPriceDecimal: '100.00' }]
      });
    expect(badDateRes.status).toBe(400);
    expect(badDateRes.body.error.code).toBe('VALIDATION_ERROR');
    expect(badDateRes.body.error.message).toMatch(/valid YYYY-MM-DD calendar dates/);

    // 2. Due date before issue date
    const dueBeforeIssueRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-BAD-ORDER',
        currencyCode: 'USD',
        issueDate: '2026-11-15',
        dueDate: '2026-11-01',
        items: [{ description: 'Work', quantity: 1, unitPriceDecimal: '100.00' }]
      });
    expect(dueBeforeIssueRes.status).toBe(400);
    expect(dueBeforeIssueRes.body.error.message).toMatch(/Due date must be on or after/);

    // 3. Unsupported currency code
    const badCurrRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-BAD-CURR',
        currencyCode: 'XYZ',
        issueDate: '2026-10-31',
        dueDate: '2026-11-14',
        items: [{ description: 'Work', quantity: 1, unitAmountMinor: 10000 }]
      });
    expect(badCurrRes.status).toBe(400);
    expect(badCurrRes.body.error.message).toMatch(/Unsupported currency code/);

    // 4. Zero or negative price/quantity
    const zeroPriceRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-ZERO-PRICE',
        currencyCode: 'USD',
        issueDate: '2026-10-31',
        dueDate: '2026-11-14',
        items: [{ description: 'Free item', quantity: 1, unitPriceDecimal: '0.00' }]
      });
    expect(zeroPriceRes.status).toBe(400);
    expect(zeroPriceRes.body.error.message).toMatch(/positive integer/);

    // 5. Empty item description
    const emptyDescRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-EMPTY-DESC',
        currencyCode: 'USD',
        issueDate: '2026-10-31',
        dueDate: '2026-11-14',
        items: [{ description: '   ', quantity: 1, unitPriceDecimal: '100.00' }]
      });
    expect(emptyDescRes.status).toBe(400);
    expect(emptyDescRes.body.error.message).toMatch(/description is required/);

    // 6. JPY zero-decimal currency with fractional decimals rejected
    const jpyFracRes = await req
      .post('/api/invoices')
      .send({
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: 'INV-JPY-FRAC',
        currencyCode: 'JPY',
        issueDate: '2026-10-31',
        dueDate: '2026-11-14',
        items: [{ description: 'Tokyo Workshop', quantity: 1, unitPriceDecimal: '5000.50' }]
      });
    expect(jpyFracRes.status).toBe(400);
    expect(jpyFracRes.body.error.message).toMatch(/exceeds 0 decimal places/);
  });

  it('enforces owner isolation across /api/clients and /api/invoices (403 FORBIDDEN_OWNER_MISMATCH & 401 UNAUTHORIZED)', async () => {
    const ownerB = repo.createUser({
      id: 'usr_other_owner_05',
      email: 'other.owner@studio.example.com',
      displayName: 'Other Owner Studio',
      isDemo: false
    });

    const app = createApiApp(loadAppConfig({ DATABASE_URL: dbFile }), undefined, repo);

    // Unauthenticated / anonymous header rejected with 401
    const unauthRes = await request(app)
      .get('/api/clients')
      .set('X-Session-User-Id', 'anonymous');
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');

    const { rawToken: ownerBToken } = repo.createSession(ownerB.id);

    // Owner B sees 0 clients and 0 invoices in their own list
    const listBClients = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(listBClients.status).toBe(200);
    expect(listBClients.body.clients).toHaveLength(0);

    // Owner B cannot view or edit Demo Tenant's client
    const crossClientGet = await request(app)
      .get('/api/clients/cli_demo_northstar_01')
      .set('Authorization', `Bearer ${ownerBToken}`);
    expect(crossClientGet.status).toBe(403);
    expect(crossClientGet.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

    // Owner B cannot view or edit Demo Tenant's invoice draft
    const crossInvoicePatch = await request(app)
      .patch('/api/invoices/inv_demo_draft_01')
      .set('Authorization', `Bearer ${ownerBToken}`)
      .send({ notes: 'Tampered notes' });
    expect(crossInvoicePatch.status).toBe(403);
    expect(crossInvoicePatch.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

    // Verify Demo Tenant's invoice was not modified
    const demoInvoice = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, 'inv_demo_draft_01');
    expect(demoInvoice.notes).toBe('Q4 Accessibility & Ledger Design System Audit');
  });
});
