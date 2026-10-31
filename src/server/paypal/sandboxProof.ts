import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Official PayPal Sandbox base URL per PayPal REST API Reference:
 * https://developer.paypal.com/api/rest/
 */
export const PAYPAL_SANDBOX_BASE_URL = 'https://api-m.sandbox.paypal.com';

export const PayPalOAuthResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  app_id: z.string().optional(),
  expires_in: z.number(),
  nonce: z.string().optional(),
  scope: z.string().optional()
});

export const PayPalLinkSchema = z.object({
  href: z.string(),
  rel: z.string(),
  method: z.string().optional()
});

export const PayPalInvoiceResourceSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    detail: z
      .object({
        invoice_number: z.string().optional(),
        currency_code: z.string().optional(),
        invoice_date: z.string().optional(),
        metadata: z
          .object({
            recipient_view_url: z.string().optional(),
            invoicer_view_url: z.string().optional()
          })
          .passthrough()
          .optional()
      })
      .passthrough()
      .optional(),
    amount: z
      .object({
        currency_code: z.string().optional(),
        value: z.string().optional()
      })
      .passthrough()
      .optional(),
    links: z.array(PayPalLinkSchema).optional()
  })
  .passthrough();

export interface SandboxProofEnv {
  paypalMode: string;
  clientId: string;
  clientSecret: string;
  invoicerEmail?: string;
  recipientEmail: string;
  baseUrl?: string;
}

export interface RedactedOAuthProof {
  httpStatus: number;
  tokenType: string;
  expiresIn: number;
  redactedTokenPreview: string;
  appId?: string;
  scopeCount: number;
}

export interface DraftInvoiceProof {
  httpStatus: number;
  providerInvoiceId: string;
  invoiceNumber: string;
  currencyCode: string;
  totalValue: string;
  paypalDebugId?: string;
}

export interface RetrievedInvoiceProof {
  httpStatus: number;
  providerInvoiceId: string;
  providerStatus: string;
  invoiceNumber?: string;
  currencyCode?: string;
  amountValue?: string;
  recipientViewUrlPresent: boolean;
  paypalDebugId?: string;
}

export interface SendInvoiceProof {
  httpStatus: number;
  providerInvoiceId: string;
  recipientViewLinkPresent: boolean;
  paypalDebugId?: string;
}

export interface SandboxVerificationReport {
  timestamp: string;
  baseUrl: string;
  paypalMode: string;
  credentialsConfigured: boolean;
  steps: {
    oauthToken: {
      status: 'PASSED' | 'FAILED' | 'BLOCKED_MISSING_CREDENTIALS';
      detail: string;
      evidence?: RedactedOAuthProof;
    };
    createDraft: {
      status: 'PASSED' | 'FAILED' | 'NOT_RUN';
      detail: string;
      evidence?: DraftInvoiceProof;
    };
    retrieveDraft: {
      status: 'PASSED' | 'FAILED' | 'NOT_RUN';
      detail: string;
      evidence?: RetrievedInvoiceProof;
    };
    sendInvoice: {
      status: 'PASSED' | 'FAILED' | 'NOT_RUN';
      detail: string;
      evidence?: SendInvoiceProof;
    };
    retrievePostSend: {
      status: 'PASSED' | 'FAILED' | 'NOT_RUN';
      detail: string;
      evidence?: RetrievedInvoiceProof;
    };
  };
}

/**
 * Redacts a sensitive token or secret so full values are never logged or returned.
 */
export function redactSecret(value: string | undefined | null): string {
  if (!value || value.trim().length === 0) {
    return '[EMPTY]';
  }
  const trimmed = value.trim();
  if (trimmed.length <= 8) {
    return `[REDACTED len=${trimmed.length}]`;
  }
  return `${trimmed.slice(0, 4)}...[REDACTED len=${trimmed.length}]`;
}

/**
 * Scrubs any known secret strings from error messages before logging.
 */
