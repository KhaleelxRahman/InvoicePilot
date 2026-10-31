import crypto from 'node:crypto';
import type { PayPalMode } from '../config.js';
import {
  extractInvoiceId,
  PAYPAL_SANDBOX_BASE_URL,
  PayPalInvoiceResourceSchema,
  PayPalOAuthResponseSchema,
  redactSecret,
  sanitizeErrorMessage
} from './sandboxProof.js';

/**
 * Provider-confirmed invoice status returned by the PayPal adapter.
 * Kept strictly distinct from local application draft/approval status.
 */
export type ProviderConfirmedStatus =
  | 'DRAFT'
  | 'SENT'
  | 'UNPAID'
  | 'PAID'
  | 'MARKED_AS_PAID'
  | 'CANCELLED'
  | 'UNKNOWN';

export type PayPalAdapterErrorCode =
  | 'CREDENTIALS_MISSING'
  | 'AUTH_FAILED'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT_RECONCILE_REQUIRED'
  | 'PROVIDER_ERROR';

export interface PayPalAdapterError {
  code: PayPalAdapterErrorCode;
  message: string;
  retryableAfterReconcile: boolean;
  reconcileRequired: boolean;
  httpStatus?: number;
  paypalDebugId?: string;
}

export interface AdapterLineItemInput {
  name: string;
  description?: string;
  quantity: string;
  unitAmountValue: string;
  currencyCode: string;
}

export interface CreateDraftAdapterInput {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  currencyCode: string;
  recipientEmail: string;
  recipientGivenName?: string;
  recipientSurname?: string;
  invoicerEmail?: string;
  note?: string;
  items: AdapterLineItemInput[];
  idempotencyKey?: string;
}

export interface SendInvoiceAdapterInput {
  providerInvoiceId: string;
  sendToRecipient?: boolean;
  sendToInvoicer?: boolean;
  idempotencyKey?: string;
}

export interface ProviderInvoiceSnapshot {
  providerInvoiceId: string;
  providerStatus: ProviderConfirmedStatus;
  invoiceNumber?: string;
  currencyCode: string;
  totalValue: string;
  recipientEmail?: string;
  recipientViewUrl?: string;
  invoicerViewUrl?: string;
  paypalDebugId?: string;
}

export interface OAuthVerifySnapshot {
  tokenType: string;
  expiresIn: number;
  redactedTokenPreview: string;
  appId?: string;
  scopeCount: number;
}

/**
 * Common internal response contract for both Sandbox and Mock adapters.
 * Every response explicitly carries `mode`, `isMock`, and `modeLabel` so mock responses
 * can never be mistaken for real PayPal Sandbox responses.
 */
export type PayPalAdapterResult<T> =
  | {
      ok: true;
      mode: PayPalMode;
      isMock: boolean;
      modeLabel: string;
      data: T;
    }
  | {
      ok: false;
      mode: PayPalMode;
      isMock: boolean;
      modeLabel: string;
      error: PayPalAdapterError;
    };

