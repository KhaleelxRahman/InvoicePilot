import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadAppConfig } from '../../src/server/config.js';
import { createApiApp } from '../../src/server/app.js';

describe('Stage 01 — Server Config & Health Endpoint', () => {
  it('defaults PAYPAL_MODE to sandbox when omitted', () => {
    const config = loadAppConfig({}, { loadDotEnvFile: false });
    expect(config.paypalMode).toBe('sandbox');
    expect(config.port).toBe(3000);
  });

  it('accepts explicit mock mode when PAYPAL_MODE=mock', () => {
    const config = loadAppConfig({ PAYPAL_MODE: 'mock' }, { loadDotEnvFile: false });
    expect(config.paypalMode).toBe('mock');
  });

  it('rejects unsupported PAYPAL_MODE values (such as live)', () => {
    expect(() => loadAppConfig({ PAYPAL_MODE: 'live' }, { loadDotEnvFile: false })).toThrow(
      /Invalid PAYPAL_MODE/
    );
  });

  it('returns HTTP 200 and explicit sandbox mode on GET /api/health without leaking secrets', async () => {
    const app = createApiApp(
      loadAppConfig(
        { PAYPAL_MODE: 'sandbox', PAYPAL_CLIENT_SECRET: 'DO_NOT_LEAK' },
        { loadDotEnvFile: false }
      )
    );
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeTruthy();
    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'invoicepilot',
      paypalMode: 'sandbox',
      isMock: false,
      modeLabel: 'PayPal Sandbox Mode (No Live Money)',
      approvalGateEnforced: true
    });
    expect(JSON.stringify(res.body)).not.toContain('DO_NOT_LEAK');
  });

  it('returns HTTP 200 and explicit mock mode label when configured in mock mode', async () => {
    const app = createApiApp(loadAppConfig({ PAYPAL_MODE: 'mock' }, { loadDotEnvFile: false }));
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.paypalMode).toBe('mock');
    expect(res.body.isMock).toBe(true);
    expect(res.body.modeLabel).toBe('Isolated Mock Mode (Simulated Provider)');
  });

  it('returns the API.md structured 404 error shape for unknown /api/* routes', async () => {
    const app = createApiApp(loadAppConfig({}, { loadDotEnvFile: false }));
    const res = await request(app).get('/api/unknown-stage1-route');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: expect.stringContaining('The requested API endpoint does not exist'),
        requestId: expect.any(String)
      }
    });
  });
});
