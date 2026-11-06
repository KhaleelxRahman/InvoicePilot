import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { newDb, DataType } from 'pg-mem';
import {
  openAndMigrateDatabase,
  isPostgresDatabaseUrl
} from '../../src/server/db/schema.js';
import {
  createIsolatedPostgresDatabase,
  PostgresDatabaseSyncAdapter
} from '../../src/server/db/postgresAdapter.js';
import {
  PostgresPoolAdapter,
  convertQuestionMarksToDollarNumbered,
  buildPostgresSslConfig
} from '../../src/server/db/postgresPoolAdapter.js';
import {
  InvoicePilotRepository,
  DEMO_TENANT_USER_ID,
  DEMO_TENANT_EMAIL,
  OwnershipOrValidationError
} from '../../src/server/db/repository.js';
import { AsyncInvoicePilotRepository } from '../../src/server/db/asyncRepository.js';
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

  it('isolates webhook history and validates owner and limit inputs in the async PostgreSQL repository', async () => {
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    memDb.public.registerFunction({
      name: 'length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => (value ? value.length : 0)
    });
    const ddl = fs.readFileSync(
      path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql'),
      'utf-8'
    );
    memDb.public.query(ddl);
    const { Pool } = memDb.adapters.createPg();
    const pgPool = new Pool();
    const asyncRepo = new AsyncInvoicePilotRepository(new PostgresPoolAdapter(pgPool));

    try {
      const tenantA = await asyncRepo.createUser({
        email: 'async-webhook-tenant-a@example.com',
        displayName: 'Async Webhook Tenant A',
        passwordHash: 'hash-a',
        isDemo: false
      });
      const tenantB = await asyncRepo.createUser({
        email: 'async-webhook-tenant-b@example.com',
        displayName: 'Async Webhook Tenant B',
        passwordHash: 'hash-b',
        isDemo: false
      });
      const clientA = await asyncRepo.createClient(tenantA.id, {
        fullName: 'Async Tenant A Client',
        email: 'async-tenant-a-client@example.com',
        defaultCurrency: 'USD'
      });
      const clientB = await asyncRepo.createClient(tenantB.id, {
        fullName: 'Async Tenant B Client',
        email: 'async-tenant-b-client@example.com',
        defaultCurrency: 'USD'
      });
      const invoiceA = await asyncRepo.createInvoiceDraft(tenantA.id, {
        clientId: clientA.id,
        invoiceNumber: 'INV-ASYNC-WEBHOOK-A',
        currencyCode: 'USD',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        items: [{ description: 'Async Tenant A work', quantity: 1, unitAmountMinor: 10000, currencyCode: 'USD' }]
      });
      const invoiceB = await asyncRepo.createInvoiceDraft(tenantB.id, {
        clientId: clientB.id,
        invoiceNumber: 'INV-ASYNC-WEBHOOK-B',
        currencyCode: 'USD',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        items: [{ description: 'Async Tenant B work', quantity: 1, unitAmountMinor: 20000, currencyCode: 'USD' }]
      });
      await asyncRepo.refreshInvoiceProviderStatus(tenantA.id, invoiceA.id, {
        providerMode: 'sandbox',
        isMock: false,
        providerInvoiceId: 'provider-async-tenant-a',
        providerStatus: 'PAID'
      });
      await asyncRepo.refreshInvoiceProviderStatus(tenantB.id, invoiceB.id, {
        providerMode: 'sandbox',
        isMock: false,
        providerInvoiceId: 'provider-async-tenant-b',
        providerStatus: 'PAID'
      });
      await asyncRepo.recordWebhookEvent({
        providerEventId: 'WH-ASYNC-TENANT-A',
        eventType: 'INVOICING.INVOICE.PAID',
        verificationStatus: 'VERIFIED',
        processingStatus: 'PROCESSED',
        relatedProviderInvoiceId: 'provider-async-tenant-a',
        payload: { id: 'WH-ASYNC-TENANT-A' }
      });
      await asyncRepo.recordWebhookEvent({
        providerEventId: 'WH-ASYNC-TENANT-B',
        eventType: 'INVOICING.INVOICE.PAID',
        verificationStatus: 'VERIFIED',
        processingStatus: 'PROCESSED',
        relatedProviderInvoiceId: 'provider-async-tenant-b',
        payload: { id: 'WH-ASYNC-TENANT-B' }
      });

      const eventsA = await asyncRepo.listWebhookEvents(tenantA.id);
      const eventsB = await asyncRepo.listWebhookEvents(tenantB.id);
      expect(eventsA.map((event) => event.providerEventId)).toEqual(['WH-ASYNC-TENANT-A']);
      expect(eventsB.map((event) => event.providerEventId)).toEqual(['WH-ASYNC-TENANT-B']);
      await expect(asyncRepo.listWebhookEvents('')).rejects.toThrow('Owner user ID is required');
      await expect(asyncRepo.listWebhookEvents(tenantA.id, 0)).rejects.toThrow(
        'Webhook event limit must be an integer'
      );
      await expect(asyncRepo.listWebhookEvents(tenantA.id, 101)).rejects.toThrow(
        'Webhook event limit must be an integer'
      );
    } finally {
      await pgPool.end();
    }
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

  // =========================================================================
  // 7. Netlify Serverless Function Safeguards & Unconfigured Handling
  // =========================================================================
  it('enforces serverless database safeguards: rejects ephemeral SQLite, serves /api/health with degraded status, rewrites Netlify function prefix, and guards data routes with 503', async () => {
    const originalNetlify = process.env.NETLIFY;
    process.env.NETLIFY = 'true';

    try {
      // 1. Calling openAndMigrateDatabase with an on-disk SQLite path under NETLIFY throws
      expect(() => openAndMigrateDatabase('data/invoicepilot.db')).toThrow(
        /SQLite database is not permitted in Netlify serverless functions/
      );

      // 2. Boot Netlify serverless app without DATABASE_URL
      const baseConfig = loadAppConfig({
        ...process.env,
        NETLIFY: 'true',
        DATABASE_URL: ''
      });
      const netlifyApp = createApp(baseConfig);

      // 3. /api/health returns 200 with degraded configuration status
      const healthRes = await request(netlifyApp).get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.status).toBe('degraded');
      expect(healthRes.body.databaseConfigured).toBe(false);
      expect(healthRes.body.databaseEngine).toBe('unconfigured-supabase');
      expect(healthRes.body.message).toMatch(/Supabase PostgreSQL database connection \(DATABASE_URL\) is required/);

      // 4. /.netlify/functions/api/health prefix is cleanly rewritten to /api/health
      const prefixHealthRes = await request(netlifyApp).get('/.netlify/functions/api/health');
      expect(prefixHealthRes.status).toBe(200);
      expect(prefixHealthRes.body.status).toBe('degraded');
      expect(prefixHealthRes.body.databaseConfigured).toBe(false);

      // 5. Database-dependent routes return 503 Service Unavailable with clear configuration instructions
      const invoicesRes = await request(netlifyApp).get('/api/invoices');
      expect(invoicesRes.status).toBe(503);
      expect(invoicesRes.body.error).toBe('DATABASE_CONFIGURATION_REQUIRED');
      expect(invoicesRes.body.databaseConfigured).toBe(false);
      expect(invoicesRes.body.message).toMatch(/DATABASE_URL.*is required/);

      const clientsRes = await request(netlifyApp).get('/api/clients');
      expect(clientsRes.status).toBe(503);
      expect(clientsRes.body.error).toBe('DATABASE_CONFIGURATION_REQUIRED');
    } finally {
      if (originalNetlify !== undefined) {
        process.env.NETLIFY = originalNetlify;
      } else {
        delete process.env.NETLIFY;
      }
    }
  });

  // =========================================================================
  // 8. PostgresPoolAdapter Async Execution, Parameter Translation & Transactions
  // =========================================================================
  it('executes PostgresPoolAdapter with parameterized translation, transaction scopes, and rollback safety without Atomics or SharedArrayBuffer', async () => {
    // 1. Parameter translation parity
    const sql = 'SELECT * FROM invoices WHERE owner_user_id = ? AND total_minor > ? AND status = ?';
    const translated = convertQuestionMarksToDollarNumbered(sql);
    expect(translated).toBe('SELECT * FROM invoices WHERE owner_user_id = $1 AND total_minor > $2 AND status = $3');

    // 2. Mock pg.Pool capturing queries and transaction semantics
    const executedQueries: Array<{ query: string; params?: unknown[] }> = [];
    let activeClientReleased = false;

    const mockClient = {
      query: async (queryText: string, params?: unknown[]) => {
        executedQueries.push({ query: queryText, params });
        if (queryText.includes('SELECT')) {
          return {
            rows: [{ id: 'inv_101', total_minor: 50000, issue_date: new Date('2026-11-01T00:00:00Z') }],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 1 };
      },
      release: () => {
        activeClientReleased = true;
      }
    };

    const mockPool = {
      query: async (queryText: string, params?: unknown[]) => {
        executedQueries.push({ query: queryText, params });
        if (queryText.includes('SELECT')) {
          return {
            rows: [{ id: 'inv_101', total_minor: 50000, issue_date: new Date('2026-11-01T00:00:00Z') }],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 0 };
      },
      connect: async () => mockClient,
      end: async () => {}
    } as any;

    const adapter = new PostgresPoolAdapter(mockPool);

    // 3. Prepare and run queries
    const stmt = adapter.prepare('SELECT id, total_minor, issue_date FROM invoices WHERE owner_user_id = ?');
    const row = await stmt.get('usr_test_1') as any;
    expect(row).toBeDefined();
    expect(row.id).toBe('inv_101');
    expect(row.issue_date).toBe('2026-11-01');

    // 4. Scoped transaction with automatic commit
    await adapter.withTransaction(async () => {
      const updateStmt = adapter.prepare('UPDATE invoices SET status = ? WHERE id = ?');
      await updateStmt.run('PAID', 'inv_101');
    });

    expect(executedQueries.some((q) => q.query === 'BEGIN;')).toBe(true);
    expect(executedQueries.some((q) => q.query === 'COMMIT;')).toBe(true);
    expect(activeClientReleased).toBe(true);

    // 5. Scoped transaction with automatic rollback on error
    let rollbackClientReleased = false;
    const rollbackMockClient = {
      query: async (queryText: string, params?: unknown[]) => {
        executedQueries.push({ query: queryText, params });
        return { rows: [], rowCount: 1 };
      },
      release: () => {
        rollbackClientReleased = true;
      }
    };
    const rollbackMockPool = {
      query: async (queryText: string, params?: unknown[]) => {
        executedQueries.push({ query: queryText, params });
        return { rows: [], rowCount: 0 };
      },
      connect: async () => rollbackMockClient,
      end: async () => {}
    } as any;

    const rollbackAdapter = new PostgresPoolAdapter(rollbackMockPool);

    await expect(
      rollbackAdapter.withTransaction(async () => {
        const delStmt = rollbackAdapter.prepare('DELETE FROM invoices WHERE id = ?');
        await delStmt.run('inv_fail');
        throw new Error('Simulated atomic transaction failure');
      })
    ).rejects.toThrow('Simulated atomic transaction failure');

    expect(executedQueries.some((q) => q.query === 'ROLLBACK;')).toBe(true);
    expect(rollbackClientReleased).toBe(true);
  });

  // =========================================================================
  // 9. Complete Production Path & API-Level Multi-Request Persistence Proof
  // =========================================================================
  it('proves the complete production path (Express API -> AsyncRepository -> PostgresPoolAdapter -> pg.Pool) with writes surviving separate requests and strict TLS certificate validation', async () => {
    // 1. Verify strict TLS certificate validation (rejectUnauthorized is true)
    const tlsConfig = buildPostgresSslConfig('postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres');
    expect(typeof tlsConfig === 'object' && tlsConfig.rejectUnauthorized).toBe(true);

    // Serverless hosting must never disable remote certificate verification.
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    try {
      const serverlessTls = buildPostgresSslConfig(
        'postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
      );
      expect(typeof serverlessTls === 'object' && serverlessTls.rejectUnauthorized).toBe(true);

      expect(() =>
        buildPostgresSslConfig(
          'postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable'
        )
      ).toThrow('Insecure PostgreSQL TLS configuration');

      expect(() =>
        buildPostgresSslConfig(
          'postgresql://postgres.ref:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=no-verify'
        )
      ).toThrow('Insecure PostgreSQL TLS configuration');

      vi.stubEnv('APP_ENV', 'development');
      const localhostTls = buildPostgresSslConfig(
        'postgresql://postgres:secret@localhost:5432/postgres'
      );
      expect(localhostTls).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }

    // 2. Instantiate a real pg.Pool drop-in with complete Supabase PostgreSQL DDL
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    memDb.public.registerFunction({
      name: 'length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (str: string) => (str ? str.length : 0)
    });
    const ddl = fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql'), 'utf-8');
    memDb.public.query(ddl);

    const { Pool } = memDb.adapters.createPg();
    const pgPool = new Pool();

    // 3. Construct the production path: PostgresPoolAdapter -> AsyncInvoicePilotRepository -> Express createApp
    const poolAdapter = new PostgresPoolAdapter(pgPool);
    const asyncRepo = new AsyncInvoicePilotRepository(poolAdapter);
    const config = loadAppConfig({
      DATABASE_URL: 'postgresql://mock.supabase.internal:6543/postgres',
      PAYPAL_MODE: 'sandbox',
      APP_ENV: 'test'
    }, { loadDotEnvFile: false });
    const app = createApp(config, undefined, asyncRepo as any);

    // 4. Request 1: POST /api/auth/register (write user & initial settings)
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'persistent.owner@example.com',
        password: 'SecurePassword123!',
        displayName: 'Persistent PostgreSQL Owner'
      });
    expect(regRes.status).toBe(201);
    const token = regRes.body.sessionToken;
    expect(token).toBeTruthy();

    // 5. Request 2: POST /api/clients (write client in a separate HTTP request)
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-session-token', token)
      .send({
        fullName: 'Surviving Client',
        email: 'surviving@client.example.com',
        defaultCurrency: 'USD'
      });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.client.id;

    // 6. Request 3: GET /api/clients (read client back across a separate HTTP request)
    const listClientsRes = await request(app)
      .get('/api/clients')
      .set('x-session-token', token);
    expect(listClientsRes.status).toBe(200);
    expect(listClientsRes.body.clients.some((c: any) => c.id === clientId && c.fullName === 'Surviving Client')).toBe(true);

    // 7. Request 4: POST /api/invoices (create multi-item invoice draft across separate request)
    const invoiceRes = await request(app)
      .post('/api/invoices')
      .set('x-session-token', token)
      .send({
        clientId,
        invoiceNumber: 'INV-PERSIST-9001',
        currencyCode: 'USD',
        taxRateBps: 1000,
        issueDate: '2026-11-01',
        dueDate: '2026-11-20',
        items: [
          {
            description: 'Async PostgreSQL Architecture',
            quantity: 2,
            unitAmountMinor: 75000,
            currencyCode: 'USD'
          }
        ]
      });
    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.invoice.id;

    // 8. Request 5: GET /api/invoices/:id (read invoice back across separate request)
    const getInvoiceRes = await request(app)
      .get(`/api/invoices/${invoiceId}`)
      .set('x-session-token', token);
    expect(getInvoiceRes.status).toBe(200);
    expect(getInvoiceRes.body.invoice.totalMinor).toBe(165000); // 150000 + 10% tax (15000) = 165000

    // 9. Request 6: POST /api/actions (request human approval slip across separate request)
    const actionRes = await request(app)
      .post('/api/actions')
      .set('x-session-token', token)
      .send({ invoiceId });
    expect(actionRes.status).toBe(201);
    const actionId = actionRes.body.action.id;

    // 10. Request 7: POST /api/actions/:id/approve (approve action across separate request)
    const approveRes = await request(app)
      .post(`/api/actions/${actionId}/approve`)
      .set('x-session-token', token);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.action.state).toBe('APPROVED');

    // 11. Request 8: GET /api/actions/:id (verify state transition persisted across separate request)
    const getActionRes = await request(app)
      .get(`/api/actions/${actionId}`)
      .set('x-session-token', token);
    expect(getActionRes.status).toBe(200);
    expect(getActionRes.body.action.state).toBe('APPROVED');
  });

  // =========================================================================
  // 10. Supabase PostgreSQL JSONB pending_actions Regression Test
  // =========================================================================
  it('successfully creates and retrieves approval slips against PostgreSQL schema with JSONB payload_json column via POST /api/invoices/:id/approval-request', async () => {
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    memDb.public.registerFunction({
      name: 'length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (str: string) => (str ? str.length : 0)
    });
    const ddl = fs.readFileSync(path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql'), 'utf-8');
    memDb.public.query(ddl);

    const { Pool } = memDb.adapters.createPg();
    const pgPool = new Pool();
    const poolAdapter = new PostgresPoolAdapter(pgPool);
    const asyncRepo = new AsyncInvoicePilotRepository(poolAdapter);
    const config = loadAppConfig({
      DATABASE_URL: 'postgresql://mock.supabase.internal:6543/postgres',
      PAYPAL_MODE: 'sandbox',
      APP_ENV: 'test'
    }, { loadDotEnvFile: false });
    const app = createApp(config, undefined, asyncRepo as any);

    // Register user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'slip.tester@example.com',
        password: 'Password123!',
        displayName: 'Slip Tester'
      });
    expect(regRes.status).toBe(201);
    const token = regRes.body.sessionToken;

    // Create client
    const clientRes = await request(app)
      .post('/api/clients')
      .set('x-session-token', token)
      .send({
        fullName: 'Acme Slip Corp',
        email: 'billing@acmeslip.example.com',
        defaultCurrency: 'USD'
      });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.client.id;

    // Create draft invoice
    const invoiceRes = await request(app)
      .post('/api/invoices')
      .set('x-session-token', token)
      .send({
        clientId,
        invoiceNumber: 'INV-SLIP-001',
        currencyCode: 'USD',
        issueDate: '2026-11-01',
        dueDate: '2026-11-15',
        items: [
          {
            description: 'Engineering Sprint',
            quantity: 1,
            unitAmountMinor: 250000,
            currencyCode: 'USD'
          }
        ]
      });
    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.invoice.id;

    // Call POST /api/invoices/:id/approval-request (the exact live endpoint)
    const approvalReqRes = await request(app)
      .post(`/api/invoices/${invoiceId}/approval-request`)
      .set('x-session-token', token);
    expect(approvalReqRes.status).toBe(201);
    expect(approvalReqRes.body.action).toBeDefined();
    expect(approvalReqRes.body.action.state).toBe('PENDING_APPROVAL');
    expect(approvalReqRes.body.action.targetInvoiceId).toBe(invoiceId);
    expect(approvalReqRes.body.slip).toBeDefined();
    expect(approvalReqRes.body.slip.invoiceNumber).toBe('INV-SLIP-001');
    expect(approvalReqRes.body.invoice).toBeDefined();

    // Verify raw query in PostgreSQL database directly confirms payload_json is stored as JSONB
    const rawResult = await pgPool.query('SELECT payload_json FROM pending_actions WHERE id = $1', [approvalReqRes.body.action.id]);
    expect(rawResult.rows.length).toBe(1);
    expect(rawResult.rows[0].payload_json).toBeDefined();

    // Verify GET /api/actions returns parsed slip
    const listActionsRes = await request(app)
      .get(`/api/actions?invoiceId=${invoiceId}`)
      .set('x-session-token', token);
    expect(listActionsRes.status).toBe(200);
    expect(listActionsRes.body.actions.length).toBeGreaterThanOrEqual(1);
    expect(listActionsRes.body.actions[0].slip.invoiceNumber).toBe('INV-SLIP-001');
  });

  // =========================================================================
  // 11. PostgreSQL Account Deletion Cascade & Transaction Rollback Safety
  // =========================================================================
  it('deletes a PostgreSQL user account owning invoices, pending actions, reminders, templates, onboarding, and chat threads via POST /api/account/delete while preserving other tenants and rolling back on mid-transaction failure', async () => {
    const memDb = newDb({ autoCreateForeignKeyIndices: true });
    memDb.public.registerFunction({
      name: 'length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (str: string) => (str ? str.length : 0)
    });
    const ddl = fs.readFileSync(
      path.resolve(process.cwd(), 'migrations/001_initial_supabase_schema.sql'),
      'utf-8'
    );
    memDb.public.query(ddl);

    const { Pool } = memDb.adapters.createPg();
    const pgPool = new Pool();
    const poolAdapter = new PostgresPoolAdapter(pgPool);
    const asyncRepo = new AsyncInvoicePilotRepository(poolAdapter);
    const config = loadAppConfig(
      {
        DATABASE_URL: 'postgresql://mock.supabase.internal:6543/postgres',
        PAYPAL_MODE: 'sandbox',
        APP_ENV: 'test'
      },
      { loadDotEnvFile: false }
    );
    const app = createApp(config, undefined, asyncRepo as any);

    // 1. Register target user to delete and an unrelated second tenant
    const targetReg = await request(app).post('/api/auth/register').send({
      email: 'delete.owner@example.com',
      password: 'Password123!',
      displayName: 'Delete Owner'
    });
    expect(targetReg.status).toBe(201);
    const targetUserId = targetReg.body.user.id;
    const targetToken = targetReg.body.sessionToken;

    const otherReg = await request(app).post('/api/auth/register').send({
      email: 'surviving.tenant@example.com',
      password: 'Password123!',
      displayName: 'Surviving Tenant'
    });
    expect(otherReg.status).toBe(201);
    const otherUserId = otherReg.body.user.id;

    // 2. Populate target user with client, onboarding first_client_id, invoice, items, pending action, reminder, template, notification, and chat_threads/chat_messages
    const targetClient = await asyncRepo.createClient(targetUserId, {
      fullName: 'Cascade Client',
      email: 'cascade.client@example.com',
      defaultCurrency: 'USD'
    });

    await asyncRepo.updateOnboardingProgress(targetUserId, {
      currentStep: 4,
      completed: true,
      firstClientId: targetClient.id
    });

    const targetInvoice = await asyncRepo.createInvoiceDraft(targetUserId, {
      clientId: targetClient.id,
      invoiceNumber: 'INV-CASCADE-001',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [
        {
          description: 'Database FK Cascade Verification',
          quantity: 2,
          unitAmountMinor: 50000,
          currencyCode: 'USD'
        }
      ]
    });

    const { action } = await asyncRepo.requestInvoiceSendApproval(targetUserId, targetInvoice.id);
    expect(action.state).toBe('PENDING_APPROVAL');

    const reminder = await asyncRepo.createReminder(targetUserId, {
      invoiceId: targetInvoice.id,
      tone: 'polite',
      subject: 'Reminder for INV-CASCADE-001',
      body: 'Friendly reminder body'
    });
    expect(reminder.id).toBeTruthy();

    await asyncRepo.createTemplate(targetUserId, {
      title: 'Retainer Template',
      description: 'Monthly retainer item',
      unitAmountMinor: 100000,
      currencyCode: 'USD'
    });

    await asyncRepo.createNotification(targetUserId, {
      title: 'Test Notification',
      body: 'Notification body'
    });

    await pgPool.query(
      `INSERT INTO chat_threads (id, owner_user_id, title, created_at, updated_at)
       VALUES ($1, $2, 'Invoice Thread', NOW(), NOW())`,
      ['thr_cascade_01', targetUserId]
    );
    await pgPool.query(
      `INSERT INTO chat_messages (id, thread_id, owner_user_id, role, content, created_at)
       VALUES ($1, $2, $3, 'user', 'Draft an invoice', NOW())`,
      ['msg_cascade_01', 'thr_cascade_01', targetUserId]
    );

    // Populate unrelated tenant
    const otherClient = await asyncRepo.createClient(otherUserId, {
      fullName: 'Unrelated Client',
      email: 'unrelated@example.com',
      defaultCurrency: 'USD'
    });
    const otherInvoice = await asyncRepo.createInvoiceDraft(otherUserId, {
      clientId: otherClient.id,
      invoiceNumber: 'INV-SURVIVE-001',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [
        {
          description: 'Unrelated Work',
          quantity: 1,
          unitAmountMinor: 75000,
          currencyCode: 'USD'
        }
      ]
    });

    // 3. Execute real account deletion via POST /api/account/delete
    const targetItemsBefore = await pgPool.query(
      'SELECT id FROM invoice_items WHERE owner_user_id = $1',
      [targetUserId]
    );
    expect(targetItemsBefore.rows).toHaveLength(1);
    const otherItemsBefore = await pgPool.query(
      'SELECT id FROM invoice_items WHERE owner_user_id = $1',
      [otherUserId]
    );
    expect(otherItemsBefore.rows).toHaveLength(1);

    // Record every purge statement and its affected row count to prove the invoice_items purge SQL parses and executes
    const purgeRuns: Array<{ sql: string; changes: number }> = [];
    const recordingPrepare = poolAdapter.prepare.bind(poolAdapter);
    poolAdapter.prepare = ((sql: string) => {
      const stmt = recordingPrepare(sql);
      if (!sql.trim().startsWith('DELETE FROM')) return stmt;
      return {
        ...stmt,
        run: async (...params: unknown[]) => {
          const res = await stmt.run(...params);
          purgeRuns.push({ sql, changes: Number(res.changes) });
          return res;
        }
      };
    }) as typeof poolAdapter.prepare;
    const delRes = await request(app)
      .post('/api/account/delete')
      .set('Authorization', `Bearer ${targetToken}`)
      .send({ confirmEmail: 'delete.owner@example.com' });

    expect(delRes.status).toBe(200);
    expect(delRes.body.ok).toBe(true);
    expect(delRes.body.message).toContain('permanently deleted');
    poolAdapter.prepare = recordingPrepare;

    const itemsPurge = purgeRuns.find((r) => r.sql.includes('DELETE FROM invoice_items'));
    expect(itemsPurge).toBeDefined();
    expect(itemsPurge!.sql).toContain('DELETE FROM invoice_items WHERE owner_user_id = ?');
    expect(itemsPurge!.changes).toBe(1);
    // Global tables are never purged by account deletion
    expect(purgeRuns.some((r) => /webhook_events|rate_limits/.test(r.sql))).toBe(false);
    const targetItemsAfter = await pgPool.query(
      'SELECT id FROM invoice_items WHERE owner_user_id = $1',
      [targetUserId]
    );
    expect(targetItemsAfter.rows).toHaveLength(0);
    const otherItemsAfter = await pgPool.query(
      'SELECT id FROM invoice_items WHERE owner_user_id = $1',
      [otherUserId]
    );
    expect(otherItemsAfter.rows).toHaveLength(1);

    // Verify all targetUserId rows are purged across PostgreSQL tables
    expect(await asyncRepo.getUserById(targetUserId)).toBeNull();
    expect(await asyncRepo.listClientsForOwner(targetUserId)).toHaveLength(0);
    expect(await asyncRepo.listInvoicesForOwner(targetUserId)).toHaveLength(0);
    expect(await asyncRepo.listRemindersForOwner(targetUserId)).toHaveLength(0);
    const remainingActions = await pgPool.query(
      'SELECT id FROM pending_actions WHERE owner_user_id = $1',
      [targetUserId]
    );
    expect(remainingActions.rows).toHaveLength(0);
    const remainingThreads = await pgPool.query(
      'SELECT id FROM chat_threads WHERE owner_user_id = $1',
      [targetUserId]
    );
    expect(remainingThreads.rows).toHaveLength(0);
    const remainingMessages = await pgPool.query(
      'SELECT id FROM chat_messages WHERE owner_user_id = $1',
      [targetUserId]
    );
    expect(remainingMessages.rows).toHaveLength(0);

    // 4. Verify unrelated tenant's records remain completely untouched
    expect(await asyncRepo.getUserById(otherUserId)).not.toBeNull();
    expect(await asyncRepo.listClientsForOwner(otherUserId)).toHaveLength(1);
    const survivingInvoices = await asyncRepo.listInvoicesForOwner(otherUserId);
    expect(survivingInvoices).toHaveLength(1);
    expect(survivingInvoices[0].id).toBe(otherInvoice.id);

    // 5. Verify mid-deletion failure runs inside a single transaction and issues ROLLBACK (never COMMIT).
    // NOTE: pg-mem's pg.Pool adapter does not honor ROLLBACK at the data layer, so this asserts the
    // transaction protocol emitted to the pooled client (BEGIN -> ordered DELETEs -> ROLLBACK).
    const rollbackOwner = await asyncRepo.createUser({
      email: 'rollback.owner@example.com',
      displayName: 'Rollback Owner'
    });
    const rollbackClient = await asyncRepo.createClient(rollbackOwner.id, {
      fullName: 'Rollback Client',
      email: 'rollback.client@example.com',
      defaultCurrency: 'USD'
    });
    await asyncRepo.createInvoiceDraft(rollbackOwner.id, {
      clientId: rollbackClient.id,
      invoiceNumber: 'INV-ROLLBACK-001',
      currencyCode: 'USD',
      issueDate: '2026-11-01',
      dueDate: '2026-11-15',
      items: [{ description: 'Rollback Work', quantity: 1, unitAmountMinor: 10000, currencyCode: 'USD' }]
    });

    const txQueries: string[] = [];
    const origConnect = pgPool.connect.bind(pgPool);
    (pgPool as any).connect = async () => {
      const client = await origConnect();
      const origQuery = client.query.bind(client);
      (client as any).query = (text: any, ...rest: any[]) => {
        txQueries.push(typeof text === 'string' ? text : String(text?.text ?? ''));
        return origQuery(text, ...rest);
      };
      return client;
    };
    const origPrepare = poolAdapter.prepare.bind(poolAdapter);
    poolAdapter.prepare = ((sql: string) => {
      if (sql.includes('DELETE FROM users WHERE id = ?')) {
        return {
          get: async () => undefined,
          all: async () => [],
          run: async () => {
            throw new Error('SIMULATED_MID_DELETION_FAILURE');
          }
        };
      }
      return origPrepare(sql);
    }) as typeof poolAdapter.prepare;

    try {
      await expect(asyncRepo.deleteUserAccount(rollbackOwner.id)).rejects.toThrow(
        'SIMULATED_MID_DELETION_FAILURE'
      );
    } finally {
      poolAdapter.prepare = origPrepare;
      (pgPool as any).connect = origConnect;
    }

    expect(txQueries[0]).toBe('BEGIN;');
    expect(txQueries).toContain('ROLLBACK;');
    expect(txQueries).not.toContain('COMMIT;');
    const idx = (needle: string) => txQueries.findIndex((q) => q.includes(needle));
    // Every purge statement ran on the dedicated transaction client (AsyncLocalStorage scope), not the shared pool
    for (const table of [
      'sessions',
      'activity_log',
      'notifications',
      'reminders',
      'pending_actions',
      'invoice_items',
      'invoices',
      'invoice_templates',
      'onboarding_progress',
      'chat_messages',
      'chat_threads',
      'clients',
      'settings',
      'paypal_connections'
    ]) {
      expect(idx(`DELETE FROM ${table} `)).toBeGreaterThan(0);
    }
    // Other tenant remains intact after the failed deletion attempt
    expect(await asyncRepo.getUserById(otherUserId)).not.toBeNull();
    expect(await asyncRepo.listInvoicesForOwner(otherUserId)).toHaveLength(1);
    // Deletes ran on the transaction client in FK-safe order before the rollback
    expect(idx('DELETE FROM invoices')).toBeGreaterThan(idx('DELETE FROM invoice_items'));
    expect(idx('DELETE FROM clients')).toBeGreaterThan(idx('DELETE FROM invoices'));
    expect(idx('DELETE FROM clients')).toBeGreaterThan(idx('DELETE FROM onboarding_progress'));
    expect(idx('DELETE FROM chat_threads')).toBeGreaterThan(idx('DELETE FROM chat_messages'));
    expect(idx('ROLLBACK;')).toBeGreaterThan(idx('DELETE FROM clients'));
  });
});
