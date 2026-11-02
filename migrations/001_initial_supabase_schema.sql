-- =============================================================================
-- InvoicePilot: Supabase Free PostgreSQL Schema Migration 001
-- Preserves all schema constraints, ownership checks, cascading deletes,
-- unique indexes, and audit tables.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'session',
  password_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_is_demo ON users(is_demo);

CREATE TABLE IF NOT EXISTS settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_email TEXT NOT NULL,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (length(default_currency) = 3),
  max_invoice_amount_minor BIGINT NOT NULL DEFAULT 1000000 CHECK (max_invoice_amount_minor > 0),
  default_payment_terms_days INTEGER NOT NULL DEFAULT 14 CHECK (default_payment_terms_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paypal_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(10) NOT NULL DEFAULT 'sandbox' CHECK (mode IN ('sandbox', 'mock')),
  invoicer_email TEXT,
  last_verified_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'CONNECTED', 'ERROR')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT NOT NULL,
  default_currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (length(default_currency) = 3),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_owner_email ON clients(owner_user_id, email);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  invoice_number TEXT NOT NULL,
  currency_code VARCHAR(3) NOT NULL CHECK (length(currency_code) = 3),
  subtotal_minor BIGINT NOT NULL CHECK (subtotal_minor >= 0),
  tax_rate_bps INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 10000),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0 AND total_minor = subtotal_minor + tax_minor),
  paid_amount_minor BIGINT NOT NULL DEFAULT 0 CHECK (paid_amount_minor >= 0),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  notes TEXT,
  local_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (
    local_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'CANCELLED', 'FAILED')
  ),
  provider_mode VARCHAR(10) NOT NULL DEFAULT 'sandbox' CHECK (provider_mode IN ('sandbox', 'mock')),
  provider_invoice_id TEXT,
  provider_status VARCHAR(20) NOT NULL DEFAULT 'NONE' CHECK (
    provider_status IN ('NONE', 'DRAFT', 'SENT', 'UNPAID', 'PAID', 'MARKED_AS_PAID', 'CANCELLED', 'UNKNOWN')
  ),
  provider_recipient_view_url TEXT,
  provider_invoicer_view_url TEXT,
  last_provider_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
  unit_amount_minor BIGINT NOT NULL CHECK (unit_amount_minor >= 0),
  line_total_minor BIGINT NOT NULL CHECK (line_total_minor = quantity * unit_amount_minor),
  currency_code VARCHAR(3) NOT NULL CHECK (length(currency_code) = 3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_owner ON invoice_items(owner_user_id);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('SEND_INVOICE', 'SEND_REMINDER')),
  target_invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  state VARCHAR(20) NOT NULL DEFAULT 'DRAFTED' CHECK (
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
  payload_json JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_owner ON pending_actions(owner_user_id, state);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  tone VARCHAR(10) NOT NULL DEFAULT 'polite' CHECK (tone IN ('polite', 'firm', 'final')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  approval_state VARCHAR(20) NOT NULL DEFAULT 'DRAFTED' CHECK (
    approval_state IN ('DRAFTED', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'SENT', 'REJECTED', 'FAILED')
  ),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivery_evidence TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_owner ON reminders(owner_user_id, invoice_id);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_threads_owner ON chat_threads(owner_user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_type VARCHAR(10) NOT NULL CHECK (actor_type IN ('user', 'agent', 'provider', 'system')),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  result VARCHAR(10) NOT NULL CHECK (result IN ('PROPOSED', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED', 'INFO')),
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_owner ON activity_log(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  verification_status VARCHAR(10) NOT NULL CHECK (verification_status IN ('VERIFIED', 'REJECTED')),
  processing_status VARCHAR(10) NOT NULL CHECK (processing_status IN ('PROCESSED', 'IGNORED', 'FAILED')),
  related_provider_invoice_id TEXT,
  payload_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_invoice ON webhook_events(related_provider_invoice_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(owner_user_id, is_read);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS invoice_templates (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  unit_amount_minor BIGINT NOT NULL CHECK (unit_amount_minor >= 0),
  currency_code VARCHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_templates_owner ON invoice_templates(owner_user_id);

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  skipped INTEGER NOT NULL DEFAULT 0 CHECK (skipped IN (0, 1)),
  business_name TEXT,
  business_email TEXT,
  default_currency VARCHAR(3) DEFAULT 'USD',
  max_invoice_amount_minor BIGINT DEFAULT 1000000,
  default_reminder_tone VARCHAR(10) DEFAULT 'polite' CHECK (default_reminder_tone IN ('polite', 'firm', 'final')),
  sandbox_tested INTEGER NOT NULL DEFAULT 0 CHECK (sandbox_tested IN (0, 1)),
  first_client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record schema migration 001
INSERT INTO schema_migrations (version, name, applied_at)
VALUES (1, '001_initial_supabase_schema', NOW())
ON CONFLICT (version) DO NOTHING;

-- Seed deterministic synthetic demo tenant (Aarav Mehta Studio)
INSERT INTO users (id, email, display_name, auth_provider, is_demo, created_at, updated_at)
VALUES (
  'usr_demo_tenant_01',
  'demo.freelancer@invoicepilot.local',
  'Aarav Mehta Studio (Demo Workspace)',
  'demo-session',
  1,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO settings (user_id, business_name, business_email, default_currency, max_invoice_amount_minor, default_payment_terms_days, created_at, updated_at)
VALUES (
  'usr_demo_tenant_01',
  'Aarav Mehta Design & Engineering',
  'demo.freelancer@invoicepilot.local',
  'USD',
  2500000,
  14,
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO clients (id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at)
VALUES
  ('cli_demo_northstar_01', 'usr_demo_tenant_01', 'Elena Vance', 'Northstar Civic Labs', 'elena.vance@northstar-demo.example.com', 'USD', 'Prefers itemized milestone breakdowns.', NOW(), NOW()),
  ('cli_demo_kestrel_02', 'usr_demo_tenant_01', 'Rohan Kulkarni', 'Kestrel Logistics Co.', 'rohan.k@kestrel-demo.example.com', 'USD', 'Net-14 terms.', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (
  id, owner_user_id, client_id, invoice_number, currency_code,
  subtotal_minor, tax_rate_bps, tax_minor, total_minor, paid_amount_minor,
  issue_date, due_date, notes, local_status, provider_mode, provider_status,
  created_at, updated_at
)
VALUES (
  'inv_demo_draft_01', 'usr_demo_tenant_01', 'cli_demo_northstar_01', 'INV-DEMO-1001', 'USD',
  200000, 500, 10000, 210000, 0,
  '2026-10-25', '2026-11-08', 'Q4 Accessibility & Ledger Design System Audit',
  'DRAFT', 'sandbox', 'NONE',
  NOW(), NOW()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoice_items (id, invoice_id, owner_user_id, position, description, quantity, unit_amount_minor, line_total_minor, currency_code, created_at)
VALUES
  ('item_demo_01', 'inv_demo_draft_01', 'usr_demo_tenant_01', 0, 'Design system architecture & token specification', 1, 120000, 120000, 'USD', NOW()),
  ('item_demo_02', 'inv_demo_draft_01', 'usr_demo_tenant_01', 1, 'Interactive approval slip prototype', 2, 40000, 80000, 'USD', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO onboarding_progress (
  user_id, current_step, completed, skipped, business_name, business_email, default_currency, max_invoice_amount_minor, default_reminder_tone, sandbox_tested, first_client_id, updated_at
)
VALUES (
  'usr_demo_tenant_01', 4, 1, 0, 'Aarav Mehta Design & Engineering', 'demo.freelancer@invoicepilot.local', 'USD', 2500000, 'polite', 1, 'cli_demo_northstar_01', NOW()
)
ON CONFLICT (user_id) DO NOTHING;