export function sanitizeErrorMessage(
  rawMessage: string,
  secretsToRedact: Array<string | undefined>
): string {
  let sanitized = rawMessage;
  for (const secret of secretsToRedact) {
    if (secret && secret.trim().length >= 4) {
      sanitized = sanitized.split(secret.trim()).join('[REDACTED_SECRET]');
    }
  }
  // Redact any Bearer token patterns
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED_BASIC_AUTH]');
  return sanitized;
}

/**
 * Parses a local .env file if present in the workspace root without printing any values.
 */
export function loadDotEnvFileIfExists(envFilePath = path.resolve(process.cwd(), '.env')): Record<string, string> {
  const parsed: Record<string, string> = {};
  if (!fs.existsSync(envFilePath)) {
    return parsed;
  }
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let val = line.slice(eqIndex + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }
  return parsed;
}

export function resolveSandboxProofEnv(processEnv: NodeJS.ProcessEnv = process.env): SandboxProofEnv {
  const fileEnv = loadDotEnvFileIfExists();
  const merged = { ...fileEnv, ...processEnv };

  const paypalMode = (merged.PAYPAL_MODE ?? 'sandbox').trim().toLowerCase();
  if (paypalMode !== 'sandbox') {
    throw new Error(
      `Stage 02 PayPal Sandbox proof requires PAYPAL_MODE="sandbox" (received "${paypalMode}"). Live mode is prohibited.`
    );
  }

  return {
    paypalMode,
    clientId: (merged.PAYPAL_CLIENT_ID ?? '').trim(),
    clientSecret: (merged.PAYPAL_CLIENT_SECRET ?? '').trim(),
    invoicerEmail: (merged.PAYPAL_SANDBOX_INVOICER_EMAIL ?? '').trim() || undefined,
    recipientEmail:
      (merged.PAYPAL_SANDBOX_RECIPIENT_EMAIL ?? '').trim() ||
      'sb-buyer-invoicepilot@personal.example.com',
    baseUrl: PAYPAL_SANDBOX_BASE_URL
  };
}

/**
 * Extracts invoice ID from PayPal Invoicing v2 response body or self/location link.
 */
export function extractInvoiceId(body: unknown, locationHeader?: string | null): string | null {
  const parsed = PayPalInvoiceResourceSchema.safeParse(body);
  if (parsed.success) {
    if (parsed.data.id && parsed.data.id.trim().length > 0) {
      return parsed.data.id.trim();
    }
    const selfLink = parsed.data.links?.find((l) => l.rel === 'self')?.href;
    if (selfLink) {
      const lastSegment = selfLink.split('/').filter(Boolean).pop();
      if (lastSegment) {
        return lastSegment;
      }
    }
  }
  if (locationHeader) {
    const lastSegment = locationHeader.split('/').filter(Boolean).pop();
    if (lastSegment) {
      return lastSegment;
    }
  }
  return null;
}

/**
 * Step 1: Official PayPal OAuth 2.0 Client Credentials token exchange
 * POST https://api-m.sandbox.paypal.com/v1/oauth2/token
 */
