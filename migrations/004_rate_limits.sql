-- InvoicePilot - Supabase PostgreSQL Migration 004
-- Adds shared rate_limits table for distributed rate limiting across serverless instances.

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1 CHECK (count >= 0),
  reset_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

INSERT INTO schema_migrations (version, name, applied_at)
VALUES (4, '004_rate_limits', NOW())
ON CONFLICT (version) DO NOTHING;
