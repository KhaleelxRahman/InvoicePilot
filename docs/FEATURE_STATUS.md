# Feature Status Ledger

## Status definitions
- NOT STARTED — no implementation evidence found.
- IN PROGRESS — active implementation, not accepted yet.
- BLOCKED — cannot proceed until a named dependency is resolved.
- IMPLEMENTED — UNVERIFIED — code appears present, but meaningful acceptance test has not passed.
- VERIFIED — meaningful reproducible test passed and evidence recorded.
- DEFERRED — intentionally moved beyond current release, with reason.

## Initial baseline
This ledger is initialized from the supplied directive, not from an inspection of a live codebase. Audit and update Stage 0. If the actual project contains code, inspect it and update rows with evidence rather than assuming either absence or success.

| Feature | Initial status | Evidence/test | Next action |
|---|---|---|---|
| Project audit | VERIFIED | Stage 00 repository, git, runtime, and spec audit completed on 2026-10-31 (`docs/DOCUMENTATION_AUDIT.md`) | Resolve Part 6 upstream doc & stack decisions; begin Stage 1 |
| App foundation | VERIFIED | Stage 01 verified on 2026-10-31: `npm run typecheck`, `npm test` (6/6 passed), `npm run build`, and `npx playwright test` (2/2 passed on `desktop-chromium` 1280x800 and `mobile-360` 360x780 with 0 console errors) | Proceed to Stage 02 (Independent PayPal Sandbox proof) |
| PayPal OAuth Sandbox | VERIFIED | Live Sandbox OAuth token exchange (`POST /v1/oauth2/token` -> HTTP 200, `appId: APP-1DA27118FH6238323`) verified on 2026-10-31 via `npm run paypal:sandbox:verify` and Stage 03 adapter (`npm run paypal:adapter:verify`) | Proceed to Stage 04 (Persistence & ownership) |
| PayPal invoice draft/send/retrieve | VERIFIED | Live Sandbox Invoicing v2 draft create (`INV2-WHS9-X55V-Y6AJ-HAAQ` & `INV2-M6YP-NTGY-TRXS-W5FN`), draft retrieve (`DRAFT`), send (`HTTP 200`), and post-send retrieve (`SENT` with buyer view URL) verified on 2026-10-31 via `npm run paypal:sandbox:verify`, `npm run paypal:adapter:verify`, and `tests/unit/paypalAdapter.test.ts` (6/6 passed) | Integrate into persisted approval-gated workflow in Stage 06/08 |
| PayPal webhook verification | NOT STARTED | Not tested | Evaluate after core API flow |
| Gemini agent | NOT STARTED | Not verified | Inspect config and test structured output |
| Database persistence | VERIFIED | Stage 04 on-disk SQLite schema (`src/server/db/schema.ts`), repository (`src/server/db/repository.ts`), CLI scripts (`npm run db:migrate`, `npm run db:seed:demo`), and CRUD/ownership/demo-isolation tests (`tests/unit/persistence.test.ts`, 6/6 passed) verified on 2026-10-31 | Proceed to Stage 05 (Clients and conventional invoice workflow) |
| Authentication | NOT STARTED | Not verified | Inspect and test protected routes |
| Approval gate | NOT STARTED | Not verified | Implement server-enforced state machine |
| Activity log | NOT STARTED | Not verified | Implement with core flow |
| UI pages (Part 6) | NOT STARTED | Full inventory pending (`InvoicePilot_FINAL.md` absent from repo; 14 feature groups tracked below) | Supply `InvoicePilot_FINAL.md` Part 6 or confirm group baseline |
| Reminders | NOT STARTED | Not verified | Defer until core path works |
| Insights/forecast | NOT STARTED | Not verified | Implement only with grounded data/calculations |
| MCP/Agent Toolkit | NOT STARTED | No invocation verified | Evaluate after core path |
| Public repository/license | NOT STARTED | Not verified | Inspect Git status/repository |
| Deployment | NOT STARTED | Not verified | Choose after runtime audit |
| Demo video/submission | NOT STARTED | Not recorded | Complete after release verification |

## Detailed Screen & Feature Inventory (Part 6 / `FEATURE_DEVELOPMENT.md` Baseline)
Because `InvoicePilot_FINAL.md` (which defines the 26-screen Part 6 inventory) is not present in the repository, the inventory below tracks all 14 functional screen/feature groups documented in `docs/FEATURE_DEVELOPMENT.md` and `docs/PRD.md`. Once `InvoicePilot_FINAL.md` Part 6 is supplied, expand into the exact 26 screen rows.

