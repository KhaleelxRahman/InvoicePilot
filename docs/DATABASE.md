# Database Design

## Status
Implemented and verified in Stage 04 (`2026-10-31`) using on-disk SQLite (`node:sqlite` `DatabaseSync` with WAL journaling and `PRAGMA foreign_keys = ON`) in `src/server/db/schema.ts` and `src/server/db/repository.ts`. Tested via `tests/unit/persistence.test.ts` (6/6 passed).

## Stage 04 Implemented Schema & Money Representation
- **Database Engine:** On-disk SQLite (`data/invoicepilot.db` in development/production, `data/invoicepilot.test.db` or isolated temp `.sqlite` files in tests).
- **Money & Currency Representation (`CURRENCY_EXPONENTS`):**
  - All monetary values (`subtotal_minor`, `tax_minor`, `total_minor`, `unit_amount_minor`, `line_total_minor`, `max_invoice_amount_minor`) are stored as exact integer minor units (`INTEGER` in SQLite).
  - Explicit 3-letter ISO currency codes (`currency_code`) are stored on both `invoices` and `invoice_items` and enforced to match by server validation.
  - Currency exponents are explicitly mapped (`USD`, `EUR`, `GBP`, `CAD`, `AUD`, `INR`, `SGD` = exponent `2`; `JPY` = exponent `0`) via `parseDecimalToMinorUnits` and `formatMinorUnitsToDecimal`.
- **Tables & Constraints Implemented (`v1 — 001_initial_invoicepilot_schema`):**
  - `schema_migrations`, `users` (with `is_demo` flag), `settings`, `paypal_connections`, `clients` (`UNIQUE(owner_user_id, email)`), `invoices` (`UNIQUE(owner_user_id, invoice_number)`, partial unique index on `(provider_mode, provider_invoice_id)`, separate `local_status` and `provider_status`), `invoice_items` (`CHECK (line_total_minor = quantity * unit_amount_minor)`), `pending_actions` (`UNIQUE(idempotency_key)`), `reminders`, `chat_threads`, `chat_messages`, `activity_log`, `webhook_events` (`UNIQUE(provider_event_id)`), and `notifications`.
- **Deterministic Demo Seed & Isolation (`resetAndSeedDemoTenant`):**
  - Deletes only rows where `users.is_demo = 1` (cascading strictly to demo-owned records) and seeds `usr_demo_tenant_01` (`demo.freelancer@invoicepilot.local`) with 2 synthetic clients and 1 draft invoice. Real user records (`is_demo = 0`) are never touched.

## Expected entities
| Entity | Purpose | Key rules |
|---|---|---|
| users | Authenticated identities | Provider identity; never store plaintext passwords |
| settings | User/business preferences and safety limits | Owner-scoped; validate limits server-side |
| paypal_connections | Connection metadata | Never store secrets in browser-accessible fields |
| clients | Customer/business contact records | Owner-scoped; validate fields; minimize personal data |
| invoices | Local invoice representation and provider mapping | Explicit currency; safe amount representation; provider ID; local/provider status separation |
| reminders | Reminder drafts and delivery lifecycle | Approval state and delivery evidence |
| pending_actions | Actions awaiting user approval | Owner, expiry/staleness, action type, validated payload hash/state |
| chat_threads | Conversation metadata | Owner-scoped |
| chat_messages | Conversation records | Avoid storing secrets; apply retention policy |
| activity_log | Auditable business actions | Append-oriented; actor, action, result, timestamp, related record |
| webhook_events | Verified provider event processing | Idempotency key/event ID; verification result; processing status |
| notifications | User-visible updates | Owner-scoped, read state, timestamps |

## Data integrity requirements
- Use integer minor units or an appropriate exact decimal type for money; document currency exponent handling.
- Store currency on each invoice and line item where required.
- Validate line item quantities, prices, taxes, totals, and rounding on the server.
- Enforce record ownership on every read and mutation.
- Do not accept browser-supplied provider status as authoritative.
- Preserve provider invoice IDs and relevant timestamps.
- Use unique constraints/idempotency keys for webhook events and action execution where possible.
- Use transactions for multi-record state transitions when supported.
- Define deletion/export behavior and retention limits.
- Seed demo data deterministically; reset only demo-owned data.

## Schema design checklist
- [x] Primary/foreign keys
- [x] Owner/tenant keys and authorization indexes
- [x] Unique provider IDs in appropriate scope
- [x] Created/updated timestamps
- [x] Status enums or constrained values
- [x] Amount and currency representation documented
- [x] Migration strategy
- [x] Seed and demo reset scripts
- [ ] Backup/deletion/export behavior (API/UI surfaces scheduled for Stage 09/14)
- [x] Tests for cross-user access denial (`tests/unit/persistence.test.ts`)
