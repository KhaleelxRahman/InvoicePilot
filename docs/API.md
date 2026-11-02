# Application API Contract

## Status
Proposed contract. Routes must be reconciled with the actual server before implementation. Do not document a route as live until it exists and is tested.

## Conventions
- JSON request/response bodies unless provider requires otherwise.
- Authenticate protected routes and enforce ownership server-side.
- Validate every field; reject unknown/invalid action states safely.
- Return consistent error shapes without secrets or stack traces.
- Use idempotency controls for consequential mutations where practical.

## Candidate route inventory
| Method | Route | Purpose | Status |
|---|---|---|---|
| GET | `/api/health` | App health check | VERIFIED (Stage 01 — 2026-10-31; `tests/unit/health.test.ts` & `tests/e2e/stage01-foundation.spec.ts`) |
| GET/POST | `/api/clients` | List/create clients | VERIFIED (Stage 05 — 2026-10-31; `tests/unit/stage05Workflow.test.ts` & `tests/e2e/stage05-conventional-workflow.spec.ts`) |
| GET/PATCH/DELETE | `/api/clients/:id` | Read/update/delete owned client | VERIFIED (Stage 05 — 2026-10-31; `tests/unit/stage05Workflow.test.ts` & `tests/e2e/stage05-conventional-workflow.spec.ts`) |
| GET/POST | `/api/invoices` | List/create local draft | VERIFIED (Stage 05 — 2026-10-31; `tests/unit/stage05Workflow.test.ts` & `tests/e2e/stage05-conventional-workflow.spec.ts`) |
| GET/PATCH | `/api/invoices/:id` | Read/update owned invoice draft | VERIFIED (Stage 05 — 2026-10-31; `tests/unit/stage05Workflow.test.ts` & `tests/e2e/stage05-conventional-workflow.spec.ts`) |
| POST | `/api/agent/prepare-invoice` (`/api/agent/chat`) | Prepare validated draft, ask clarification, explain validation errors, or retrieve authorized invoice details via constrained Gemini agent | VERIFIED (Stage 07 — 2026-10-31; `tests/unit/stage07GeminiAgent.test.ts` & `tests/e2e/stage07-gemini-agent.spec.ts`) |
| GET/POST | `/api/actions` (`/api/invoices/:id/approval-request`) | List pending actions / Propose invoice draft for approval slip (`DRAFTED -> PENDING_APPROVAL`) | VERIFIED (Stage 06 — 2026-10-31; `tests/unit/stage06Approval.test.ts` & `tests/e2e/stage06-approval-slip.spec.ts`) |
| GET | `/api/actions/:id` | Read owned pending action and computed approval slip | VERIFIED (Stage 06 — 2026-10-31; `tests/unit/stage06Approval.test.ts` & `tests/e2e/stage06-approval-slip.spec.ts`) |
| POST | `/api/actions/:id/approve` | Approve pending action (`PENDING_APPROVAL -> APPROVED`) after freshness & safety cap checks | VERIFIED (Stage 06 — 2026-10-31; `tests/unit/stage06Approval.test.ts` & `tests/e2e/stage06-approval-slip.spec.ts`) |
| POST | `/api/actions/:id/reject` | Reject / discard pending or approved action (`-> REJECTED`) and reset invoice to `DRAFT` | VERIFIED (Stage 06 — 2026-10-31; `tests/unit/stage06Approval.test.ts` & `tests/e2e/stage06-approval-slip.spec.ts`) |
| POST | `/api/actions/:id/execute` | Execute approved action (`APPROVED -> EXECUTING -> EXECUTED/FAILED`) after full server revalidation | VERIFIED (Stage 06 & Stage 08 — 2026-11-01; `tests/unit/stage08PayPalEndToEnd.test.ts` & `tests/e2e/stage08-paypal-status.spec.ts`) |
| POST | `/api/invoices/:id/paypal/send` | Invoice-scoped send enforcing an `APPROVED` action, timeout reconciliation, and provider sync | VERIFIED (Stage 08 — 2026-11-01; `tests/unit/stage08PayPalEndToEnd.test.ts` & `tests/e2e/stage08-paypal-status.spec.ts`) |
| POST | `/api/invoices/:id/paypal/refresh` | Retrieve live provider details/status (`GET /v2/invoicing/invoices/{id}`) and update persisted status | VERIFIED (Stage 08 — 2026-11-01; `tests/unit/stage08PayPalEndToEnd.test.ts` & `tests/e2e/stage08-paypal-status.spec.ts`) |
| POST | `/api/webhooks/paypal` | Verify PayPal signature headers (`POST /v1/notifications/verify-webhook-signature`) and idempotently process events | VERIFIED (Stage 08 — 2026-11-01; `tests/unit/stage08PayPalEndToEnd.test.ts` & `tests/e2e/stage08-paypal-status.spec.ts`) |
| GET | `/api/activity` | List owned activity records | VERIFIED (Stage 06 & Stage 08 — 2026-11-01; `tests/unit/stage08PayPalEndToEnd.test.ts` & `tests/e2e/stage08-paypal-status.spec.ts`) |
| POST | `/api/auth/register` | Register new account with timing-safe scrypt hashed password and create session | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/auth/login` | Authenticate email and password, create session, and set HttpOnly cookie | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/auth/demo` | Initialize isolated demo user session and set HttpOnly cookie | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| GET | `/api/auth/me` | Retrieve authenticated user profile, settings, and onboarding progress | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/auth/logout` | Terminate session, delete from database, and clear cookie | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/demo/reset` | Deterministically reset only demo-owned records (`is_demo = 1`); real user data untouched | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| GET | `/api/onboarding` | Retrieve onboarding progress, settings, and client count | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/business-details` | Save Step 1 business name, email, and default currency | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/test-sandbox` | Execute Step 2 PayPal Sandbox OAuth verification test | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/preferences` | Save Step 3 max invoice amount safety cap and default reminder tone | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/first-client` | Create Step 4 first client profile and mark onboarding completed | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/skip` | Mark onboarding as skipped and advance to workspace | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/onboarding/reset` | Reset onboarding wizard back to Step 1 | VERIFIED (Stage 09 — 2026-11-01; `tests/unit/stage09AuthOnboarding.test.ts` & `tests/e2e/stage09-auth-onboarding.spec.ts`) |
| POST | `/api/invoices/:id/reminders/draft` | Draft tone-adjusted reminder wording (`polite`, `firm`, `final`) using stored invoice/client history | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| GET | `/api/reminders` | List owned reminder drafts and delivery records with queue filtering (`?status=`, `?invoiceId=`) | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| GET | `/api/reminders/:id` | Retrieve single reminder detail with attached invoice and client profile | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| PATCH | `/api/reminders/:id` | Edit draft reminder subject, body, tone, or scheduled time before sending | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| POST | `/api/reminders/:id/request-approval` | Queue reminder for human approval (`DRAFTED -> PENDING_APPROVAL`) | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| POST | `/api/reminders/:id/approve` | Human approval gate transition (`PENDING_APPROVAL -> APPROVED` or `SCHEDULED`) | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| POST | `/api/reminders/:id/reject` | Explicitly discard/reject reminder; blocked from execution | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| POST | `/api/reminders/:id/send` | Deliver approved reminder, prevent duplicate sends, record evidence & activity log | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| POST | `/api/reminders/process-scheduled` | Observable scheduler runner; executes due scheduled reminders against target time | VERIFIED (Stage 11 — 2026-11-01; `tests/unit/stage11Reminders.test.ts` & `tests/e2e/stage11-reminders.spec.ts`) |
| GET | `/api/insights` | Grounded receivables aging buckets, 30-day forecast estimates, slow-payer rankings, and weekly summary | VERIFIED (Stage 12 — 2026-11-01; `tests/unit/stage12Insights.test.ts` & `tests/e2e/stage12-insights.spec.ts`) |
| POST | `/api/invoices/:id/partial-payment` | Record manual or partial payment against invoice, recalculate outstanding balance, auto-settle at 100% | VERIFIED (Stage 12 — 2026-11-01; `tests/unit/stage12Insights.test.ts` & `tests/e2e/stage12-insights.spec.ts`) |
| GET | `/api/templates` | List line item preset templates for owner with seeded architectural & retainer defaults | VERIFIED (Stage 14 — 2026-11-01; `tests/unit/stage14RemainingScope.test.ts` & `tests/e2e/stage14-remaining-scope.spec.ts`) |
| POST | `/api/templates` | Create custom line item preset template for owner with validation | VERIFIED (Stage 14 — 2026-11-01; `tests/unit/stage14RemainingScope.test.ts` & `tests/e2e/stage14-remaining-scope.spec.ts`) |
| DELETE | `/api/templates/:id` | Delete custom line item preset template for owner | VERIFIED (Stage 14 — 2026-11-01; `tests/unit/stage14RemainingScope.test.ts` & `tests/e2e/stage14-remaining-scope.spec.ts`) |
| GET | `/api/webhooks/paypal/events` | List verified incoming PayPal webhook events for developer inspection | VERIFIED (Stage 14 — 2026-11-01; `tests/unit/stage14RemainingScope.test.ts` & `tests/e2e/stage14-remaining-scope.spec.ts`) |
| POST | `/api/account/delete` | Permanent cascading deletion of real user data; safe deterministic reset for demo tenant | VERIFIED (Stage 14 — 2026-11-01; `tests/unit/stage14RemainingScope.test.ts` & `tests/e2e/stage14-remaining-scope.spec.ts`) |

These routes are suggestions, not requirements to use this exact shape. Avoid duplicate endpoints that weaken the approval boundary.

## Error shape proposal
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Review the highlighted fields.",
    "requestId": "server-generated-correlation-id"
  }
}
```
Never expose access tokens, client secrets, raw provider credentials, stack traces, or private infrastructure details.

## API documentation requirements
For every implemented route, record auth requirements, ownership checks, schema, response, errors, rate limits, idempotency behavior, and tests. PayPal endpoint details must be copied from current official documentation and verified in Sandbox; do not guess them here.
