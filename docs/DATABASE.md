# Database Design

## Status
Logical inventory only. Exact schema and migrations must follow inspection and the selected database. Do not treat this as an implemented schema.

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
- [ ] Primary/foreign keys
- [ ] Owner/tenant keys and authorization indexes
- [ ] Unique provider IDs in appropriate scope
- [ ] Created/updated timestamps
- [ ] Status enums or constrained values
- [ ] Amount and currency representation documented
- [ ] Migration strategy
- [ ] Seed and demo reset scripts
- [ ] Backup/deletion/export behavior
- [ ] Tests for cross-user access denial
