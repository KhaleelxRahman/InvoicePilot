import { describe, expect, it } from 'vitest';
import {
  createPayPalAdapter,
  MockPayPalAdapter,
  SandboxPayPalAdapter
} from '../../src/server/paypal/adapter.js';

describe('Stage 03 — Server PayPal Adapter & Mode Separation', () => {
  it('creates MockPayPalAdapter when mode is mock and SandboxPayPalAdapter when mode is sandbox', () => {
    const mockAdapter = createPayPalAdapter({ mode: 'mock' });
    expect(mockAdapter).toBeInstanceOf(MockPayPalAdapter);
    expect(mockAdapter.mode).toBe('mock');
    expect(mockAdapter.isMock).toBe(true);
    expect(mockAdapter.modeLabel).toContain('ISOLATED MOCK MODE');

    const sandboxAdapter = createPayPalAdapter({
      mode: 'sandbox',
      clientId: 'id',
      clientSecret: 'secret'
    });
    expect(sandboxAdapter).toBeInstanceOf(SandboxPayPalAdapter);
    expect(sandboxAdapter.mode).toBe('sandbox');
    expect(sandboxAdapter.isMock).toBe(false);
    expect(sandboxAdapter.modeLabel).toContain('PayPal Sandbox Mode');
  });

  it('rejects unsupported modes (such as live) without falling back', () => {
    expect(() =>
      createPayPalAdapter({ mode: 'live' as unknown as 'sandbox' })
    ).toThrow(/Unsupported PayPal adapter mode/);
  });

  it('MockPayPalAdapter visibly labels responses and uses MOCK-LOCAL-* IDs that never resemble INV2-* IDs', async () => {
    const mock = createPayPalAdapter({ mode: 'mock' });

    const oauth = await mock.verifyOAuthToken();
    expect(oauth.ok).toBe(true);
    expect(oauth.isMock).toBe(true);
    expect(oauth.mode).toBe('mock');
    expect(oauth.modeLabel).toContain('ISOLATED MOCK MODE');

    const created = await mock.createDraftInvoice({
      invoiceNumber: 'INV-MOCK-01',
      invoiceDate: '2026-10-31',
      currencyCode: 'USD',
      recipientEmail: 'buyer@example.com',
      items: [
        {
          name: 'Advisory Session',
          quantity: '2',
          unitAmountValue: '75.00',
          currencyCode: 'USD'
        }
      ]
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.isMock).toBe(true);
    expect(created.data.providerInvoiceId).toBe('MOCK-LOCAL-0001');
    expect(created.data.providerInvoiceId).not.toMatch(/^INV2-/);
    expect(created.data.providerStatus).toBe('DRAFT');
    expect(created.data.totalValue).toBe('150.00');

    const retrievedDraft = await mock.retrieveInvoice(created.data.providerInvoiceId);
    expect(retrievedDraft.ok).toBe(true);
    if (!retrievedDraft.ok) return;
    expect(retrievedDraft.data.providerStatus).toBe('DRAFT');

    const sent = await mock.sendInvoice({
      providerInvoiceId: created.data.providerInvoiceId
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.data.providerStatus).toBe('SENT');
  });

  it('SandboxPayPalAdapter never silently falls back to mock when credentials are missing', async () => {
    const sandbox = createPayPalAdapter({
      mode: 'sandbox',
      clientId: '',
      clientSecret: ''
    });

    const res = await sandbox.createDraftInvoice({
      invoiceNumber: 'INV-SBX-01',
      invoiceDate: '2026-10-31',
      currencyCode: 'USD',
      recipientEmail: 'buyer@example.com',
      items: [
        {
          name: 'Design',
          quantity: '1',
          unitAmountValue: '50.00',
          currencyCode: 'USD'
        }
      ]
    });

    expect(res.ok).toBe(false);
    expect(res.mode).toBe('sandbox');
    expect(res.isMock).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('CREDENTIALS_MISSING');
  });

  it('SandboxPayPalAdapter maps 401/404/422 errors safely and redacts secrets', async () => {
    const secretVal = 'SUPER_SECRET_PAYPAL_KEY_999';
    let step = 0;

    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/oauth2/token')) {
        if (step === 0) {
          return new Response(
            JSON.stringify({
              error: 'invalid_client',
              error_description: `Client failed for ${secretVal}`
            }),
            { status: 401, headers: { 'paypal-debug-id': 'dbg-auth-fail' } }
          );
        }
        return new Response(
          JSON.stringify({
            access_token: 'A21AA_TOKEN_SECRET_VALUE_8888',
            token_type: 'Bearer',
            expires_in: 32000
          }),
          { status: 200 }
        );
      }

      if (url.includes('/v2/invoicing/invoices/INV2-MISSING')) {
        return new Response(
          JSON.stringify({
            name: 'RESOURCE_NOT_FOUND',
            message: 'The specified resource does not exist.'
          }),
          { status: 404, headers: { 'paypal-debug-id': 'dbg-404' } }
        );
      }

      return new Response(
        JSON.stringify({
          name: 'UNPROCESSABLE_ENTITY',
          message: 'Invalid currency'
        }),
        { status: 422, headers: { 'paypal-debug-id': 'dbg-422' } }
      );
    };

    const adapter = createPayPalAdapter({
      mode: 'sandbox',
      clientId: 'CLIENT_ID_1',
      clientSecret: secretVal,
      fetchImpl: fakeFetch
    });

    // 1. 401 Auth failure with secret redaction
    const authRes = await adapter.verifyOAuthToken();
    expect(authRes.ok).toBe(false);
    if (!authRes.ok) {
      expect(authRes.error.code).toBe('AUTH_FAILED');
      expect(authRes.error.httpStatus).toBe(401);
      expect(authRes.error.message).not.toContain(secretVal);
      expect(authRes.error.message).toContain('[REDACTED_SECRET]');
    }

    // 2. 404 Not Found
    step = 1;
    const notFoundRes = await adapter.retrieveInvoice('INV2-MISSING');
    expect(notFoundRes.ok).toBe(false);
    if (!notFoundRes.ok) {
      expect(notFoundRes.error.code).toBe('NOT_FOUND');
      expect(notFoundRes.error.httpStatus).toBe(404);
      expect(notFoundRes.error.paypalDebugId).toBe('dbg-404');
    }

    // 3. 422 Validation error
    const validationRes = await adapter.createDraftInvoice({
      invoiceNumber: 'INV-BAD',
      invoiceDate: '2026-10-31',
      currencyCode: 'INVALID',
      recipientEmail: 'buyer@example.com',
      items: [{ name: 'Item', quantity: '1', unitAmountValue: '10.00', currencyCode: 'INVALID' }]
    });
    expect(validationRes.ok).toBe(false);
    if (!validationRes.ok) {
      expect(validationRes.error.code).toBe('VALIDATION_ERROR');
      expect(validationRes.error.httpStatus).toBe(422);
      expect(validationRes.error.reconcileRequired).toBe(false);
    }
  });

  it('SandboxPayPalAdapter enforces timeout and does NOT blindly retry consequential send operations', async () => {
    let sendCallCount = 0;

    const slowFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/oauth2/token')) {
        return new Response(
          JSON.stringify({
            access_token: 'A21AA_VALID_TOKEN_12345',
            token_type: 'Bearer',
            expires_in: 3600
          }),
          { status: 200 }
        );
      }

      if (url.endsWith('/send')) {
        sendCallCount += 1;
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('PAYPAL_REQUEST_TIMEOUT'));
          });
        });
      }

      return new Response('{}', { status: 200 });
    };

    const adapter = createPayPalAdapter({
      mode: 'sandbox',
      clientId: 'CLIENT_ID',
      clientSecret: 'CLIENT_SECRET',
      timeoutMs: 30,
      fetchImpl: slowFetch
    });

    const sendRes = await adapter.sendInvoice({
      providerInvoiceId: 'INV2-TIMEOUT-TEST'
    });

    // Must only attempt the send once (no blind retry) and mark reconcileRequired = true
    expect(sendCallCount).toBe(1);
    expect(sendRes.ok).toBe(false);
    if (!sendRes.ok) {
      expect(sendRes.error.code).toBe('TIMEOUT_RECONCILE_REQUIRED');
      expect(sendRes.error.reconcileRequired).toBe(true);
      expect(sendRes.error.retryableAfterReconcile).toBe(true);
    }
  });
});