export interface PayPalAdapter {
  readonly mode: PayPalMode;
  readonly isMock: boolean;
  readonly modeLabel: string;
  verifyOAuthToken(): Promise<PayPalAdapterResult<OAuthVerifySnapshot>>;
  createDraftInvoice(
    input: CreateDraftAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>>;
  retrieveInvoice(
    providerInvoiceId: string
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>>;
  sendInvoice(
    input: SendInvoiceAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>>;
}

export interface PayPalAdapterOptions {
  mode: PayPalMode;
  clientId?: string;
  clientSecret?: string;
  invoicerEmail?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const SANDBOX_MODE_LABEL = 'PayPal Sandbox Mode (Live Sandbox API — No Real Money)';
const MOCK_MODE_LABEL = 'ISOLATED MOCK MODE (Simulated — Not Sent to PayPal)';

function normalizeProviderStatus(raw: string | undefined): ProviderConfirmedStatus {
  const upper = (raw ?? '').trim().toUpperCase();
  if (
    upper === 'DRAFT' ||
    upper === 'SENT' ||
    upper === 'UNPAID' ||
    upper === 'PAID' ||
    upper === 'MARKED_AS_PAID' ||
    upper === 'CANCELLED'
  ) {
    return upper;
  }
  return 'UNKNOWN';
}

function calculateItemsTotal(items: AdapterLineItemInput[]): string {
  let totalMinor = 0;
  for (const item of items) {
    const qty = Number.parseFloat(item.quantity);
    const unit = Number.parseFloat(item.unitAmountValue);
    if (Number.isFinite(qty) && Number.isFinite(unit)) {
      totalMinor += Math.round(qty * unit * 100);
    }
  }
  return (totalMinor / 100).toFixed(2);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('PAYPAL_REQUEST_TIMEOUT')), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractNetworkErrorDetail(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Network error during PayPal Sandbox request';
  }
  const cause =
    'cause' in err && err.cause instanceof Error
      ? ` (${err.cause.name}: ${err.cause.message})`
      : '';
  return `${err.message}${cause}`;
}

function isAbortOrTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false;
  }
  const name = 'name' in err ? String((err as { name?: unknown }).name) : '';
  const message = 'message' in err ? String((err as { message?: unknown }).message) : '';
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    message.includes('PAYPAL_REQUEST_TIMEOUT') ||
    message.toLowerCase().includes('aborted') ||
    message.toLowerCase().includes('timeout')
  );
}

/**
 * Isolated Mock Adapter.
 * Uses `MOCK-LOCAL-...` IDs that never resemble PayPal's `INV2-...` format.
 * Never performs network requests or touches real credentials.
 */
export class MockPayPalAdapter implements PayPalAdapter {
  public readonly mode: PayPalMode = 'mock';
  public readonly isMock = true;
  public readonly modeLabel = MOCK_MODE_LABEL;

  private readonly store = new Map<string, ProviderInvoiceSnapshot>();
  private counter = 0;

  public async verifyOAuthToken(): Promise<PayPalAdapterResult<OAuthVerifySnapshot>> {
    return {
      ok: true,
      mode: 'mock',
      isMock: true,
      modeLabel: this.modeLabel,
      data: {
        tokenType: 'MockBearer',
        expiresIn: 3600,
        redactedTokenPreview: 'MOCK...[REDACTED len=16]',
        appId: 'MOCK-APP-ISOLATED',
        scopeCount: 1
      }
    };
  }

  public async createDraftInvoice(
    input: CreateDraftAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    if (!input.items || input.items.length === 0) {
      return {
        ok: false,
        mode: 'mock',
        isMock: true,
        modeLabel: this.modeLabel,
        error: {
          code: 'VALIDATION_ERROR',
          message: '[MOCK MODE] At least one invoice line item is required.',
          retryableAfterReconcile: false,
          reconcileRequired: false,
          httpStatus: 400
        }
      };
    }

    this.counter += 1;
    const suffix = String(this.counter).padStart(4, '0');
    const mockId = `MOCK-LOCAL-${suffix}`;
    const totalValue = calculateItemsTotal(input.items);

    const snapshot: ProviderInvoiceSnapshot = {
      providerInvoiceId: mockId,
      providerStatus: 'DRAFT',
      invoiceNumber: input.invoiceNumber,
      currencyCode: input.currencyCode,
      totalValue,
      recipientEmail: input.recipientEmail,
      recipientViewUrl: `http://localhost:3000/mock-pay/${mockId}`,
      invoicerViewUrl: `http://localhost:3000/mock-invoices/${mockId}`
    };

    this.store.set(mockId, snapshot);

    return {
      ok: true,
      mode: 'mock',
      isMock: true,
      modeLabel: this.modeLabel,
      data: { ...snapshot }
    };
  }

