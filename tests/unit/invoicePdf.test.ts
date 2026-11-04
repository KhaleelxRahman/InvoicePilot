import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { InvoicePilotRepository } from '../../src/server/db/repository.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { generateInvoicePdf } from '../../src/server/pdf/invoicePdfGenerator.js';
import type { InvoiceRecord, ClientRecord, SettingsRecord } from '../../src/server/db/repository.js';

describe('Stage 16 — Invoice PDF Generation and Download Workflow', () => {
  let tempDir: string;
  let dbFile: string;
  let db: any;
  let repo: InvoicePilotRepository;
  let app: any;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage16-'));
    dbFile = path.join(tempDir, 'stage16.sqlite');
    db = openAndMigrateDatabase(dbFile);
    repo = new InvoicePilotRepository(db);
    const config = loadAppConfig(
      {
        DATABASE_URL: dbFile,
        PAYPAL_MODE: 'sandbox',
        APP_ENV: 'test'
      },
      { loadDotEnvFile: false }
    );
    app = createApp(config, undefined, repo);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Pure PDF Generator Engine', () => {
    it('generates a valid, well-formed PDF 1.4 binary buffer with all required fields', () => {
      const mockInvoice: InvoiceRecord = {
        id: 'inv_test_pdf_01',
        ownerUserId: 'usr_owner_1',
        clientId: 'cli_client_1',
        invoiceNumber: 'INV-2026-PDF01',
        currencyCode: 'USD',
        subtotalMinor: 150000,
        taxRateBps: 800, // 8%
        taxMinor: 12000,
        totalMinor: 162000,
        paidAmountMinor: 50000,
        isCompleted: true,
        completedAt: '2026-11-04T12:00:00Z',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        notes: 'Thank you for your business. Net 14 terms.',
        localStatus: 'SENT',
        providerMode: 'sandbox',
        providerStatus: 'NONE',
        items: [
          {
            id: 'item_1',
            invoiceId: 'inv_test_pdf_01',
            ownerUserId: 'usr_owner_1',
            position: 1,
            description: 'UI/UX Design Consultation Sprint',
            quantity: 2,
            unitAmountMinor: 50000,
            lineTotalMinor: 100000,
            currencyCode: 'USD',
            createdAt: '2026-11-01T00:00:00Z'
          },
          {
            id: 'item_2',
            invoiceId: 'inv_test_pdf_01',
            ownerUserId: 'usr_owner_1',
            position: 2,
            description: 'Frontend Architecture Code Review',
            quantity: 1,
            unitAmountMinor: 50000,
            lineTotalMinor: 50000,
            currencyCode: 'USD',
            createdAt: '2026-11-01T00:00:00Z'
          }
        ],
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-04T12:00:00Z'
      };

      const mockClient: ClientRecord = {
        id: 'cli_client_1',
        ownerUserId: 'usr_owner_1',
        fullName: 'Jane Doe',
        companyName: 'Acme Innovations Inc',
        email: 'jane@acme-innovations.com',
        defaultCurrency: 'USD',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z'
      };

      const mockSettings: SettingsRecord = {
        userId: 'usr_owner_1',
        businessName: 'Stellar Design Studio',
        businessEmail: 'billing@stellardesign.studio',
        defaultCurrency: 'USD',
        maxInvoiceAmountMinor: 10000000,
        defaultPaymentTermsDays: 14,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z'
      };

      const pdfBuffer = generateInvoicePdf({
        invoice: mockInvoice,
        client: mockClient,
        settings: mockSettings
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      const pdfString = pdfBuffer.toString('binary');

      // Valid PDF 1.4 header
      expect(pdfString.startsWith('%PDF-1.4')).toBe(true);
      // Valid PDF trailer and EOF
      expect(pdfString.includes('%%EOF')).toBe(true);
      expect(pdfString.includes('startxref')).toBe(true);
      expect(pdfString.includes('/Type /Catalog')).toBe(true);
      expect(pdfString.includes('/Type /Pages')).toBe(true);
      expect(pdfString.includes('/Type /Page')).toBe(true);
      expect(pdfString.includes('/BaseFont /Helvetica')).toBe(true);
      expect(pdfString.includes('/BaseFont /Helvetica-Bold')).toBe(true);

      // Business & Client details present
      expect(pdfString).toContain('Stellar Design Studio');
      expect(pdfString).toContain('billing@stellardesign.studio');
      expect(pdfString).toContain('Jane Doe');
      expect(pdfString).toContain('Acme Innovations Inc');
      expect(pdfString).toContain('jane@acme-innovations.com');

      // Invoice metadata & dates
      expect(pdfString).toContain('INV-2026-PDF01');
      expect(pdfString).toContain('2026-11-01');
      expect(pdfString).toContain('2026-11-15');
      expect(pdfString).toContain('STATUS: SENT');
      expect(pdfString).toContain('[Done] Completed');

      // Line items & amounts
      expect(pdfString).toContain('UI/UX Design Consultation Sprint');
      expect(pdfString).toContain('Frontend Architecture Code Review');
      expect(pdfString).toContain('USD 1500.00'); // Subtotal
      expect(pdfString).toContain('USD 120.00');  // Tax
      expect(pdfString).toContain('USD 1620.00'); // Total
      expect(pdfString).toContain('USD 1120.00'); // Balance due (1620 - 500)

      // Zero internal IDs or secrets leaked
      expect(pdfString).not.toContain('usr_owner_1');
      expect(pdfString).not.toContain('cli_client_1');
      expect(pdfString).not.toContain('inv_test_pdf_01');
    });
  });

  describe('HTTP GET /api/invoices/:id/pdf Endpoint', () => {
    it('authenticates session and serves downloadable PDF attachment', async () => {
      // 1. Create a user, client, and invoice
      const user = repo.createUser({
        email: 'freelancer@test.local',
        displayName: 'Test Freelancer',
        isDemo: false
      });
      const session = repo.createSession(user.id);

      const client = repo.createClient(user.id, {
        fullName: 'Client Partner',
        email: 'partner@clientcorp.com',
        defaultCurrency: 'USD'
      });

      const invoice = repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-PDF-HTTP-001',
        currencyCode: 'USD',
        issueDate: '2026-11-02',
        dueDate: '2026-11-16',
        items: [
          {
            description: 'Custom Web Application Engineering',
            quantity: 1,
            unitAmountMinor: 350000
          }
        ]
      });

      // 2. Fetch PDF via Authorization header (Bearer)
      const res = await request(app)
        .get(`/api/invoices/${invoice.id}/pdf`)
        .set('Authorization', `Bearer ${session.rawToken}`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toBe(
        'attachment; filename="Invoice-INV-PDF-HTTP-001.pdf"'
      );
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(500);
      expect(res.body.toString('binary').startsWith('%PDF-1.4')).toBe(true);
      expect(res.body.toString('binary')).toContain('INV-PDF-HTTP-001');
      expect(res.body.toString('binary')).toContain('Client Partner');

      // 3. Fetch PDF via x-session-token header
      const headerRes = await request(app)
        .get(`/api/invoices/${invoice.id}/pdf`)
        .set('x-session-token', session.rawToken);

      expect(headerRes.status).toBe(200);
      expect(headerRes.header['content-type']).toBe('application/pdf');
      expect(headerRes.body.toString('binary').startsWith('%PDF-1.4')).toBe(true);

      // 4. Fetch PDF via secure HttpOnly session cookie
      const cookieRes = await request(app)
        .get(`/api/invoices/${invoice.id}/pdf`)
        .set('Cookie', `invoicepilot_session=${session.rawToken}`);

      expect(cookieRes.status).toBe(200);
      expect(cookieRes.header['content-type']).toBe('application/pdf');
      expect(cookieRes.body.toString('binary').startsWith('%PDF-1.4')).toBe(true);

      // 5. SECURITY REGRESSION: Reject insecure URL query token (?token=...)
      const queryRes = await request(app)
        .get(`/api/invoices/${invoice.id}/pdf?token=${session.rawToken}`);

      expect(queryRes.status).toBe(401);
      expect(queryRes.body.error?.code).toBe('UNAUTHORIZED');
      expect(queryRes.body.error?.message).toContain('Authentication required');
    });

    it('rejects unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const res = await request(app).get('/api/invoices/inv_any/pdf');
      expect(res.status).toBe(401);
      expect(res.body.error?.code).toBe('UNAUTHORIZED');
    });

    it('enforces owner isolation with 403 / 404 when another user accesses invoice PDF', async () => {
      const userA = repo.createUser({ email: 'userA@test.local', displayName: 'User A' });
      const userB = repo.createUser({ email: 'userB@test.local', displayName: 'User B' });
      const sessionB = repo.createSession(userB.id);

      const clientA = repo.createClient(userA.id, {
        fullName: 'Target Client',
        email: 'target@corp.local',
        defaultCurrency: 'USD'
      });
      const invoiceA = repo.createInvoiceDraft(userA.id, {
        clientId: clientA.id,
        invoiceNumber: 'INV-USERA-999',
        currencyCode: 'USD',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        items: [{ description: 'Secret Project', quantity: 1, unitAmountMinor: 100000 }]
      });

      const res = await request(app)
        .get(`/api/invoices/${invoiceA.id}/pdf`)
        .set('Authorization', `Bearer ${sessionB.rawToken}`);

      expect([403, 404]).toContain(res.status);
    });
  });
});