export async function requestPayPalSandboxToken(
  env: SandboxProofEnv,
  fetchImpl: typeof fetch = fetch
): Promise<{ accessToken: string; proof: RedactedOAuthProof }> {
  const baseUrl = env.baseUrl ?? PAYPAL_SANDBOX_BASE_URL;
  const credentials = Buffer.from(`${env.clientId}:${env.clientSecret}`, 'utf8').toString('base64');

  const response = await fetchImpl(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Accept-Language': 'en_US',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const rawBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorCode =
      typeof rawBody === 'object' && rawBody !== null && 'error' in rawBody
        ? String((rawBody as Record<string, unknown>).error)
        : `HTTP_${response.status}`;
    const errorDesc =
      typeof rawBody === 'object' && rawBody !== null && 'error_description' in rawBody
        ? String((rawBody as Record<string, unknown>).error_description)
        : 'PayPal Sandbox OAuth token request failed';
    throw new Error(
      sanitizeErrorMessage(
        `OAuth failed with HTTP ${response.status} (${errorCode}): ${errorDesc}`,
        [env.clientId, env.clientSecret]
      )
    );
  }

  const parsed = PayPalOAuthResponseSchema.parse(rawBody);
  const scopes = parsed.scope ? parsed.scope.split(/\s+/).filter(Boolean) : [];

  return {
    accessToken: parsed.access_token,
    proof: {
      httpStatus: response.status,
      tokenType: parsed.token_type,
      expiresIn: parsed.expires_in,
      redactedTokenPreview: redactSecret(parsed.access_token),
      appId: parsed.app_id,
      scopeCount: scopes.length
    }
  };
}

/**
 * Step 2: Official PayPal Invoicing v2 Create Draft Invoice
 * POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices
 */
export async function createPayPalSandboxDraftInvoice(
  accessToken: string,
  env: SandboxProofEnv,
  fetchImpl: typeof fetch = fetch
): Promise<DraftInvoiceProof> {
  const baseUrl = env.baseUrl ?? PAYPAL_SANDBOX_BASE_URL;
  const invoiceDate = new Date().toISOString().slice(0, 10);
  const invoiceNumber = `IP-SBX-${Date.now().toString().slice(-6)}`;
  const requestId = crypto.randomUUID();

  const payload: Record<string, unknown> = {
    detail: {
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      currency_code: 'USD',
      note: 'InvoicePilot Stage 02 automated PayPal Sandbox verification draft.',
      payment_term: {
        term_type: 'DUE_ON_RECEIPT'
      }
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: 'Sandbox',
            surname: 'Buyer'
          },
          email_address: env.recipientEmail
        }
      }
    ],
    items: [
      {
        name: 'Stage 02 Sandbox Verification Service',
        description: 'Automated verification line item',
        quantity: '1',
        unit_amount: {
          currency_code: 'USD',
          value: '25.00'
        }
      }
    ]
  };

  if (env.invoicerEmail) {
    payload.invoicer = {
      email_address: env.invoicerEmail
    };
  }

  const response = await fetchImpl(`${baseUrl}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'PayPal-Request-Id': requestId
    },
    body: JSON.stringify(payload)
  });

  const debugId = response.headers.get('paypal-debug-id') ?? undefined;
  const rawBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errName =
      typeof rawBody === 'object' && rawBody !== null && 'name' in rawBody
        ? String((rawBody as Record<string, unknown>).name)
        : `HTTP_${response.status}`;
    const errMsg =
      typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
        ? String((rawBody as Record<string, unknown>).message)
        : 'Create draft invoice failed';
    throw new Error(
      sanitizeErrorMessage(
        `Create draft failed with HTTP ${response.status} (${errName}): ${errMsg}${debugId ? ` [paypal-debug-id: ${debugId}]` : ''}`,
        [accessToken, env.clientId, env.clientSecret]
      )
    );
  }

  const invoiceId = extractInvoiceId(rawBody, response.headers.get('location'));
  if (!invoiceId) {
    throw new Error('Create draft returned 2xx but no provider invoice ID could be extracted.');
  }

  return {
    httpStatus: response.status,
    providerInvoiceId: invoiceId,
    invoiceNumber,
    currencyCode: 'USD',
    totalValue: '25.00',
    paypalDebugId: debugId
  };
}

/**
 * Step 3 / Step 5: Official PayPal Invoicing v2 Retrieve Invoice
 * GET https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}
 */
export async function retrievePayPalSandboxInvoice(
  accessToken: string,
  invoiceId: string,
  env: SandboxProofEnv,
  fetchImpl: typeof fetch = fetch
): Promise<RetrievedInvoiceProof> {
  const baseUrl = env.baseUrl ?? PAYPAL_SANDBOX_BASE_URL;
  const response = await fetchImpl(
    `${baseUrl}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    }
  );

  const debugId = response.headers.get('paypal-debug-id') ?? undefined;
  const rawBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errName =
      typeof rawBody === 'object' && rawBody !== null && 'name' in rawBody
        ? String((rawBody as Record<string, unknown>).name)
        : `HTTP_${response.status}`;
    throw new Error(
      sanitizeErrorMessage(
        `Retrieve invoice failed with HTTP ${response.status} (${errName})${debugId ? ` [paypal-debug-id: ${debugId}]` : ''}`,
        [accessToken, env.clientId, env.clientSecret]
      )
    );
  }

  const parsed = PayPalInvoiceResourceSchema.parse(rawBody);
  const recipientViewUrl = parsed.detail?.metadata?.recipient_view_url;

  return {
    httpStatus: response.status,
    providerInvoiceId: parsed.id ?? invoiceId,
    providerStatus: parsed.status ?? 'UNKNOWN',
    invoiceNumber: parsed.detail?.invoice_number,
    currencyCode: parsed.amount?.currency_code ?? parsed.detail?.currency_code,
    amountValue: parsed.amount?.value,
    recipientViewUrlPresent: Boolean(recipientViewUrl),
    paypalDebugId: debugId
  };
}

