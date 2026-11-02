import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { ISqlDatabase } from './types.js';
import { createIsolatedPostgresDatabase } from './postgresAdapter.js';
import { createRealPostgresDatabase } from './postgresPoolAdapter.js';

let _DatabaseSyncClass: typeof DatabaseSync | null = null;

function getSqliteDatabaseSyncClass(): typeof DatabaseSync {
  if (_DatabaseSyncClass) {
    return _DatabaseSyncClass;
  }
  if (typeof (process as any).getBuiltinModule === 'function') {
    const mod = (process as any).getBuiltinModule('node:sqlite');
    if (mod && mod.DatabaseSync) {
      _DatabaseSyncClass = mod.DatabaseSync;
      return _DatabaseSyncClass!;
    }
  }
  try {
    const req = typeof require === 'function' ? require : undefined;
    if (req) {
      const mod = req('node:sqlite');
      if (mod && mod.DatabaseSync) {
        _DatabaseSyncClass = mod.DatabaseSync;
        return _DatabaseSyncClass!;
      }
    }
  } catch {
    // Fall through
  }
  throw new Error(
    'SQLite engine (node:sqlite) is not available in this environment. In Netlify serverless production, configure Supabase PostgreSQL via DATABASE_URL.'
  );
}

export const STAGE04_SCHEMA_VERSION = 1;
export const STAGE09_SCHEMA_VERSION = 2;
export const STAGE11_SCHEMA_VERSION = 3;
export const STAGE12_SCHEMA_VERSION = 4;
export const STAGE14_SCHEMA_VERSION = 5;
export const CURRENT_SCHEMA_VERSION = 5;

/**
 * Currency exponent map (minor units per major unit).
 * Default is 2 (e.g., USD cents, EUR cents, GBP pence, INR paise).
 * Zero-decimal currencies (e.g., JPY) have exponent 0.
 */
export const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  INR: 2,
  SGD: 2,
  JPY: 0
};

export function getCurrencyExponent(currencyCode: string): number {
  const code = currencyCode.trim().toUpperCase();
  if (!(code in CURRENCY_EXPONENTS)) {
    throw new Error(`Unsupported currency code "${currencyCode}".`);
  }
  return CURRENCY_EXPONENTS[code];
}

export function formatMinorUnitsToDecimal(amountMinor: number, currencyCode: string): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`Invalid minor unit amount: ${amountMinor}`);
  }
  const exponent = getCurrencyExponent(currencyCode);
  if (exponent === 0) {
    return String(amountMinor);
  }
  const factor = 10 ** exponent;
  const major = Math.floor(amountMinor / factor);
  const minor = String(amountMinor % factor).padStart(exponent, '0');
  return `${major}.${minor}`;
}