| ID | Source section | Feature / Screen Group | Dependencies | Status | Files / Routes | Acceptance Test | Evidence | Blocker / Next Action |
|---|---|---|---|---|---|---|---|---|
| F-001 | `FEATURE_DEVELOPMENT.md` / Part 6 | Public, account, and policy pages | Stage 1 app shell | NOT STARTED | None | Render public/policy routes & verify WCAG AA contrast | None | Awaiting Stage 1 & Part 6 screen list |
| F-002 | `FEATURE_DEVELOPMENT.md` / Part 6 | Onboarding and business setup | Auth, DB persistence (`users`, `settings`) | NOT STARTED | None | Persist business profile, currency, and safety limits | None | Awaiting Stage 4 & Stage 9 |
| F-003 | `PRD.md` / `AGENT.md` / Part 6 | Home workspace and AI Agent conversation | App shell, Gemini API tool contract | NOT STARTED | `/api/agent/prepare-invoice` (proposed) | Parse NL prompt to validated draft; clarify missing fields; fallback to form | None | Awaiting Stage 1 & Stage 7 |
| F-004 | `PRD.md` / `API.md` / Part 6 | Invoices list, conventional create/edit form, and invoice detail | DB (`invoices`, `clients`), server money/tax validation | NOT STARTED | `/api/invoices`, `/api/invoices/:id` (proposed) | Create/edit/view draft without AI; verify integer minor units & currency | None | Awaiting Stage 4 & Stage 5 |
| F-005 | `PRD.md` / `UI_UX_DESIGN.md` / `AGENT.md` | Signature Approval Slip & action safety gate | `pending_actions`, state machine, `activity_log` | NOT STARTED | `/api/actions/:id/approve`, `/api/actions/:id/execute` (proposed) | Enforce `DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`; discard never sends | None | Awaiting Stage 6 |
| F-006 | `PRD.md` / `API.md` / Part 6 | Clients list and client profile CRUD | DB (`clients`), owner isolation | NOT STARTED | `/api/clients`, `/api/clients/:id` (proposed) | Create/read/update/delete owned client; cross-owner access denied | None | Awaiting Stage 4 & Stage 5 |
| F-007 | `PRD.md` / `PAYPAL_INTEGRATION.md` / Part 6 | PayPal Sandbox invoice send, status refresh, and payment history/reliability | PayPal OAuth, adapter (`sandbox`/`mock`), Approval gate | NOT STARTED | `/api/invoices/:id/paypal/send`, `/api/invoices/:id/paypal/refresh` (proposed) | Real Sandbox draft/send/retrieve; local vs. provider status separation | None | Awaiting Stage 2, Stage 3 & Stage 8 |
| F-008 | `PRD.md` / `DATABASE.md` / Part 6 | Reminder drafts and client-aware tone templates | Invoices, clients, approval gate | NOT STARTED | `reminders` entity (proposed) | Draft client-appropriate reminder; require explicit approval before send | None | Awaiting Stage 11 |
| F-009 | `PRD.md` / `AGENT.md` / Part 6 | Grounded aging and cash-flow forecast insights | Verified persisted invoice/payment data | NOT STARTED | None | Calculate aging buckets and labeled estimates strictly from persisted records | None | Awaiting Stage 12 |
| F-010 | `PRD.md` / `DATABASE.md` / Part 6 | Activity log and user notifications | DB (`activity_log`, `notifications`) | NOT STARTED | `/api/activity` (proposed) | Record proposed/approved/rejected/failed/executed events with actor & timestamp | None | Awaiting Stage 6 & Stage 10 |
| F-011 | `AUTH_SECURITY.md` / `DATABASE.md` / Part 6 | Settings, privacy, data export, account deletion, and deterministic demo reset | Auth, DB (`settings`), isolated demo tenant | NOT STARTED | None | Reset only demo-owned records; export/delete user data safely | None | Awaiting Stage 4 & Stage 9 |
| F-012 | `PAYPAL_INTEGRATION.md` / `API.md` / Part 6 | Developer mode, mode indicator (`sandbox`/`mock`), and webhook event viewer | `webhook_events`, PayPal webhook signature verification | NOT STARTED | `/api/webhooks/paypal` (proposed) | Verify PayPal webhook signatures & idempotency; display explicit mode badge | None | Awaiting Stage 3, Stage 8 & Stage 14 |
| F-013 | `FEATURE_DEVELOPMENT.md` / Part 6 | Help and FAQ pages | App shell | NOT STARTED | None | Accessible help/FAQ content in Newsreader/Hanken Grotesk typography | None | Awaiting Stage 14 |
| F-014 | `FEATURE_DEVELOPMENT.md` / Part 6 | Public client Pay page & global themes/accessibility/responsive states | PayPal buyer payment link/status, Light/Dark/System tokens | NOT STARTED | None | 360px mobile + desktop, keyboard nav, WCAG AA, light/dark tokens verified | None | Awaiting Stage 1, Stage 8 & Stage 14 |

## Evidence format
For each VERIFIED item, record: test date, environment, exact steps/command, expected result, actual result, test artifact/log reference with secrets redacted, commit/build, and remaining limitations.
