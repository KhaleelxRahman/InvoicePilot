import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../../src/server/db/repository.js';
import { createPayPalAdapter } from '../../src/server/paypal/adapter.js';

describe('Phase 1 Security Regression — Unauthenticated Owner Selection & IDOR Prevention', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(): {
    app: ReturnType<typeof createApiApp>;
    repo: InvoicePilotRepository;
    db: DatabaseSync;
    victimUser: { id: string; email: string };
    attackerUser: { id: string; email: string };
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-auth-fix-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'auth-fix.sqlite');
    const db = openAndMigrateDatabase(dbFilePath);
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);
    repo.resetAndSeedDemoTenant();

    const victimUser = repo.createUser({
      id: 'usr_victim_enterprise_99',
      email: 'victim@enterprise.example.com',
      displayName: 'Victim Enterprise Corp',
      isDemo: false
    });

    repo.createClient(victimUser.id, {
      fullName: 'Secret Client of Victim',
      companyName: 'Classified Holdings LLC',
      email: 'secret@classified.example.com',
      defaultCurrency: 'USD'
    });

    const attackerUser = repo.createUser({
      id: 'usr_attacker_rogue_01',
      email: 'attacker@rogue.example.com',
      displayName: 'Attacker Rogue',
      isDemo: false
    });

    const config = loadAppConfig({
      DATABASE_URL: dbFilePath,
      PAYPAL_MODE: 'mock'
    });
    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(config, adapter, repo);

    return { app, repo, db, victimUser, attackerUser };
  }

  afterEach(() => {
    for (const db of openDbs.splice(0, openDbs.length)) {
      try {
        db.close();
      } catch {
        // Ignore already closed handles
      }
    }
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects unauthenticated requests with no headers on /api/clients with 401 UNAUTHORIZED', async () => {
    const { app } = createTestSetup();

    // Plain request with zero auth headers / zero cookies
    const res = await request(app).get('/api/clients');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.clients).toBeUndefined();
  });

  it('rejects unauthenticated requests with no headers on /api/invoices with 401 UNAUTHORIZED', async () => {
    const { app } = createTestSetup();

    const res = await request(app).get('/api/invoices');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.invoices).toBeUndefined();
  });

  it('rejects unauthenticated requests attempting to select victim owner via x-session-user-id header on /api/clients', async () => {
    const { app, victimUser } = createTestSetup();

    // Attacker sends x-session-user-id with victim user ID without a session token
    const res = await request(app)
      .get('/api/clients')
      .set('x-session-user-id', victimUser.id);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    // Ensure victim data was never leaked
    expect(res.body.clients).toBeUndefined();
  });

  it('rejects unauthenticated requests attempting to select victim owner via x-session-user-id header on /api/invoices', async () => {
    const { app, victimUser } = createTestSetup();

    const res = await request(app)
      .get('/api/invoices')
      .set('x-session-user-id', victimUser.id);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.invoices).toBeUndefined();
  });

  it('rejects unauthenticated requests attempting to select victim owner on /api/auth/me', async () => {
    const { app, victimUser } = createTestSetup();

    const res = await request(app)
      .get('/api/auth/me')
      .set('x-session-user-id', victimUser.id);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.user).toBeUndefined();
  });

  it('prevents authenticated attacker from accessing victim workspace by appending x-session-user-id header', async () => {
    const { app, repo, attackerUser, victimUser } = createTestSetup();

    // Attacker logs in and gets their own valid session
    const { rawToken: attackerToken } = repo.createSession(attackerUser.id);

    // Attacker calls /api/clients with their own session BUT appends victim's x-session-user-id
    const res = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${attackerToken}`)
      .set('x-session-user-id', victimUser.id);

    // Request is rejected because x-session-user-id is forbidden/rejected
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.clients).toBeUndefined();
  });

  it('authenticates registered users via POST /api/auth/login and enables authenticated operations', async () => {
    const { app } = createTestSetup();

    // 1. Register a test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'authenticated.pilot@example.com',
        displayName: 'Pilot Studio',
        password: 'ValidPassword123!'
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe('authenticated.pilot@example.com');
    expect(regRes.body.sessionToken).toBeDefined();

    // 2. Explicit login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'authenticated.pilot@example.com',
        password: 'ValidPassword123!'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe('authenticated.pilot@example.com');
    expect(loginRes.body.sessionToken).toBeDefined();

    const sessionToken = loginRes.body.sessionToken;

    // Cookie is also set
    const cookies = loginRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toMatch(/invoicepilot_session=/);

    // 3. Query /api/auth/me with explicit session token
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('authenticated.pilot@example.com');

    // 4. Query /api/clients with explicit session token
    const clientsRes = await request(app)
      .get('/api/clients')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(clientsRes.status).toBe(200);
    expect(Array.isArray(clientsRes.body.clients)).toBe(true);

    // 5. Logout invalidates session
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);

    // 6. Subsequent request with invalidated token returns 401
    const postLogoutRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${sessionToken}`);

    expect(postLogoutRes.status).toBe(401);
    expect(postLogoutRes.body.error.code).toBe('SESSION_EXPIRED');
  });
});
