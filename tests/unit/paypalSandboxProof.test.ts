import { describe, expect, it } from 'vitest';
import {
  extractInvoiceId,
  redactSecret,
  runSandboxVerification,
  sanitizeErrorMessage,
  type SandboxProofEnv
} from '../../src/server/paypal/sandboxProof.js';

describe('Stage 02 — PayPal Sandbox Proof Module & Secret Redaction', () => {
  it('redacts tokens and secrets without exposing full values', () => {
    expect(redactSecret('')).toBe('[EMPTY]');
    expect(redactSecret('short')).toBe('[REDACTED len=5]');
    const longToken = 'A21AAJ9_secret_access_token_value_1234567890';
    const redacted = redactSecret(longToken);
    expect(redacted).toBe('A21A...[REDACTED len=44]');
    expect(redacted).not.toContain('secret_access_token_value');
  });

  it('scrubs client secrets and Bearer tokens from error messages', () => {
    const raw =
      'Request failed with Authorization: Bearer SECRET_TOKEN_XYZ and clientSecret=MY_SUPER_SECRET_KEY';
    const sanitized = sanitizeErrorMessage(raw, ['MY_SUPER_SECRET_KEY']);
    expect(sanitized).not.toContain('SECRET_TOKEN_XYZ');
    expect(sanitized).not.toContain('MY_SUPER_SECRET_KEY');
    expect(sanitized).toContain('Bearer [REDACTED_TOKEN]');
    expect(sanitized).toContain('[REDACTED_SECRET]');
  });

  it('extracts invoice ID from PayPal Invoicing v2 response body or self link', () => {
    expect(extractInvoiceId({ id: 'INV2-ABCD-1234-EFGH-5678' })).toBe(
      'INV2-ABCD-1234-EFGH-5678'
    );
    expect(
      extractInvoiceId({
        links: [
          {
            rel: 'self',
            href: 'https://api-m.sandbox.paypal.com/v2/invoicing/invoices/INV2-LINK-9999'
          }
        ]
      })
    ).toBe('INV2-LINK-9999');
  });

  it('reports BLOCKED_MISSING_CREDENTIALS honestly when credentials are not configured', async () => {
    const emptyEnv: SandboxProofEnv = {
      paypalMode: 'sandbox',
      clientId: '',
      clientSecret: '',
      recipientEmail: 'sb-buyer@personal.example.com'
    };

    const report = await runSandboxVerification(emptyEnv);
    expect(report.credentialsConfigured).toBe(false);
    expect(report.steps.oauthToken.status).toBe('BLOCKED_MISSING_CREDENTIALS');
    expect(report.steps.createDraft.status).toBe('NOT_RUN');
    expect(report.steps.retrieveDraft.status).toBe('NOT_RUN');
    expect(report.steps.sendInvoice.status).toBe('NOT_RUN');
    expect(report.steps.retrievePostSend.status).toBe('NOT_RUN');
  });

  it('executes OAuth -> createDraft -> retrieveDraft -> send -> retrievePostSend with redacted token evidence', async () => {
    const testEnv: SandboxProofEnv = {
      paypalMode: 'sandbox',
      clientId: 'TEST_CLIENT_ID_NON_SECRET',
      clientSecret: 'TEST_CLIENT_SECRET_DO_NOT_LOG',
      recipientEmail: 'sb-buyer@personal.example.com',
      baseUrl: 'https://api-m.sandbox.paypal.com'
    };

    let invoiceSent = false;
    const simulatedFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.endsWith('/v1/oauth2/token') && method === 'POST') {
        return new Response(
          JSON.stringify({
            access_token: 'A21AA_SIMULATED_OAUTH_TOKEN_987654321',
            token_type: 'Bearer',
            app_id: 'APP-80W284485P519543T',
            expires_in: 32400,
            scope: 'https://uri.paypal.com/services/invoicing'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.endsWith('/v2/invoicing/invoices') && method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'INV2-TEST-STAGE02-0001',
            status: 'DRAFT'
          }),
          {
            status: 201,
            headers: {
              'Content-Type': 'application/json',
              'paypal-debug-id': 'dbg-create-01'
            }
          }
        );
      }

      if (url.endsWith('/v2/invoicing/invoices/INV2-TEST-STAGE02-0001') && method === 'GET') {
        return new Response(
          JSON.stringify({
            id: 'INV2-TEST-STAGE02-0001',
            status: invoiceSent ? 'SENT' : 'DRAFT',
            detail: {
              invoice_number: 'IP-SBX-000001',
              currency_code: 'USD',
              metadata: invoiceSent
                ? { recipient_view_url: 'https://www.sandbox.paypal.com/invoice/p/#INV2-TEST' }
                : {}
            },
            amount: {
              currency_code: 'USD',
              value: '25.00'
            }
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'paypal-debug-id': invoiceSent ? 'dbg-get-02' : 'dbg-get-01'
            }
          }
        );
      }

      if (url.endsWith('/v2/invoicing/invoices/INV2-TEST-STAGE02-0001/send') && method === 'POST') {
        invoiceSent = true;
        return new Response(
          JSON.stringify({
            links: [
              {
                rel: 'payer-view',
                href: 'https://www.sandbox.paypal.com/invoice/p/#INV2-TEST'
              }
            ]
          }),
          {
            status: 202,
            headers: {
              'Content-Type': 'application/json',
              'paypal-debug-id': 'dbg-send-01'
            }
          }
        );
      }

      return new Response(JSON.stringify({ name: 'NOT_FOUND' }), { status: 404 });
    };

    const report = await runSandboxVerification(testEnv, simulatedFetch);
    expect(report.steps.oauthToken.status).toBe('PASSED');
    expect(report.steps.oauthToken.evidence?.redactedTokenPreview).toBe(
      'A21A...[REDACTED len=37]'
    );
    expect(JSON.stringify(report)).not.toContain('A21AA_SIMULATED_OAUTH_TOKEN_987654321');
    expect(JSON.stringify(report)).not.toContain('TEST_CLIENT_SECRET_DO_NOT_LOG');

    expect(report.steps.createDraft.status).toBe('PASSED');
    expect(report.steps.createDraft.evidence?.providerInvoiceId).toBe('INV2-TEST-STAGE02-0001');

    expect(report.steps.retrieveDraft.status).toBe('PASSED');
    expect(report.steps.retrieveDraft.evidence?.providerStatus).toBe('DRAFT');

    expect(report.steps.sendInvoice.status).toBe('PASSED');
    expect(report.steps.sendInvoice.evidence?.httpStatus).toBe(202);

    expect(report.steps.retrievePostSend.status).toBe('PASSED');
    expect(report.steps.retrievePostSend.evidence?.providerStatus).toBe('SENT');
    expect(report.steps.retrievePostSend.evidence?.recipientViewUrlPresent).toBe(true);
  });
});