  public async retrieveInvoice(
    providerInvoiceId: string
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    const existing = this.store.get(providerInvoiceId);
    if (!existing) {
      return {
        ok: false,
        mode: 'mock',
        isMock: true,
        modeLabel: this.modeLabel,
        error: {
          code: 'NOT_FOUND',
          message: `[MOCK MODE] Simulated invoice "${providerInvoiceId}" was not found.`,
          retryableAfterReconcile: false,
          reconcileRequired: false,
          httpStatus: 404
        }
      };
    }

    return {
      ok: true,
      mode: 'mock',
      isMock: true,
      modeLabel: this.modeLabel,
      data: { ...existing }
    };
  }

  public async sendInvoice(
    input: SendInvoiceAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    const existing = this.store.get(input.providerInvoiceId);
    if (!existing) {
      return {
        ok: false,
        mode: 'mock',
        isMock: true,
        modeLabel: this.modeLabel,
        error: {
          code: 'NOT_FOUND',
          message: `[MOCK MODE] Simulated invoice "${input.providerInvoiceId}" was not found.`,
          retryableAfterReconcile: false,
          reconcileRequired: false,
          httpStatus: 404
        }
      };
    }

    const updated: ProviderInvoiceSnapshot = {
      ...existing,
      providerStatus: 'SENT'
    };
    this.store.set(input.providerInvoiceId, updated);

    return {
      ok: true,
      mode: 'mock',
      isMock: true,
      modeLabel: this.modeLabel,
      data: { ...updated }
    };
  }
}

/**
 * Real PayPal Sandbox Adapter (`https://api-m.sandbox.paypal.com`).
 * Enforces timeouts, secret redaction, and no blind retry on consequential mutations.
 */
