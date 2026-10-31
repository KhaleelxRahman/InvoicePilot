# PayPal Sandbox Integration

## Status
No successful real Sandbox API call is presumed. Populate the evidence section only after performing tests.

## Official references to consult
- https://developer.paypal.com/
- https://developer.paypal.com/dashboard/
- https://developer.paypal.com/invoicing/about
- https://developer.paypal.com/api/rest/
- https://developer.paypal.com/api/webhooks/overview
- https://docs.paypal.ai/
- https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart
- https://docs.paypal.ai/developer/tools/ai/mcp-quickstart

Verify current endpoints, payload fields, scopes, status semantics, and event types against official docs. This document intentionally does not guess endpoint details.

## Required milestones
1. Create/confirm Sandbox app and test accounts.
2. Configure credentials on server only.
3. Acquire OAuth token and redact it from logs.
4. Create invoice draft using documented API.
5. Send invoice using documented supported operation after approval gate exists.
6. Save actual provider invoice ID and response.
7. Retrieve invoice and compare actual provider status.
8. Test supported buyer payment flow if available.
9. Verify webhook signatures and process events idempotently if implemented.
10. Test invalid payloads, authorization errors, rate limits, timeouts, and safe retries.

## Official-Doc-Based PayPal Sandbox Verification Sequence (Stage 02 Protocol)
Before writing or running the Stage 02 Sandbox verification script, verify exact request/response schemas against the official PayPal REST documentation linked above (`https://developer.paypal.com/api/rest/` and `https://developer.paypal.com/invoicing/about`)—never guess field names or status enums:

1. **Preconditions & Credential Safety**:
   - Confirm server-only environment variables (`PAYPAL_MODE=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` when testing webhooks) are loaded exclusively in the Node.js server environment and never exposed to the browser or committed to Git.
   - Verify the PayPal Sandbox base URL from official PayPal REST docs (`https://api-m.sandbox.paypal.com` as documented in PayPal REST API reference).
2. **Step 1 — OAuth 2.0 Client Credentials Token Exchange**:
   - Execute the documented PayPal OAuth 2.0 token request (`POST /v1/oauth2/token` with HTTP Basic Auth `client_id:client_secret` and `grant_type=client_credentials` per official PayPal REST OAuth docs).
   - **Pass criteria**: HTTP 200 response with `access_token`, `token_type`, `expires_in`, and `scope`. Redact `access_token` in all logs and artifacts (log only token presence, expiry, and redacted prefix/length).
3. **Step 2 — Draft Invoice Creation (PayPal Invoicing v2 API)**:
   - Consult official PayPal Invoicing v2 documentation to confirm the exact draft creation endpoint (`POST /v2/invoicing/invoices`), required headers (`Authorization: Bearer <token>`, `Content-Type: application/json`, `PayPal-Request-Id` idempotency key), and payload schema (invoicer info, primary recipient with Sandbox personal buyer email, items array with explicit `currency_code` and `unit_amount`, and due date).
   - **Pass criteria**: Documented 2xx creation response returning a real PayPal invoice resource ID or `href` link. Extract and persist the exact provider invoice ID.
4. **Step 3 — Retrieve Draft Invoice Details**:
   - Call the documented invoice detail endpoint (`GET /v2/invoicing/invoices/{invoice_id}`) using the returned provider invoice ID.
   - **Pass criteria**: HTTP 200 response matching the created line items, currency, total amount, recipient, and initial `DRAFT` provider status.
5. **Step 4 — Send Invoice in Sandbox (Gated by Approval State Machine in App Flow)**:
   - Call the documented send invoice operation (`POST /v2/invoicing/invoices/{invoice_id}/send` with `PayPal-Request-Id` idempotency header and documented notification payload).
   - **Pass criteria**: Documented 200/202 response (and buyer view link / metadata where returned by PayPal).
6. **Step 5 — Post-Send Status Retrieval & Reconciliation**:
   - Re-fetch `GET /v2/invoicing/invoices/{invoice_id}` and confirm provider status transitions from `DRAFT` to the documented sent/unpaid status (`SENT` / `UNPAID` per official Invoicing v2 status specification) and verify recipient view/pay metadata.
