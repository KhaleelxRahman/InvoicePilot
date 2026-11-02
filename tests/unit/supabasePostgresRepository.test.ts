import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  openAndMigrateDatabase,
  isPostgresDatabaseUrl
} from '../../src/server/db/schema.js';
import {
  createIsolatedPostgresDatabase,
  PostgresDatabaseSyncAdapter
} from '../../src/server/db/postgresAdapter.js';
import {
  InvoicePilotRepository,
  DEMO_TENANT_USER_ID,
  DEMO_TENANT_EMAIL,
  OwnershipOrValidationError
} from '../../src/server/db/repository.js';
import { createApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';

describe('Supabase PostgreSQL Repository Engine & Integration', () => {
  // =========================================================================
  // 1. Repository Selection & Database Engine Detection
  // =========================================================================
  it('correctly detects PostgreSQL connection strings and selects the PostgreSQL engine', () => {
    expect(isPostgresDatabaseUrl('postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres')).toBe(true);
    expect(isPostgresDatabaseUrl('postgres://localhost:5432/invoicepilot')).toBe(true);
    expect(isPostgresDatabaseUrl('supabase://project.supabase.co')).toBe(true);
    expect(isPostgresDatabaseUrl(':memory-postgres:')).toBe(true);

    expect(isPostgresDatabaseUrl('data/invoicepilot.db')).toBe(false);
    expect(isPostgresDatabaseUrl('data/invoicepilot.test.db')).toBe(false);
    expect(isPostgresDatabaseUrl('')).toBe(false);

    const db = openAndMigrateDatabase(':memory-postgres:');
    expect(db).toBeInstanceOf(PostgresDatabaseSyncAdapter);
  });

  // =========================================================================
  // 2. Deterministic Synthetic Demo Seed in PostgreSQL
  // =========================================================================
  it('initializes and verifies the synthetic demo tenant in the isolated PostgreSQL database', () => {
    const pgDb = createIsolatedPostgresDatabase();
    const repo = new InvoicePilotRepository(pgDb);

    const demoUser = repo.getUserById(DEMO_TENANT_USER_ID);
    expect(demoUser).not.toBeNull();
    expect(demoUser?.email).toBe(DEMO_TENANT_EMAIL);
    expect(demoUser?.displayName).toBe('Aarav Mehta Studio (Demo Workspace)');
    expect(demoUser?.isDemo).toBe(true);

    const settings = repo.getSettings(DEMO_TENANT_USER_ID);
    expect(settings?.businessName).toBe('Aarav Mehta Design & Engineering');
    expect(settings?.defaultCurrency).toBe('USD');
    expect(settings?.maxInvoiceAmountMinor).toBe(2500000);

    const clients = repo.listClientsForOwner(DEMO_TENANT_USER_ID);
    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(clients.some((c) => c.fullName === 'Elena Vance')).toBe(true);

    const invoices = repo.listInvoicesForOwner(DEMO_TENANT_USER_ID);
    expect(invoices.length).toBeGreaterThanOrEqual(1);
    expect(invoices[0].invoiceNumber).toBe('INV-DEMO-1001');
    expect(invoices[0].totalMinor).toBe(210000); // $2,100.00
  });

  // =========================================================================
  // 3. Ownership Isolation in PostgreSQL
  // =========================================================================
  it('enforces strict cross-owner isolation across clients and invoices in PostgreSQL', () => {
    const pgDb = createIsolatedPostgresDatabase();
    const repo = new InvoicePilotRepository(pgDb);

    const userA = repo.createUser({
      email: 'ownerA@example.com',
      displayName: 'Owner Alpha'
    });
    const userB = repo.createUser({
      email: 'ownerB@example.com',
      displayName: 'Owner Beta'
    });

    const clientA = repo.createClient(userA.id, {
      fullName: 'Private Client Alpha',
      email: 'clientA@example.com',
      defaultCurrency: 'USD'
    });

    const invoiceA = repo.createInvoiceDraft(userA.id, {
      clientId: clientA.id,
      invoiceNumber: 'INV-A-101',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [
        {
          description: 'Consulting Alpha',
          quantity: 1,
          unitAmountMinor: 100000,
          currencyCode: 'USD'
        }
      ]
    });

    // User A can read their records
    expect(repo.getClientForOwner(userA.id, clientA.id)).not.toBeNull();
    expect(repo.getInvoiceForOwner(userA.id, invoiceA.id)).not.toBeNull();

    // User B cannot read User A's client (throws NOT_FOUND)
    expect(() => repo.getClientForOwner(userB.id, clientA.id)).toThrow(
      OwnershipOrValidationError
    );

    // User B cannot access User A's invoice (throws FORBIDDEN_OWNER_MISMATCH or NOT_FOUND)
    expect(() => repo.getInvoiceForOwner(userB.id, invoiceA.id)).toThrow(
      OwnershipOrValidationError
    );

    // User B cannot modify or approve User A's invoice
    expect(() => repo.requestInvoiceSendApproval(userB.id, invoiceA.id)).toThrow(
      OwnershipOrValidationError
    );
  });

  // =========================================================================
  // 4. Transaction Atomicity & Rollback in PostgreSQL
  // =========================================================================
  it('rolls back database modifications completely when a transaction fails in PostgreSQL', () => {
    const pgDb = createIsolatedPostgresDatabase();
    const repo = new InvoicePilotRepository(pgDb);

    const user = repo.createUser({
      email: 'tx.tester@example.com',
      displayName: 'Transaction Tester'
    });

    expect(() => {
      repo.withTransaction(() => {
        repo.createClient(user.id, {
          fullName: 'Rollback Client',
          email: 'rollback@example.com',
          defaultCurrency: 'USD'
        });
        // Intentionally trigger an error
        throw new Error('Simulated atomic transaction failure');
      });
    }).toThrow('Simulated atomic transaction failure');

    const clientList = repo.listClientsForOwner(user.id);
    expect(clientList.some((c) => c.email === 'rollback@example.com')).toBe(false);
  });

  // =========================================================================
  // 5. Key Invoice & Approval Slip Workflows in PostgreSQL
  // =========================================================================
  it('executes full invoice draft creation, approval slip generation, and partial payment in PostgreSQL', () => {
    const pgDb = createIsolatedPostgresDatabase();
    const repo = new InvoicePilotRepository(pgDb);

    const user = repo.createUser({
      email: 'invoice.tester@example.com',
      displayName: 'Invoice Tester'
    });

    const client = repo.createClient(user.id, {
      fullName: 'Acme PostgreSQL Customer',
      email: 'billing@acme.example.com',
      defaultCurrency: 'USD'
    });

    // 1. Create draft invoice
    const draft = repo.createInvoiceDraft(user.id, {
      clientId: client.id,
      invoiceNumber: 'INV-PG-2001',
      currencyCode: 'USD',
      taxRateBps: 800, // 8%
      issueDate: '2026-11-01',
      dueDate: '2026-11-20',
      notes: 'PostgreSQL Workflow Verification',
      providerMode: 'sandbox',
      items: [
        {
          description: 'Postgres Cloud Migration',
          quantity: 2,
          unitAmountMinor: 50000, // 2 * $500.00 = $1,000.00
          currencyCode: 'USD'
        }
      ]
    });

    // Subtotal: $1,000.00 (100000), Tax: 8% = $80.00 (8000), Total: $1,080.00 (108000)
    expect(draft.subtotalMinor).toBe(100000);
    expect(draft.taxMinor).toBe(8000);
    expect(draft.totalMinor).toBe(108000);
    expect(draft.localStatus).toBe('DRAFT');

    // 2. Request Human Approval Slip
    const { action, slip } = repo.requestInvoiceSendApproval(user.id, draft.id);
    expect(action.state).toBe('PENDING_APPROVAL');
    expect(slip.totalMinor).toBe(108000);
    expect(slip.clientEmail).toBe('billing@acme.example.com');

    // 3. Approve Action
    const approved = repo.approvePendingAction(user.id, action.id);
    expect(approved.state).toBe('APPROVED');

    // 4. Duplicate approval attempt throws DUPLICATE_EVENT
    expect(() => repo.approvePendingAction(user.id, action.id)).toThrow(
      OwnershipOrValidationError
    );

    // 5. Partial payment: pay $500.00
    const partial1 = repo.recordPartialPayment(user.id, draft.id, 50000);
    expect(partial1.paidAmountMinor).toBe(50000);
    expect(partial1.providerStatus).not.toBe('PAID');

    // 6. Complete remaining payment: pay $580.00 -> auto settles to PAID
    const partial2 = repo.recordPartialPayment(user.id, draft.id, 58000);
    expect(partial2.paidAmountMinor).toBe(108000);
    expect(partial2.providerStatus).toBe('PAID');
  });

  // =========================================================================
  // 6. Production API Wired to PostgreSQL
  // =========================================================================
  it('boots the production Express API backed by PostgreSQL and serves /api/health and authenticated routes', async () => {
    const config = loadAppConfig({
      DATABASE_URL: ':memory-postgres:',
      PAYPAL_MODE: 'sandbox',
      APP_ENV: 'test'
    }, { loadDotEnvFile: false });

    const app = createApp(config);

    // 1. Health endpoint verifies PostgreSQL engine
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');
    expect(healthRes.body.databaseEngine).toBe('postgresql-supabase');
    expect(healthRes.body.demoTenantReady).toBe(true);

    // 2. Register user through the API into PostgreSQL
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'api.postgres.user@example.com',
        password: 'ValidPassword123!',
        displayName: 'API Postgres User'
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe('api.postgres.user@example.com');
    const sessionToken = regRes.body.sessionToken;
    expect(sessionToken).toBeTruthy();

    // 3. Create a client via authenticated API over PostgreSQL
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-session-token', sessionToken)
      .send({
        fullName: 'Client Via PostgreSQL API',
        email: 'client.pg@example.com',
        defaultCurrency: 'USD'
      });

    expect(clientRes.status).toBe(201);
    expect(clientRes.body.client.fullName).toBe('Client Via PostgreSQL API');
    const clientId = clientRes.body.client.id;

    // 4. Create an invoice draft via API over PostgreSQL
    const invoiceRes = await request(app)
      .post('/api/invoices')
      .set('x-session-token', sessionToken)
      .send({
        clientId,
        invoiceNumber: 'INV-API-PG-001',
        currencyCode: 'USD',
        taxRateBps: 0,
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        notes: 'API created draft in PostgreSQL',
        items: [
          {
            description: 'Item in PostgreSQL',
            quantity: 1,
            unitAmountMinor: 15000,
            currencyCode: 'USD'
          }
        ]
      });

    expect(invoiceRes.status).toBe(201);
    expect(invoiceRes.body.invoice.invoiceNumber).toBe('INV-API-PG-001');
    expect(invoiceRes.body.invoice.totalMinor).toBe(15000);
    const invoiceId = invoiceRes.body.invoice.id;

    // 5. Request approval slip via API over PostgreSQL
    const actionRes = await request(app)
      .post('/api/actions')
      .set('x-session-token', sessionToken)
      .send({
        invoiceId
      });

    expect(actionRes.status).toBe(201);
    expect(actionRes.body.action.state).toBe('PENDING_APPROVAL');
    const actionId = actionRes.body.action.id;

    // 6. Approve action via API over PostgreSQL
    const approveRes = await request(app)
      .post(`/api/actions/${actionId}/approve`)
      .set('x-session-token', sessionToken);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.action.state).toBe('APPROVED');
  });
});