/**
 * Step 4: Official PayPal Invoicing v2 Send Invoice
 * POST https://api-m.sandbox.paypal.com/v2/invoicing/invoices/{invoice_id}/send
 */
export async function sendPayPalSandboxInvoice(
  accessToken: string,
  invoiceId: string,
  env: SandboxProofEnv,
  fetchImpl: typeof fetch = fetch
): Promise<SendInvoiceProof> {
  const baseUrl = env.baseUrl ?? PAYPAL_SANDBOX_BASE_URL;
  const requestId = crypto.randomUUID();

  const response = await fetchImpl(
    `${baseUrl}/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'PayPal-Request-Id': requestId
      },
      body: JSON.stringify({
        send_to_recipient: true,
        send_to_invoicer: false
      })
    }
  );

  const debugId = response.headers.get('paypal-debug-id') ?? undefined;
  const rawBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errName =
      typeof rawBody === 'object' && rawBody !== null && 'name' in rawBody
        ? String((rawBody as Record<string, unknown>).name)
        : `HTTP_${response.status}`;
    const errMsg =
      typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
        ? String((rawBody as Record<string, unknown>).message)
        : 'Send invoice failed';
    throw new Error(
      sanitizeErrorMessage(
        `Send invoice failed with HTTP ${response.status} (${errName}): ${errMsg}${debugId ? ` [paypal-debug-id: ${debugId}]` : ''}`,
        [accessToken, env.clientId, env.clientSecret]
      )
    );
  }

  const parsed = PayPalInvoiceResourceSchema.safeParse(rawBody);
  const hasHref =
    parsed.success && Boolean(parsed.data.links?.some((l) => Boolean(l.href)));

  return {
    httpStatus: response.status,
    providerInvoiceId: invoiceId,
    recipientViewLinkPresent: hasHref,
    paypalDebugId: debugId
  };
}

/**
 * Executes the full Stage 02 PayPal Sandbox verification sequence.
 * Stops at the first failing or blocked step without fabricating success.
 */
export async function runSandboxVerification(
  env: SandboxProofEnv = resolveSandboxProofEnv(),
  fetchImpl: typeof fetch = fetch
): Promise<SandboxVerificationReport> {
  const hasCredentials = env.clientId.length > 0 && env.clientSecret.length > 0;
  const report: SandboxVerificationReport = {
    timestamp: new Date().toISOString(),
    baseUrl: env.baseUrl ?? PAYPAL_SANDBOX_BASE_URL,
    paypalMode: env.paypalMode,
    credentialsConfigured: hasCredentials,
    steps: {
      oauthToken: {
        status: 'BLOCKED_MISSING_CREDENTIALS',
        detail: 'Not run'
      },
      createDraft: {
        status: 'NOT_RUN',
        detail: 'Skipped until OAuth token succeeds'
      },
      retrieveDraft: {
        status: 'NOT_RUN',
        detail: 'Skipped until draft creation succeeds'
      },
      sendInvoice: {
        status: 'NOT_RUN',
        detail: 'Skipped until draft retrieval succeeds'
      },
      retrievePostSend: {
        status: 'NOT_RUN',
        detail: 'Skipped until invoice send succeeds'
      }
    }
  };

  if (!hasCredentials) {
    report.steps.oauthToken = {
      status: 'BLOCKED_MISSING_CREDENTIALS',
      detail:
        'PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET are not set in local .env or server environment. Cannot execute live PayPal Sandbox call without credentials.'
    };
    return report;
  }

  let accessToken = '';
  try {
    const tokenResult = await requestPayPalSandboxToken(env, fetchImpl);
    accessToken = tokenResult.accessToken;
    report.steps.oauthToken = {
      status: 'PASSED',
      detail: `Acquired Sandbox OAuth token (${tokenResult.proof.tokenType}, expires_in=${tokenResult.proof.expiresIn}s)`,
      evidence: tokenResult.proof
    };
  } catch (err) {
    report.steps.oauthToken = {
      status: 'FAILED',
      detail: err instanceof Error ? err.message : 'Unknown OAuth failure'
    };
    return report;
  }

  let invoiceId = '';
  try {
    const draftProof = await createPayPalSandboxDraftInvoice(accessToken, env, fetchImpl);
    invoiceId = draftProof.providerInvoiceId;
    report.steps.createDraft = {
      status: 'PASSED',
      detail: `Created draft invoice ${invoiceId} (${draftProof.currencyCode} ${draftProof.totalValue})`,
      evidence: draftProof
    };
  } catch (err) {
    report.steps.createDraft = {
      status: 'FAILED',
      detail: err instanceof Error ? err.message : 'Unknown create draft failure'
    };
    return report;
  }

  try {
    const retrieveDraftProof = await retrievePayPalSandboxInvoice(
      accessToken,
      invoiceId,
      env,
      fetchImpl
    );
    report.steps.retrieveDraft = {
      status: 'PASSED',
      detail: `Retrieved draft invoice ${retrieveDraftProof.providerInvoiceId} with status=${retrieveDraftProof.providerStatus}`,
      evidence: retrieveDraftProof
    };
  } catch (err) {
    report.steps.retrieveDraft = {
      status: 'FAILED',
      detail: err instanceof Error ? err.message : 'Unknown retrieve draft failure'
    };
    return report;
  }

  try {
    const sendProof = await sendPayPalSandboxInvoice(accessToken, invoiceId, env, fetchImpl);
    report.steps.sendInvoice = {
      status: 'PASSED',
      detail: `Sent Sandbox invoice ${sendProof.providerInvoiceId} (HTTP ${sendProof.httpStatus})`,
      evidence: sendProof
    };
  } catch (err) {
    report.steps.sendInvoice = {
      status: 'FAILED',
      detail: err instanceof Error ? err.message : 'Unknown send invoice failure'
    };
    return report;
  }

  try {
    const postSendProof = await retrievePayPalSandboxInvoice(
      accessToken,
      invoiceId,
      env,
      fetchImpl
    );
    report.steps.retrievePostSend = {
      status: 'PASSED',
      detail: `Retrieved post-send invoice ${postSendProof.providerInvoiceId} with status=${postSendProof.providerStatus}`,
      evidence: postSendProof
    };
  } catch (err) {
    report.steps.retrievePostSend = {
      status: 'FAILED',
      detail: err instanceof Error ? err.message : 'Unknown post-send retrieval failure'
    };
  }

  return report;
}