7. **Step 6 — Supported Buyer Payment / Status Update & Error Handling**:
   - Test the documented Sandbox buyer payment or record-payment path supported by PayPal Sandbox, then re-fetch invoice status to verify transition to `PAID` (or `MARKED_AS_PAID`).
   - Test error/edge cases: invalid payload (400/422), bad credentials (401), unknown invoice ID (404), and idempotent timeout reconciliation (re-fetching state before retrying).
8. **Step 7 — Webhook Signature Verification (When Webhook Endpoint Is Enabled)**:
   - Verify incoming webhook headers against PayPal's documented signature verification endpoint (`POST /v1/notifications/verify-webhook-signature`) and enforce idempotency on `event.id`.

## Adapter contract
Keep one internal interface for Sandbox and Mock modes. Include explicit mode in configuration and UI. Never silently fall back from Sandbox to mock or Live. Mock responses must be visibly labeled and must not create fake provider IDs that resemble real ones.

## State integrity
Local draft status and provider-confirmed status are distinct. Only a validated provider response or verified webhook can update provider-confirmed fields. After ambiguous timeouts, reconcile by retrieving known provider state before retrying a potentially duplicative action.

## Test evidence ledger
| Date | Operation | Environment | Expected | Actual | Evidence/reference | Status |
|---|---|---|---|---|---|---|
| 2026-10-31 | OAuth token (`POST /v1/oauth2/token`) | Sandbox (`api-m.sandbox.paypal.com`) | HTTP 200 with `access_token` (redacted), `token_type`, `expires_in` | HTTP 200 (`token_type: "Bearer"`, `expires_in: 32177` / `32400`, `appId: "APP-1DA27118FH6238323"`, `redactedTokenPreview: "A21A...[REDACTED len=97]"`) | `npm run paypal:sandbox:verify` & `npm run paypal:adapter:verify` | VERIFIED |
| 2026-10-31 | Create draft (`POST /v2/invoicing/invoices`) | Sandbox (`api-m.sandbox.paypal.com`) | HTTP 201 with actual provider invoice ID (`INV2-...`) | HTTP 201 returning `INV2-WHS9-X55V-Y6AJ-HAAQ` (`paypal-debug-id: f6042073939fb`) and via Stage 03 adapter `INV2-M6YP-NTGY-TRXS-W5FN` (`paypal-debug-id: ca53430652ec6`) | `npm run paypal:sandbox:verify` & `npm run paypal:adapter:verify` | VERIFIED |
| 2026-10-31 | Retrieve draft (`GET /v2/invoicing/invoices/{id}`) | Sandbox (`api-m.sandbox.paypal.com`) | HTTP 200 matching draft fields and `status: "DRAFT"` | HTTP 200 (`providerStatus: "DRAFT"`, `currencyCode: "USD"`, `amountValue: "25.00"` / `"35.00"`, `paypal-debug-id: f6268037f78e5` & `ca534306d69a1`) | `npm run paypal:sandbox:verify` & `npm run paypal:adapter:verify` | VERIFIED |
| 2026-10-31 | Send invoice (`POST /v2/invoicing/invoices/{id}/send`) | Sandbox (`api-m.sandbox.paypal.com`) | HTTP 200/202 confirmation and buyer view link | HTTP 200 confirmation (`paypal-debug-id: f981347aeda8f` & `ca5343081dc60`) | `npm run paypal:sandbox:verify` & `npm run paypal:adapter:verify` | VERIFIED |
| 2026-10-31 | Post-send retrieve (`GET /v2/invoicing/invoices/{id}`) | Sandbox (`api-m.sandbox.paypal.com`) | HTTP 200 with provider status `SENT` / `UNPAID` | HTTP 200 (`providerStatus: "SENT"`, `recipientViewUrl` & `invoicerViewUrl` populated, `paypal-debug-id: f7020640c30db` & `ca5343081dc60`) | `npm run paypal:sandbox:verify` & `npm run paypal:adapter:verify` | VERIFIED |
| Not run | Buyer payment/status | Sandbox | Supported flow reflected | Not tested | None | NOT STARTED |
| Not run | Webhook verification | Sandbox | Signature verified and event idempotent | Not tested | None | NOT STARTED |
