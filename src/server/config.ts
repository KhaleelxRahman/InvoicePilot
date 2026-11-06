import { z } from 'zod';
import { loadDotEnvFileIfExists } from './paypal/sandboxProof.js';

/**
 * Validated server configuration.
 * Enforces explicit PayPal mode separation ('sandbox' vs 'mock').
 * Never silently falls back to mock or live, and never exposes secrets.
 */
export const PayPalModeSchema = z.enum(['sandbox', 'mock']);
export type PayPalMode = z.infer<typeof PayPalModeSchema>;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

const LEGACY_DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-1.5-flash'
]);

/**
 * Normalizes a configured Gemini model identifier:
 * - Strips optional leading `models/` resource prefix.
 * - Migrates empty or retired legacy Flash defaults to `DEFAULT_GEMINI_MODEL` (`gemini-3.8-flash`).
 */
export function normalizeGeminiModelId(rawModel?: string): string {
  const trimmed = (rawModel ?? '').trim().replace(/^models\//i, '');
  if (!trimmed || LEGACY_DEPRECATED_GEMINI_MODELS.has(trimmed.toLowerCase())) {
    return DEFAULT_GEMINI_MODEL;
  }
  return trimmed;
}

export interface AppConfig {
  appEnv: 'development' | 'test' | 'production';
  port: number;
  appBaseUrl: string;
  databaseUrl: string;
  paypalMode: PayPalMode;
  authProvider: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiTimeoutMs: number;
  paypalClientId: string;
  paypalClientSecret: string;
  paypalWebhookId: string;
  paypalInvoicerEmail?: string;
  paypalRecipientEmail: string;
  paypalTimeoutMs: number;
}

export function loadAppConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { loadDotEnvFile?: boolean } = {}
): AppConfig {
  const shouldLoadFile = options.loadDotEnvFile ?? env === process.env;
  const merged = shouldLoadFile ? { ...loadDotEnvFileIfExists(), ...env } : env;

  const rawMode = (merged.PAYPAL_MODE ?? 'sandbox').trim().toLowerCase();
  const modeResult = PayPalModeSchema.safeParse(rawMode);

  if (!modeResult.success) {
    throw new Error(
      `Invalid PAYPAL_MODE "${merged.PAYPAL_MODE}". Only explicit "sandbox" or "mock" modes are permitted (live money is a non-goal).`
    );
  }

  const rawEnv = (merged.APP_ENV ?? merged.NODE_ENV ?? 'development').trim().toLowerCase();
  const appEnv =
    rawEnv === 'production' || rawEnv === 'test' ? rawEnv : 'development';

  if (appEnv === 'production' && modeResult.data === 'mock') {
    throw new Error('PAYPAL_MODE=mock is not allowed when APP_ENV=production.');
  }

  const port = Number.parseInt(merged.PORT ?? '3000', 10);
  const safePort = Number.isFinite(port) && port > 0 ? port : 3000;

  const timeoutMs = Number.parseInt(merged.PAYPAL_TIMEOUT_MS ?? '15000', 10);
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 100 ? timeoutMs : 15000;

  const geminiTimeoutRaw = Number.parseInt(merged.GEMINI_TIMEOUT_MS ?? '15000', 10);
  const safeGeminiTimeoutMs =
    Number.isFinite(geminiTimeoutRaw) && geminiTimeoutRaw >= 100 ? geminiTimeoutRaw : 15000;

  const isServerless = Boolean(
    merged.VERCEL ||
    merged.NETLIFY === 'true' ||
    merged.LAMBDA_TASK_ROOT ||
    merged.AWS_LAMBDA_FUNCTION_NAME
  );

  const defaultDbPath = isServerless
    ? ''
    : appEnv === 'test'
      ? 'data/invoicepilot.test.db'
      : 'data/invoicepilot.db';
  const databaseUrl = (merged.DATABASE_URL ?? '').trim() || defaultDbPath;

  const fallbackBaseUrl = merged.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${merged.VERCEL_PROJECT_PRODUCTION_URL.trim()}`
    : merged.VERCEL_URL
      ? `https://${merged.VERCEL_URL.trim()}`
      : `http://localhost:${safePort}`;

  return {
    appEnv,
    port: safePort,
    appBaseUrl: (merged.APP_BASE_URL ?? fallbackBaseUrl).trim() || fallbackBaseUrl,
    databaseUrl,
    paypalMode: modeResult.data,
    authProvider: (merged.AUTH_PROVIDER ?? 'session').trim() || 'session',
    geminiApiKey: (merged.GEMINI_API_KEY ?? '').trim(),
    geminiModel: normalizeGeminiModelId(merged.GEMINI_MODEL),
    geminiTimeoutMs: safeGeminiTimeoutMs,
    paypalClientId: (merged.PAYPAL_CLIENT_ID ?? '').trim(),
    paypalClientSecret: (merged.PAYPAL_CLIENT_SECRET ?? '').trim(),
    paypalWebhookId: (merged.PAYPAL_WEBHOOK_ID ?? '').trim(),
    paypalInvoicerEmail: (merged.PAYPAL_SANDBOX_INVOICER_EMAIL ?? '').trim() || undefined,
    paypalRecipientEmail:
      (merged.PAYPAL_SANDBOX_RECIPIENT_EMAIL ?? '').trim() ||
      'sb-buyer-invoicepilot@personal.example.com',
    paypalTimeoutMs: safeTimeoutMs
  };
}
