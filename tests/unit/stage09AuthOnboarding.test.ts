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

describe('Stage 09 — Authentication, Demo Isolation, and Onboarding', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(options?: {
    providerMode?: 'sandbox' | 'mock';
  }): {
    app: ReturnType<typeof createApiApp>;
    repo: InvoicePilotRepository;
    db: DatabaseSync;
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage09-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage09.sqlite');
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
        // Ignore already-closed handles
      }
    }
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('1. User Registration and Timing-Safe Password Authentication', () => {
    it('registers a real user with scrypt hashed password and returns session token without leaking hash', async () => {
      const { app } = createTestSetup();

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'consultant@example.com',
          password: 'CorrectHorseBattery99!',
          displayName: 'Ada Lovelace Advisory'
        });

      expect(regRes.status).toBe(201);
      expect(regRes.body.ok).toBe(true);
      expect(regRes.body.user).toBeDefined();
      expect(regRes.body.user.email).toBe('consultant@example.com');
      expect(regRes.body.user.displayName).toBe('Ada Lovelace Advisory');
      expect(regRes.body.user.isDemo).toBe(false);
      expect(regRes.body.sessionToken).toBeDefined();
      expect(typeof regRes.body.sessionToken).toBe('string');
      // Verify passwordHash is never leaked in response
      expect(regRes.body.user.passwordHash).toBeUndefined();
      expect(regRes.body.passwordHash).toBeUndefined();

      // Verify Set-Cookie header contains invoicepilot_session
      const cookies = regRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/invoicepilot_session=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);

      // Verify onboarding progress record initialized
      expect(regRes.body.onboarding).toBeDefined();
      expect(regRes.body.onboarding.currentStep).toBe(1);
      expect(regRes.body.onboarding.completed).toBe(false);
    });

    it('rejects duplicate email and short password with clear client errors', async () => {
      const { app } = createTestSetup();

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'LongPassword123!',
          displayName: 'User One'
        });

      // Attempt duplicate email
      const dupRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPassword456!',
          displayName: 'User Two'
        });

      expect([400, 409]).toContain(dupRes.status);
      expect(dupRes.body.error.code).toBe('DUPLICATE_EVENT');

      // Attempt short password (<8 characters)
      const shortRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'short@example.com',
          password: 'short',
          displayName: 'Short Pass'
        });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('authenticates valid credentials via login and rejects invalid passwords', async () => {
      const { app } = createTestSetup();

      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login-test@example.com',
          password: 'SecretPassword2026!',
          displayName: 'Login Tester'
        });

      // Login with valid credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'SecretPassword2026!'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.ok).toBe(true);
      expect(loginRes.body.user.email).toBe('login-test@example.com');
      expect(loginRes.body.sessionToken).toBeDefined();
      expect(loginRes.body.user.passwordHash).toBeUndefined();

      // Login with wrong password
      const wrongPassRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login-test@example.com',
          password: 'WrongPassword999!'
        });

      expect(wrongPassRes.status).toBe(401);
      expect(wrongPassRes.body.error.code).toBe('UNAUTHORIZED');

      // Login with unknown email
      const unknownEmailRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SecretPassword2026!'
        });

      expect(unknownEmailRes.status).toBe(401);
      expect(unknownEmailRes.body.error.code).toBe('UNAUTHORIZED');
    });

    it('logs out and deletes active session', async () => {
      const { app } = createTestSetup();

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logout-user@example.com',
          password: 'PasswordLogout123!',
          displayName: 'Logout User'
        });

      const token = regRes.body.sessionToken;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.ok).toBe(true);

      // Verify token no longer authenticates
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(401);
    });
  });

  describe('2. Unauthenticated Access, Expiration, and Cross-User Isolation', () => {
    it('rejects unauthenticated requests when strict auth is required', async () => {
      const { app } = createTestSetup();

      const res = await request(app)
        .get('/api/clients')
        .set('x-auth-strict', 'true');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects expired session tokens with 401 SESSION_EXPIRED', async () => {
      const { app, db } = createTestSetup();

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'expiring@example.com',
          password: 'PasswordExp123!',
          displayName: 'Expiring User'
        });

      const token = regRes.body.sessionToken;

      // Manually set session expires_at into the past
      const pastTime = new Date(Date.now() - 3600_000).toISOString();
      db.prepare('UPDATE sessions SET expires_at = ?').run(pastTime);

      const res = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${token}`)
        .set('x-auth-strict', 'true');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('SESSION_EXPIRED');
    });

    it('enforces strict cross-user ownership isolation on clients and invoices', async () => {
      const { app } = createTestSetup();

      // Register User A
      const userARes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'usera@example.com',
          password: 'PasswordUserA123!',
          displayName: 'User A'
        });
      const tokenA = userARes.body.sessionToken;

      // User A creates a client
      const clientARes = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fullName: 'Client of User A',
          email: 'client-a@example.com',
          defaultCurrency: 'USD'
        });
      expect(clientARes.status).toBe(201);
      const clientAId = clientARes.body.client.id;

      // Register User B
      const userBRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'userb@example.com',
          password: 'PasswordUserB123!',
          displayName: 'User B'
        });
      const tokenB = userBRes.body.sessionToken;

      // User B attempts to access User A's client
      const accessRes = await request(app)
        .get(`/api/clients/${clientAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(accessRes.status).toBe(403);
      expect(accessRes.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

      // User B attempts to edit User A's client
      const editRes = await request(app)
        .patch(`/api/clients/${clientAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          fullName: 'Hacked Name'
        });

      expect(editRes.status).toBe(403);
      expect(editRes.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

      // User B attempts to delete User A's client
      const deleteRes = await request(app)
        .delete(`/api/clients/${clientAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error.code).toBe('FORBIDDEN_OWNER_MISMATCH');

      // User B's clients list should NOT include User A's client
      const listBRes = await request(app)
        .get('/api/clients')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(listBRes.status).toBe(200);
      expect(listBRes.body.clients.some((c: { id: string }) => c.id === clientAId)).toBe(false);
    });
  });

  describe('3. Demo Isolation and Safe Reset Scope', () => {
    it('resets demo tenant cleanly without touching real user accounts or their records', async () => {
      const { app, repo } = createTestSetup();

      // Create a real user with client and invoice
      const realUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'realconsultant@firm.com',
          password: 'FirmPassword123!',
          displayName: 'Real Consultant'
        });
      const realToken = realUserRes.body.sessionToken;
      const realUserId = realUserRes.body.user.id;

      const realClientRes = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${realToken}`)
        .send({
          fullName: 'Real Corporate Client',
          email: 'corp@realclient.com',
          defaultCurrency: 'USD'
        });
      const realClientId = realClientRes.body.client.id;

      const realInvoiceRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${realToken}`)
        .send({
          clientId: realClientId,
          invoiceNumber: 'REAL-INV-001',
          currencyCode: 'USD',
          issueDate: '2026-11-01',
          dueDate: '2026-11-30',
          items: [{ description: 'Strategy Consulting', quantity: 1, unitAmountMinor: 50000 }]
        });
      expect(realInvoiceRes.status).toBe(201);
      const realInvoiceId = realInvoiceRes.body.invoice.id;

      // Ensure demo tenant has data
      const demoClientsBefore = repo.listClientsForOwner(DEMO_TENANT_USER_ID);
      expect(demoClientsBefore.length).toBeGreaterThan(0);

      // Trigger Demo Reset on repository fixture directly
      const resetResult = repo.resetAndSeedDemoTenant();
      expect(resetResult.clients.length).toBeGreaterThan(0);

      // Verify Real User's client is still intact and accessible
      const realClientCheck = await request(app)
        .get(`/api/clients/${realClientId}`)
        .set('Authorization', `Bearer ${realToken}`);

      expect(realClientCheck.status).toBe(200);
      expect(realClientCheck.body.client.fullName).toBe('Real Corporate Client');

      // Verify Real User's invoice is still intact
      const realInvoiceCheck = await request(app)
        .get(`/api/invoices/${realInvoiceId}`)
        .set('Authorization', `Bearer ${realToken}`);

      expect(realInvoiceCheck.status).toBe(200);
      expect(realInvoiceCheck.body.invoice.invoiceNumber).toBe('REAL-INV-001');

      // Verify Real User profile and onboarding progress still exist
      const userCheck = repo.getUserById(realUserId);
      expect(userCheck).toBeDefined();
      expect(userCheck?.email).toBe('realconsultant@firm.com');
      expect(userCheck?.isDemo).toBe(false);

      const onboardingCheck = repo.getOnboardingProgress(realUserId);
      expect(onboardingCheck).toBeDefined();
    });
  });

  describe('4. Complete Onboarding Flow with Skip and Resume', () => {
    it('walks through the 4-step onboarding wizard and persists completion', async () => {
      const { app } = createTestSetup({ providerMode: 'mock' });

      // Register new user
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'onboarding-user@example.com',
          password: 'SecurePassword123!',
          displayName: 'New Practicing Consultant'
        });
      const token = regRes.body.sessionToken;

      // Verify initial state: step 1
      const initialOnb = await request(app)
        .get('/api/onboarding')
        .set('Authorization', `Bearer ${token}`);
      expect(initialOnb.status).toBe(200);
      expect(initialOnb.body.onboarding.currentStep).toBe(1);
      expect(initialOnb.body.onboarding.completed).toBe(false);

      // Step 1: Save business details
      const step1Res = await request(app)
        .post('/api/onboarding/business-details')
        .set('Authorization', `Bearer ${token}`)
        .send({
          businessName: 'Vertex Advisory LLC',
          businessEmail: 'billing@vertex-advisory.example.com',
          defaultCurrency: 'USD'
        });
      expect(step1Res.status).toBe(200);
      expect(step1Res.body.onboarding.businessName).toBe('Vertex Advisory LLC');
      expect(step1Res.body.onboarding.currentStep).toBe(2);

      // Step 2: Test Sandbox connection
      const step2Res = await request(app)
        .post('/api/onboarding/test-sandbox')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(step2Res.status).toBe(200);
      expect(step2Res.body.onboarding.sandboxTested).toBe(true);
      expect(step2Res.body.onboarding.currentStep).toBe(3);

      // Step 3: Set safety limits & reminder tone
      const step3Res = await request(app)
        .post('/api/onboarding/preferences')
        .set('Authorization', `Bearer ${token}`)
        .send({
          maxInvoiceAmountMinor: 2500000,
          defaultReminderTone: 'firm'
        });
      expect(step3Res.status).toBe(200);
      expect(step3Res.body.onboarding.maxInvoiceAmountMinor).toBe(2500000);
      expect(step3Res.body.onboarding.defaultReminderTone).toBe('firm');
      expect(step3Res.body.onboarding.currentStep).toBe(4);

      // Step 4: Register first client
      const step4Res = await request(app)
        .post('/api/onboarding/first-client')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fullName: 'Pioneer Client Inc',
          email: 'finance@pioneer.example.com',
          companyName: 'Pioneer Corporation',
          defaultCurrency: 'USD'
        });
      expect(step4Res.status).toBe(201);
      expect(step4Res.body.client.fullName).toBe('Pioneer Client Inc');
      expect(step4Res.body.onboarding.completed).toBe(true);
      expect(step4Res.body.onboarding.firstClientId).toBe(step4Res.body.client.id);

      // Verify resume: GET /api/onboarding shows fully completed state
      const resumeRes = await request(app)
        .get('/api/onboarding')
        .set('Authorization', `Bearer ${token}`);
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.onboarding.completed).toBe(true);
      expect(resumeRes.body.onboarding.businessName).toBe('Vertex Advisory LLC');
      expect(resumeRes.body.onboarding.sandboxTested).toBe(true);
      expect(resumeRes.body.clientCount).toBeGreaterThanOrEqual(1);

      // Test reset onboarding
      const resetOnbRes = await request(app)
        .post('/api/onboarding/reset')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(resetOnbRes.status).toBe(200);
      expect(resetOnbRes.body.onboarding.currentStep).toBe(1);
      expect(resetOnbRes.body.onboarding.completed).toBe(false);
    });

    it('allows skipping onboarding and preserves skipped status', async () => {
      const { app } = createTestSetup();

      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'skip-user@example.com',
          password: 'SkipPassword123!',
          displayName: 'Skip User'
        });
      const token = regRes.body.sessionToken;

      const skipRes = await request(app)
        .post('/api/onboarding/skip')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(skipRes.status).toBe(200);
      expect(skipRes.body.onboarding.skipped).toBe(true);
      expect(skipRes.body.onboarding.completed).toBe(true);

      const checkRes = await request(app)
        .get('/api/onboarding')
        .set('Authorization', `Bearer ${token}`);
      expect(checkRes.body.onboarding.skipped).toBe(true);
      expect(checkRes.body.onboarding.completed).toBe(true);
    });
  });
});
