import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApiApp, createInMemoryRateLimiter } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../../src/server/db/repository.js';
import { createPayPalAdapter } from '../../src/server/paypal/adapter.js';

describe('Security Headers, CORS, Rate Limiting & Proxy Trust', () => {
  let tempDir = '';
  let dbFilePath = '';
  let db: DatabaseSync;
  let repo: InvoicePilotRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-sec-'));
    dbFilePath = path.join(tempDir, 'sec.sqlite');
    db = openAndMigrateDatabase(dbFilePath);
    repo = new InvoicePilotRepository(db);
    repo.resetAndSeedDemoTenant();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('serves standard HTTP security headers and CSP on API responses', async () => {
    const config = loadAppConfig({
      DATABASE_URL: `file:${dbFilePath}`,
      PAYPAL_MODE: 'mock',
      APP_ENV: 'production'
    });
    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(config, adapter, repo);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);

    // Verify security headers
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain('https://api-m.sandbox.paypal.com');
    expect(res.headers['content-security-policy']).toContain('https://generativelanguage.googleapis.com');
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  it('handles CORS allowed origins and OPTIONS preflight requests securely', async () => {
    const config = loadAppConfig({
      DATABASE_URL: `file:${dbFilePath}`,
      PAYPAL_MODE: 'mock'
    });
    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(config, adapter, repo);

    // 1. Allowed origin preflight
    const preflightRes = await request(app)
      .options('/api/invoices')
      .set('Origin', 'http://localhost:5173');

    expect(preflightRes.status).toBe(204);
    expect(preflightRes.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(preflightRes.headers['access-control-allow-methods']).toContain('POST');
    expect(preflightRes.headers['access-control-allow-credentials']).toBe('true');

    // 2. Disallowed external origin preflight
    const forbiddenOriginRes = await request(app)
      .options('/api/invoices')
      .set('Origin', 'https://malicious-site.example.com');

    expect(forbiddenOriginRes.status).toBe(403);
    expect(forbiddenOriginRes.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('enforces rate limiting and returns HTTP 429 with Retry-After when threshold is reached', async () => {
    const limiter = createInMemoryRateLimiter({
      windowMs: 60 * 1000,
      max: 3,
      message: 'Rate limit exceeded for test.'
    });

    const mockReq = (ip = '192.168.1.100') => ({
      ip,
      headers: {},
      socket: { remoteAddress: ip }
    } as any);

    const mockRes = () => {
      const headers: Record<string, any> = {};
      let statusCode = 200;
      let body: any = null;
      return {
        setHeader(name: string, value: any) {
          headers[name.toLowerCase()] = value;
        },
        status(code: number) {
          statusCode = code;
          return {
            json(data: any) {
              body = data;
            }
          };
        },
        getHeaders: () => headers,
        getStatusCode: () => statusCode,
        getBody: () => body
      };
    };

    let nextCalled = 0;
    const next = () => { nextCalled += 1; };

    // Request 1: OK
    const res1 = mockRes();
    limiter(mockReq(), res1 as any, next);
    expect(nextCalled).toBe(1);
    expect(res1.getHeaders()['ratelimit-remaining']).toBe(2);

    // Request 2: OK
    const res2 = mockRes();
    limiter(mockReq(), res2 as any, next);
    expect(nextCalled).toBe(2);
    expect(res2.getHeaders()['ratelimit-remaining']).toBe(1);

    // Request 3: OK (limit reached)
    const res3 = mockRes();
    limiter(mockReq(), res3 as any, next);
    expect(nextCalled).toBe(3);
    expect(res3.getHeaders()['ratelimit-remaining']).toBe(0);

    // Request 4: Rate limited!
    const res4 = mockRes();
    limiter(mockReq(), res4 as any, next);
    expect(nextCalled).toBe(3); // Not forwarded to next
    expect(res4.getStatusCode()).toBe(429);
    expect(res4.getBody().error.code).toBe('RATE_LIMITED');
    expect(res4.getBody().error.message).toBe('Rate limit exceeded for test.');
    expect(res4.getHeaders()['retry-after']).toBeGreaterThanOrEqual(1);

    // Request 5 from DIFFERENT IP is unaffected
    const resDifferentIp = mockRes();
    limiter(mockReq('10.0.0.1'), resDifferentIp as any, next);
    expect(nextCalled).toBe(4);
    expect(resDifferentIp.getStatusCode()).toBe(200);
    expect(resDifferentIp.getHeaders()['ratelimit-remaining']).toBe(2);
  });

  it('prevents SQLite fallback on Vercel serverless runtime and allows Vercel origins in CORS', async () => {
    const vercelConfig = loadAppConfig(
      {
        VERCEL: '1',
        VERCEL_URL: 'invoicepilot-preview-abc123.vercel.app',
        APP_ENV: 'production',
        PAYPAL_MODE: 'sandbox'
      },
      { loadDotEnvFile: false }
    );

    expect(vercelConfig.databaseUrl).toBe('');
    expect(vercelConfig.appBaseUrl).toBe('https://invoicepilot-preview-abc123.vercel.app');

    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(vercelConfig, adapter);

    // Health check reports degraded when DATABASE_URL is absent on Vercel serverless without touching SQLite
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.databaseConfigured).toBe(false);
    expect(healthRes.body.databaseEngine).toBe('unconfigured-supabase');

    // Database-backed endpoint returns 503 DATABASE_CONFIGURATION_REQUIRED
    const clientsRes = await request(app).get('/api/clients');
    expect(clientsRes.status).toBe(503);
    expect(clientsRes.body.error).toBe('DATABASE_CONFIGURATION_REQUIRED');

    // Production Vercel origin preflight succeeds
    const prodOriginRes = await request(app)
      .options('/api/health')
      .set('Origin', 'https://invoicepilot-beryl.vercel.app');
    expect(prodOriginRes.status).toBe(204);
    expect(prodOriginRes.headers['access-control-allow-origin']).toBe(
      'https://invoicepilot-beryl.vercel.app'
    );
  });
});

