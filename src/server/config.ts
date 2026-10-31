import { z } from 'zod';
import { loadDotEnvFileIfExists } from './paypal/sandboxProof.js';

/**
 * Validated server configuration.
 * Enforces explicit PayPal mode separation ('sandbox' vs 'mock').
 * Never silently falls back to mock or live, and never exposes secrets.
 */
export const PayPalModeSchema = z.enum(['sandbox', 'mock']);
export type PayPalMode = z.infer<typeof PayPalModeSchema>;

export interface AppConfig {
  appEnv: 'development' | 'test' | 'production';
  port: number;
  appBaseUrl: string;
  databaseUrl: string;
  paypalMode: PayPalMode;
  authProvider: string;
  paypalClientId: string;
  paypalClientSecret: string;
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

  const port = Number.parseInt(merged.PORT ?? '3000', 10);
  const safePort = Number.isFinite(port) && port > 0 ? port : 3000;

  const timeoutMs = Number.parseInt(merged.PAYPAL_TIMEOUT_MS ?? '15000', 10);
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs >= 100 ? timeoutMs : 15000;

  const defaultDbPath =
    appEnv === 'test' ? 'data/invoicepilot.test.db' : 'data/invoicepilot.db';
  const databaseUrl = (merged.DATABASE_URL ?? '').trim() || defaultDbPath;

  return {
    appEnv,
    port: safePort,
    appBaseUrl: (merged.APP_BASE_URL ?? `http://localhost:${safePort}`).trim(),
    databaseUrl,
    paypalMode: modeResult.data,
    authProvider: (merged.AUTH_PROVIDER ?? 'session').trim() || 'session',
    paypalClientId: (merged.PAYPAL_CLIENT_ID ?? '').trim(),
    paypalClientSecret: (merged.PAYPAL_CLIENT_SECRET ?? '').trim(),
    paypalInvoicerEmail: (merged.PAYPAL_SANDBOX_INVOICER_EMAIL ?? '').trim() || undefined,
    paypalRecipientEmail:
      (merged.PAYPAL_SANDBOX_RECIPIENT_EMAIL ?? '').trim() ||
      'sb-buyer-invoicepilot@personal.example.com',
    paypalTimeoutMs: safeTimeoutMs
  };
}
