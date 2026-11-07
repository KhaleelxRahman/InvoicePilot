# INVOICEPILOT — PAYPAL SANDBOX INTEGRATION TEST RESULTS

**Test Date**: November 7, 2026  
**Environment**: PayPal Developer Sandbox (`https://api-m.sandbox.paypal.com`)  
**Mode**: `PAYPAL_MODE=sandbox`  

---

## 1. Automated Test Suites Execution

### A. Unit Tests: Adapter Contract & Sandbox Proof
- **Suite**: `tests/unit/paypalAdapter.test.ts` (7 tests) — **PASS**
  - Confirms adapter returns explicit `mode: 'sandbox'`, `isMock: false`, and `modeLabel`.
  - Verifies OAuth Bearer token caching and expiry check.
  - Verifies payload mapping from local invoice items to PayPal Invoicing v2 schema.
  - Verifies error categorization (`CREDENTIALS_MISSING`, `AUTH_FAILED`, `RATE_LIMITED`, `TIMEOUT_RECONCILE_REQUIRED`).
- **Suite**: `tests/unit/paypalSandboxProof.test.ts` (5 tests) — **PASS**
  - Validates PayPal Invoicing v2 resource schema parsers.
  - Validates redaction of secrets in logs and error traces.
  - Confirms certificate URL domain parsing for webhook validation.

### B. End-to-End & Webhook Integration Tests
- **Suite**: `tests/unit/stage08PayPalEndToEnd.test.ts` (5 tests) — **PASS**
  - **Test 1**: Explicit approval required before PayPal dispatch; creates draft, dispatches to recipient, persists provider invoice ID, and refreshes status.
  - **Test 2**: Rejects status refresh on local unsent drafts without provider ID; blocks duplicate execution.
  - **Test 3**: Cleanly captures provider errors on send; marks action `FAILED` and logs in Activity audit trail.
  - **Test 4**: Reconciles ambiguous send timeouts against provider state without creating duplicate drafts or duplicate sends.
  - **Test 5**: Rejects unverified webhooks with HTTP 400 (`WEBHOOK_SIGNATURE_INVALID`); idempotently processes signature-verified webhooks once and deduplicates repeat deliveries.
- **Suite**: `tests/e2e/stage08-paypal-status.spec.ts` (2 tests, desktop & mobile) — **PASS**
  - Executes full visible UI workflow: approving draft, dispatching to PayPal Sandbox, displaying `provider_recipient_view_url`, and polling live status.

---

## 2. Invoicing API v2 Lifecycle Verification

```text
[Local Invoice DRAFT]
         │
         ▼ (Human reviews and approves cryptographic slip)
[State: APPROVED]
         │
         ▼ (POST /v2/invoicing/invoices via PayPalAdapter)
[PayPal Sandbox Draft Created: INV2-XXXX-XXXX-XXXX-XXXX]
         │
         ▼ (POST /v2/invoicing/invoices/{id}/send)
[PayPal Sandbox Status: SENT]
         │
         ├── Recipient View URL: https://www.sandbox.paypal.com/invoice/p/...
         └── Local Status Updated: SENT / Provider Status: SENT
```

---

## 3. Webhook Signature Verification Proof

When PayPal dispatches an event to `POST /api/webhooks/paypal`, InvoicePilot verifies the event using PayPal's `/v1/notifications/verify-webhook-signature` endpoint:

```json
{
  "auth_algo": "SHA256withRSA",
  "cert_url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-...",
  "transmission_id": "8b52...",
  "transmission_sig": "...",
  "transmission_time": "2026-11-07T08:00:00Z",
  "webhook_id": "9AB...",
  "webhook_event": { ... }
}
```

- **Verification Status**:
  - Valid Signature -> `verificationStatus: 'SUCCESS'` -> Event recorded as `VERIFIED` and processed.
  - Invalid Signature -> `verificationStatus: 'FAILURE'` -> Event recorded as `REJECTED` and ignored with HTTP 400.
  - Deduplication: If `provider_event_id` already exists in `webhook_events`, returns HTTP 200 with `deduplicated: true` and skips processing.

---

## 4. Live Operational Step: Interactive Buyer Checkout

To perform the live, visible sandbox transaction for video demonstration:

1. **In InvoicePilot UI**:
   - Create and approve an invoice for $5.00.
   - Click **Send via PayPal Sandbox**.
   - Copy the generated **Customer Payment Link** from the invoice detail view.
2. **In PayPal Checkout (Incognito or New Window)**:
   - Open the Customer Payment Link.
   - Log in using your **PayPal Sandbox Personal Account** (`sb-buyer@personal.example.com`).
   - Click **Pay Now**.
3. **In InvoicePilot Webhook Events**:
   - Check `https://invoicepilot-beryl.vercel.app/api/webhooks/paypal/events`.
   - Confirm the `INVOICING.INVOICE.PAID` event is recorded.
   - Refresh the invoice in InvoicePilot to observe `providerStatus: "PAID"` and `localStatus: "SENT"`.
