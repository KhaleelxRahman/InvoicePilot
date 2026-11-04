-- InvoicePilot - Supabase PostgreSQL Migration 002
-- Adds operational completion flag and completion timestamp to invoices table.
-- Operational completion is distinct from payment or sending status.

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;