export class SandboxPayPalAdapter implements PayPalAdapter {
  public readonly mode: PayPalMode = 'sandbox';
  public readonly isMock = false;
  public readonly modeLabel = SANDBOX_MODE_LABEL;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly invoicerEmail?: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: PayPalAdapterOptions) {
    this.clientId = (options.clientId ?? '').trim();
    this.clientSecret = (options.clientSecret ?? '').trim();
    this.invoicerEmail = options.invoicerEmail?.trim() || undefined;
    this.baseUrl = (options.baseUrl ?? PAYPAL_SANDBOX_BASE_URL).trim();
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private missingCredentialsResult<T>(): PayPalAdapterResult<T> {
    return {
      ok: false,
      mode: 'sandbox',
      isMock: false,
      modeLabel: this.modeLabel,
      error: {
        code: 'CREDENTIALS_MISSING',
        message:
          'PayPal Sandbox credentials (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured on the server.',
        retryableAfterReconcile: false,
        reconcileRequired: false
      }
    };
  }

  private mapHttpFailure(
    httpStatus: number,
    rawBody: unknown,
    debugId: string | undefined,
    isConsequentialMutation: boolean,
    extraSecrets: Array<string | undefined> = []
  ): PayPalAdapterError {
    const rawName =
      typeof rawBody === 'object' && rawBody !== null && 'name' in rawBody
        ? String((rawBody as Record<string, unknown>).name)
        : typeof rawBody === 'object' && rawBody !== null && 'error' in rawBody
          ? String((rawBody as Record<string, unknown>).error)
          : `HTTP_${httpStatus}`;

    const rawMsg =
      typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
        ? String((rawBody as Record<string, unknown>).message)
        : typeof rawBody === 'object' && rawBody !== null && 'error_description' in rawBody
          ? String((rawBody as Record<string, unknown>).error_description)
          : `PayPal Sandbox request failed with status ${httpStatus}`;

    const safeMessage = sanitizeErrorMessage(`${rawName}: ${rawMsg}`, [
      this.clientId,
      this.clientSecret,
      ...extraSecrets
    ]);

    if (httpStatus === 401 || httpStatus === 403) {
      return {
        code: 'AUTH_FAILED',
        message: safeMessage,
        retryableAfterReconcile: false,
        reconcileRequired: false,
        httpStatus,
        paypalDebugId: debugId
      };
    }

    if (httpStatus === 404) {
      return {
        code: 'NOT_FOUND',
        message: safeMessage,
        retryableAfterReconcile: false,
        reconcileRequired: false,
        httpStatus,
        paypalDebugId: debugId
      };
    }

    if (httpStatus === 400 || httpStatus === 422) {
      return {
        code: 'VALIDATION_ERROR',
        message: safeMessage,
        retryableAfterReconcile: false,
        reconcileRequired: false,
        httpStatus,
        paypalDebugId: debugId
      };
    }

    if (httpStatus === 429) {
      return {
        code: 'RATE_LIMITED',
        message: safeMessage,
        retryableAfterReconcile: true,
        reconcileRequired: isConsequentialMutation,
        httpStatus,
        paypalDebugId: debugId
      };
    }

    return {
      code: 'PROVIDER_ERROR',
      message: safeMessage,
      retryableAfterReconcile: httpStatus >= 500,
      reconcileRequired: isConsequentialMutation && httpStatus >= 500,
      httpStatus,
      paypalDebugId: debugId
    };
  }

  private async acquireAccessToken(): Promise<
    { ok: true; accessToken: string; snapshot: OAuthVerifySnapshot } | { ok: false; error: PayPalAdapterError }
  > {
    const basic = Buffer.from(`${this.clientId}:${this.clientSecret}`, 'utf8').toString('base64');
    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/v1/oauth2/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${basic}`,
            Accept: 'application/json',
            'Accept-Language': 'en_US',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: 'grant_type=client_credentials'
        },
        this.timeoutMs,
        this.fetchImpl
      );

      const debugId = response.headers.get('paypal-debug-id') ?? undefined;
      const rawBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          error: this.mapHttpFailure(response.status, rawBody, debugId, false)
        };
      }

      const parsed = PayPalOAuthResponseSchema.parse(rawBody);
      const scopes = parsed.scope ? parsed.scope.split(/\s+/).filter(Boolean) : [];

      return {
        ok: true,
        accessToken: parsed.access_token,
        snapshot: {
          tokenType: parsed.token_type,
          expiresIn: parsed.expires_in,
          redactedTokenPreview: redactSecret(parsed.access_token),
          appId: parsed.app_id,
          scopeCount: scopes.length
        }
      };
    } catch (err) {
      const isTimeout = isAbortOrTimeoutError(err);
      const rawMsg = extractNetworkErrorDetail(err);
      return {
        ok: false,
        error: {
          code: isTimeout ? 'TIMEOUT_RECONCILE_REQUIRED' : 'PROVIDER_ERROR',
          message: sanitizeErrorMessage(rawMsg, [this.clientId, this.clientSecret]),
          retryableAfterReconcile: true,
          reconcileRequired: false
        }
      };
    }
  }

  public async verifyOAuthToken(): Promise<PayPalAdapterResult<OAuthVerifySnapshot>> {
    if (!this.clientId || !this.clientSecret) {
      return this.missingCredentialsResult();
    }

    const tokenResult = await this.acquireAccessToken();
    if (!tokenResult.ok) {
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: tokenResult.error
      };
    }

    return {
      ok: true,
      mode: 'sandbox',
      isMock: false,
      modeLabel: this.modeLabel,
      data: tokenResult.snapshot
    };
  }

  public async createDraftInvoice(
    input: CreateDraftAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    if (!this.clientId || !this.clientSecret) {
      return this.missingCredentialsResult();
    }

    const tokenResult = await this.acquireAccessToken();
    if (!tokenResult.ok) {
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: tokenResult.error
      };
    }

    const requestId = input.idempotencyKey ?? crypto.randomUUID();
    const payload: Record<string, unknown> = {
      detail: {
        invoice_number: input.invoiceNumber,
        invoice_date: input.invoiceDate,
        currency_code: input.currencyCode,
        note: input.note ?? 'Created via InvoicePilot Sandbox Adapter',
        payment_term: input.dueDate
          ? { due_date: input.dueDate }
          : { term_type: 'DUE_ON_RECEIPT' }
      },
      primary_recipients: [
        {
          billing_info: {
            name: {
              given_name: input.recipientGivenName ?? 'Sandbox',
              surname: input.recipientSurname ?? 'Buyer'
            },
            email_address: input.recipientEmail
          }
        }
      ],
      items: input.items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit_amount: {
          currency_code: item.currencyCode,
          value: item.unitAmountValue
        }
      }))
    };

    const effectiveInvoicer = input.invoicerEmail ?? this.invoicerEmail;
    if (effectiveInvoicer) {
      payload.invoicer = { email_address: effectiveInvoicer };
    }

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/v2/invoicing/invoices`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'PayPal-Request-Id': requestId
          },
          body: JSON.stringify(payload)
        },
        this.timeoutMs,
        this.fetchImpl
      );

      const debugId = response.headers.get('paypal-debug-id') ?? undefined;
      const rawBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: this.mapHttpFailure(response.status, rawBody, debugId, true, [
            tokenResult.accessToken
          ])
        };
      }

      const invoiceId = extractInvoiceId(rawBody, response.headers.get('location'));
      if (!invoiceId) {
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: {
            code: 'PROVIDER_ERROR',
            message: 'PayPal Sandbox returned 2xx on draft create without an invoice ID.',
            retryableAfterReconcile: true,
            reconcileRequired: true,
            httpStatus: response.status,
            paypalDebugId: debugId
          }
        };
      }

      const parsed = PayPalInvoiceResourceSchema.safeParse(rawBody);
      const status = normalizeProviderStatus(
        parsed.success ? (parsed.data.status ?? 'DRAFT') : 'DRAFT'
      );

      return {
        ok: true,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        data: {
          providerInvoiceId: invoiceId,
          providerStatus: status === 'UNKNOWN' ? 'DRAFT' : status,
          invoiceNumber: input.invoiceNumber,
          currencyCode: input.currencyCode,
          totalValue: calculateItemsTotal(input.items),
          recipientEmail: input.recipientEmail,
          paypalDebugId: debugId
        }
      };
    } catch (err) {
      const isTimeout = isAbortOrTimeoutError(err);
      const rawMsg =
        err instanceof Error ? err.message : 'Network error during PayPal draft creation';
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: {
          code: isTimeout ? 'TIMEOUT_RECONCILE_REQUIRED' : 'PROVIDER_ERROR',
          message: sanitizeErrorMessage(
            isTimeout
              ? `PayPal draft creation timed out (${rawMsg}). Reconcile provider state before retrying.`
              : rawMsg,
            [this.clientId, this.clientSecret, tokenResult.accessToken]
          ),
          retryableAfterReconcile: true,
          reconcileRequired: true
        }
      };
    }
  }

  public async retrieveInvoice(
    providerInvoiceId: string
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    if (!this.clientId || !this.clientSecret) {
      return this.missingCredentialsResult();
    }

    const tokenResult = await this.acquireAccessToken();
    if (!tokenResult.ok) {
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: tokenResult.error
      };
    }

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/v2/invoicing/invoices/${encodeURIComponent(providerInvoiceId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            Accept: 'application/json'
          }
        },
        this.timeoutMs,
        this.fetchImpl
      );

      const debugId = response.headers.get('paypal-debug-id') ?? undefined;
      const rawBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: this.mapHttpFailure(response.status, rawBody, debugId, false, [
            tokenResult.accessToken
          ])
        };
      }

      const parsed = PayPalInvoiceResourceSchema.parse(rawBody);

      return {
        ok: true,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        data: {
          providerInvoiceId: parsed.id ?? providerInvoiceId,
          providerStatus: normalizeProviderStatus(parsed.status),
          invoiceNumber: parsed.detail?.invoice_number,
          currencyCode: parsed.amount?.currency_code ?? parsed.detail?.currency_code ?? 'USD',
          totalValue: parsed.amount?.value ?? '0.00',
          recipientViewUrl: parsed.detail?.metadata?.recipient_view_url,
          invoicerViewUrl: parsed.detail?.metadata?.invoicer_view_url,
          paypalDebugId: debugId
        }
      };
    } catch (err) {
      const isTimeout = isAbortOrTimeoutError(err);
      const rawMsg =
        err instanceof Error ? err.message : 'Network error during PayPal invoice retrieval';
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: {
          code: isTimeout ? 'TIMEOUT_RECONCILE_REQUIRED' : 'PROVIDER_ERROR',
          message: sanitizeErrorMessage(rawMsg, [
            this.clientId,
            this.clientSecret,
            tokenResult.accessToken
          ]),
          retryableAfterReconcile: true,
          reconcileRequired: false
        }
      };
    }
  }

  public async sendInvoice(
    input: SendInvoiceAdapterInput
  ): Promise<PayPalAdapterResult<ProviderInvoiceSnapshot>> {
    if (!this.clientId || !this.clientSecret) {
      return this.missingCredentialsResult();
    }

    const tokenResult = await this.acquireAccessToken();
    if (!tokenResult.ok) {
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: tokenResult.error
      };
    }

    const requestId = input.idempotencyKey ?? crypto.randomUUID();

    try {
      const response = await fetchWithTimeout(
        `${this.baseUrl}/v2/invoicing/invoices/${encodeURIComponent(input.providerInvoiceId)}/send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'PayPal-Request-Id': requestId
          },
          body: JSON.stringify({
            send_to_recipient: input.sendToRecipient ?? true,
            send_to_invoicer: input.sendToInvoicer ?? false
          })
        },
        this.timeoutMs,
        this.fetchImpl
      );

      const debugId = response.headers.get('paypal-debug-id') ?? undefined;
      const rawBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        return {
          ok: false,
          mode: 'sandbox',
          isMock: false,
          modeLabel: this.modeLabel,
          error: this.mapHttpFailure(response.status, rawBody, debugId, true, [
            tokenResult.accessToken
          ])
        };
      }

      // Re-fetch authoritative provider state after send
      const retrieved = await this.retrieveInvoice(input.providerInvoiceId);
      if (retrieved.ok) {
        return retrieved;
      }

      return {
        ok: true,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        data: {
          providerInvoiceId: input.providerInvoiceId,
          providerStatus: 'SENT',
          currencyCode: 'USD',
          totalValue: '0.00',
          paypalDebugId: debugId
        }
      };
    } catch (err) {
      const isTimeout = isAbortOrTimeoutError(err);
      const rawMsg =
        err instanceof Error ? err.message : 'Network error during PayPal invoice send';
      return {
        ok: false,
        mode: 'sandbox',
        isMock: false,
        modeLabel: this.modeLabel,
        error: {
          code: isTimeout ? 'TIMEOUT_RECONCILE_REQUIRED' : 'PROVIDER_ERROR',
          message: sanitizeErrorMessage(
            isTimeout
              ? `PayPal invoice send timed out (${rawMsg}). Do NOT retry blindly; retrieve invoice state first to prevent duplicate sends.`
              : rawMsg,
            [this.clientId, this.clientSecret, tokenResult.accessToken]
          ),
          retryableAfterReconcile: true,
          reconcileRequired: true
        }
      };
    }
  }
}

/**
 * Factory that creates the explicit PayPal adapter for the configured mode.
 * Never silently falls back from Sandbox to Mock or Live.
 */
export function createPayPalAdapter(options: PayPalAdapterOptions): PayPalAdapter {
  if (options.mode === 'mock') {
    return new MockPayPalAdapter();
  }
  if (options.mode === 'sandbox') {
    return new SandboxPayPalAdapter(options);
  }
  throw new Error(
    `Unsupported PayPal adapter mode "${String(options.mode)}". Only "sandbox" and "mock" are allowed.`
  );
}
