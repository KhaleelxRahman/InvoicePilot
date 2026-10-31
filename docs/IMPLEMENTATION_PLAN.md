# Implementation Plan

## Rule
Complete one stage, run its acceptance checks, update evidence/status, and stop if criteria fail. Reorder only for a verified dependency and record the reason.

| Stage | Objective | Exit criteria | Initial status |
|---|---|---|---|
| 0 | Audit specification/project; inventory, risks, docs skeleton | Existing state and unknowns reported; no assumed features | VERIFIED (2026-10-31; `docs/DOCUMENTATION_AUDIT.md`) |
| 1 | App/repo foundation, design tokens, responsive shell, health check | App starts from documented command; responsive shell and health route checked | VERIFIED (2026-10-31; `npm test` 6/6, `npx playwright test` 2/2 desktop + 360px mobile) |
| 2 | Independent PayPal Sandbox proof | Real OAuth token and supported invoice operation/retrieval evidenced | VERIFIED (2026-10-31; `npm run paypal:sandbox:verify` passed live OAuth + create/retrieve/send/retrieve `INV2-WHS9-X55V-Y6AJ-HAAQ`) |
| 3 | PayPal adapter and isolated mock mode | Adapter contract tested; mode explicit; errors handled | VERIFIED (2026-10-31; `tests/unit/paypalAdapter.test.ts` 6/6 passed + `npm run paypal:adapter:verify` live Sandbox `INV2-M6YP-NTGY-TRXS-W5FN`) |
| 4 | Persistence, ownership, seed/reset | CRUD persisted; cross-owner access denied | VERIFIED (2026-10-31; on-disk SQLite WAL schema & repository, `tests/unit/persistence.test.ts` 6/6 passed, `npm run db:seed:demo` verified) |
| 5 | Clients and conventional invoice workflow | Draft create/edit/detail and validation work without AI | NOT STARTED |
| 6 | Approval slip/action safety/Activity | Discard does not execute; only explicit approval can execute | NOT STARTED |
| 7 | Gemini agent tools | Structured output validated; clarification and fallback work | NOT STARTED |
| 8 | End-to-end Sandbox invoice/payment status | Real send/retrieve; supported buyer payment/status path tested | NOT STARTED |
| 9 | Authentication/demo/onboarding | Real auth or clearly isolated demo boundaries tested | NOT STARTED |
| 10 | Core product pages | Implemented pages use real app data and correct states | NOT STARTED |
| 11 | Reminder drafts and client tone | Draft, approval and delivery states truthful; scheduling only if real | NOT STARTED |
| 12 | Aging and cash-flow insights | Calculations tested and labeled; no invented metrics | NOT STARTED |
| 13 | MCP/Agent Toolkit evaluation | Decision based on official support and evidence | NOT STARTED |
| 14 | Remaining specified pages/policies/dev tools | Scope inventory updated; deferred items explicit | NOT STARTED |
| 15 | QA, security, accessibility, release/demo | Clean setup, tests, secret scan, demo and submission checklist | NOT STARTED |

## Priority order
The first priority is the actual Sandbox proof, but Stage 0 inspection comes first. Avoid polishing non-critical screens before the core path is reliable.

## Stage completion report
For each stage record: objective, files inspected/changed, tests and actual results, security/regression checks, blockers, statuses, docs updated, next action.