export function parseDecimalToMinorUnits(decimalValue: string, currencyCode: string): number {
  const exponent = getCurrencyExponent(currencyCode);
  const trimmed = decimalValue.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid decimal money string "${decimalValue}".`);
  }
  const [wholePart, fracPart = ''] = trimmed.split('.');
  if (fracPart.length > exponent) {
    throw new Error(
      `Decimal value "${decimalValue}" exceeds ${exponent} decimal places for ${currencyCode}.`
    );
  }
  const paddedFrac = fracPart.padEnd(exponent, '0');
  const minor =
    Number.parseInt(wholePart, 10) * 10 ** exponent +
    (exponent > 0 ? Number.parseInt(paddedFrac || '0', 10) : 0);
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new Error(`Parsed minor unit value is out of range for "${decimalValue}".`);
  }
  return minor;
}

export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'session',
  password_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(default_currency) = 3),
  max_invoice_amount_minor INTEGER NOT NULL DEFAULT 1000000 CHECK (max_invoice_amount_minor > 0),
  default_payment_terms_days INTEGER NOT NULL DEFAULT 14 CHECK (default_payment_terms_days >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paypal_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'mock')),
  invoicer_email TEXT,
  last_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'CONNECTED', 'ERROR')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  default_currency TEXT NOT NULL DEFAULT 'USD' CHECK (length(default_currency) = 3),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_owner_email ON clients(owner_user_id, email);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
  subtotal_minor INTEGER NOT NULL CHECK (subtotal_minor >= 0),
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  tax_minor INTEGER NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor INTEGER NOT NULL CHECK (total_minor >= 0 AND total_minor = subtotal_minor + tax_minor),
  paid_amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  notes TEXT,
  local_status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
    local_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED', 'FAILED')
  ),
  provider_mode TEXT NOT NULL DEFAULT 'sandbox' CHECK (provider_mode IN ('sandbox', 'mock')),
  provider_invoice_id TEXT,
  provider_status TEXT NOT NULL DEFAULT 'NONE' CHECK (
    provider_status IN ('NONE', 'DRAFT', 'SENT', 'UNPAID', 'PAID', 'MARKED_AS_PAID', 'CANCELLED', 'UNKNOWN')
  ),
  provider_recipient_view_url TEXT,
  provider_invoicer_view_url TEXT,
  last_provider_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (owner_user_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_owner ON invoices(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(owner_user_id, client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_provider_id
  ON invoices(provider_mode, provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
  line_total_minor INTEGER NOT NULL CHECK (line_total_minor = quantity * unit_amount_minor),
  currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_owner ON invoice_items(owner_user_id);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('SEND_INVOICE', 'SEND_REMINDER')),
  target_invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'DRAFTED' CHECK (
    state IN (
      'DRAFTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'EXECUTING',
      'EXECUTED',
      'REJECTED',
      'EXPIRED',
      'FAILED',
      'CANCELLED'
    )
  ),
  payload_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  approved_at TEXT,
  executed_at TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_owner ON pending_actions(owner_user_id, state);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'polite' CHECK (tone IN ('polite', 'firm', 'final')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  approval_state TEXT NOT NULL DEFAULT 'DRAFTED' CHECK (
    approval_state IN ('DRAFTED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENT', 'REJECTED', 'FAILED')
  ),
  scheduled_for TEXT,
  sent_at TEXT,
  delivery_evidence TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_user_id, invoice_id);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_owner ON chat_threads(owner_user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'provider', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'INFO')),
  detail_json TEXT NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_log_owner ON activity_log(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'REJECTED')),
  processing_status TEXT NOT NULL CHECK (processing_status IN ('PROCESSED', 'IGNORED', 'FAILED')),
  related_provider_invoice_id TEXT,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice ON webhook_events(related_provider_invoice_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_user_id, is_read);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
  currency_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_owner ON invoice_templates(owner_user_id);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  business_name TEXT,
  business_email TEXT,
  default_currency TEXT DEFAULT 'USD',
  max_invoice_amount_minor INTEGER DEFAULT 1000000,
  default_reminder_tone TEXT DEFAULT 'polite' CHECK (default_reminder_tone IN ('polite', 'firm', 'final')),
  sandbox_tested INTEGER NOT NULL DEFAULT 0 CHECK (sandbox_tested IN (0, 1)),
  first_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);
`;

/**
 * Determines whether a database connection string targets PostgreSQL / Supabase.
 */
export function isPostgresDatabaseUrl(url: string): boolean {
  const trimmed = (url || '').trim().toLowerCase();
  return (
    trimmed.startsWith('postgres://') ||
    trimmed.startsWith('postgresql://') ||
    trimmed.startsWith('supabase://') ||
    trimmed === ':memory-postgres:'
  );
}

/**
 * Opens and migrates a database instance.
 * Automatically selects PostgreSQL adapter for Supabase / PostgreSQL URLs,
 * and on-disk SQLite for local development and local test suites.
 */
export function openAndMigrateDatabase(dbFilePath: string): any {
  if (dbFilePath === ':memory-postgres:') {
    return createIsolatedPostgresDatabase();
  }

  if (isPostgresDatabaseUrl(dbFilePath)) {
    return createRealPostgresDatabase(dbFilePath);
  }

  const isNetlify = Boolean(
    process.env.NETLIFY === 'true' ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  if (isNetlify && !isPostgresDatabaseUrl(dbFilePath)) {
    throw new Error(
      'SQLite database is not permitted in Netlify serverless functions. Supabase PostgreSQL connection string (DATABASE_URL) is required.'
    );
  }

  const resolvedPath = path.resolve(process.cwd(), dbFilePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  const DatabaseSyncClass = getSqliteDatabaseSyncClass();
  const db = new DatabaseSyncClass(resolvedPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(INITIAL_SCHEMA_SQL);

  const existingMigration1 = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(STAGE04_SCHEMA_VERSION) as { version: number } | undefined;

  if (!existingMigration1) {
    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(STAGE04_SCHEMA_VERSION, '001_initial_invoicepilot_schema', new Date().toISOString());
  }

  const existingMigration2 = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(STAGE09_SCHEMA_VERSION) as { version: number } | undefined;

  if (!existingMigration2) {
    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(
      STAGE09_SCHEMA_VERSION,
      '002_stage09_sessions_and_onboarding',
      new Date().toISOString()
    );
  }

  const existingMigration3 = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(STAGE11_SCHEMA_VERSION) as { version: number } | undefined;

  if (!existingMigration3) {
    // Migration 003: Reminders scheduled_for column
    try {
      db.exec('ALTER TABLE reminders ADD COLUMN scheduled_for TEXT;');
    } catch {
      // Column may already exist
    }

    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(
      STAGE11_SCHEMA_VERSION,
      '003_stage11_reminders_scheduling',
      new Date().toISOString()
    );
  }

  const existingMigration4 = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(STAGE12_SCHEMA_VERSION) as { version: number } | undefined;

  if (!existingMigration4) {
    // Migration 004: Invoices paid_amount_minor column
    try {
      db.exec('ALTER TABLE invoices ADD COLUMN paid_amount_minor INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Column may already exist
    }

    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(
      STAGE12_SCHEMA_VERSION,
      '004_stage12_invoices_paid_amount',
      new Date().toISOString()
    );
  }

  const existingMigration5 = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(STAGE14_SCHEMA_VERSION) as { version: number } | undefined;

  if (!existingMigration5) {
    // Migration 005: Invoice templates table
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoice_templates (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          unit_amount_minor INTEGER NOT NULL CHECK (unit_amount_minor >= 0),
          currency_code TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_invoice_templates_owner ON invoice_templates(owner_user_id);
      `);
    } catch {
      // Table may already exist
    }

    db.prepare(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
    ).run(
      STAGE14_SCHEMA_VERSION,
      '005_stage14_invoice_templates',
      new Date().toISOString()
    );
  }

  return db;
}
