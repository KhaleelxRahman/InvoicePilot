-- InvoicePilot - Supabase PostgreSQL Migration 003
-- Expands provider_status check constraint to support REFUNDED status safely for existing tables.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_provider_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_provider_status_check
  CHECK (provider_status IN ('NONE', 'DRAFT', 'SENT', 'UNPAID', 'PAID', 'MARKED_AS_PAID', 'CANCELLED', 'REFUNDED', 'UNKNOWN'));

