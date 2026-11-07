# INVOICEPILOT — PAYPAL SANDBOX END-TO-END VERIFICATION EVIDENCE

**Execution Date**: November 7, 2026  
**Provider Mode**: `PAYPAL_MODE=sandbox`  
**Endpoint**: `https://api-m.sandbox.paypal.com`  
**Target Invoicing API**: PayPal REST API v2  

---

## 1. End-to-End Verification Lifecycle

| Stage | Operation | Tested Against | Result | Evidence / Details |
|---|---|---|---|---|
| **1.1** | OAuth 2.0 Client Credentials Token | Live PayPal Sandbox API | **PASS** | HTTP 200; Bearer token generated; appId `APP-1DA27118FH6238323`; expires in 32,378s |
| **1.2** | Draft Invoice Creation | Live PayPal Sandbox API | **PASS** | HTTP 201; Created `INV2-N8JF-JW4U-DEM9-2J34` ($25.00 USD) & `INV2-L6AC-23HU-KWTU-X8FY` ($35.00 USD) |
| **1.3** | Draft Invoice Retrieval | Live PayPal Sandbox API | **PASS** | HTTP 200; Provider status confirmed `DRAFT`; `recipientViewUrl` generated |
| **1.4** | Invoice Dispatch to Recipient | Live PayPal Sandbox API | **PASS** | HTTP 200; Dispatched invoice via PayPal Sandbox; status transitioned to `SENT` |
| **1.5** | Customer Payment Link Retrieval | Live PayPal Sandbox API | **PASS** | HTTP 200; Live payment link: `https://www.sandbox.paypal.com/invoice/p/#L6AC23HUKWTUX8FY` |
| **1.6** | Webhook Signature Verification | PayPal Cert Verification Engine | **PASS** | Verified in `tests/unit/stage08PayPalEndToEnd.test.ts`; cert domain checking & transmission headers |
| **1.7** | Webhook Deduplication | PostgreSQL Unique Event Index | **PASS** | Duplicate delivery of `provider_event_id` returns `deduplicated: true` without reprocessing |
| **1.8** | Webhook Status Reconciliation | Database State Machine | **PASS** | Maps `INVOICING.INVOICE.PAID` -> `PAID`; updates paid amount and records Activity log |
| **1.9** | Interactive Buyer Sandbox Checkout | PayPal Checkout Portal | **BLOCKED** | Requires manual login with `sb-buyer@personal.example.com` during video recording |
| **1.10** | Inbound Live Webhook Receipt | Deployed Vercel Webhook Endpoint | **BLOCKED** | Fires automatically once Stage 1.9 interactive buyer payment is completed |

---

## 2. Real API Trace Evidence (Sanitized)

```text
=== Stage 02: PayPal Sandbox Verification Runner Output ===
Target Base URL : https://api-m.sandbox.paypal.com
Configured Mode : sandbox
Credentials Set : true

Step 1: oauthToken -> PASSED (HTTP 200, Bearer token, appId=APP-1DA27118FH6238323)
Step 2: createDraft -> PASSED (HTTP 201, ID=INV2-N8JF-JW4U-DEM9-2J34, Amount=USD 25.00, DebugId=f3851564b102c)
Step 3: retrieveDraft -> PASSED (HTTP 200, Status=DRAFT, DebugId=f967010168ed7)
Step 4: sendInvoice -> PASSED (HTTP 200, Sent via Sandbox, DebugId=f583368e99d2d)
Step 5: retrievePostSend -> PASSED (HTTP 200, Status=SENT, RecipientUrl=Present, DebugId=f950456a3d49b)

=== Stage 03: PayPal Server Adapter Verification Output ===
Adapter Mode      : sandbox
Adapter isMock    : false
Adapter Label     : PayPal Sandbox Mode (Live Sandbox API — No Real Money)

[1/4] OAuth Token Verified : {"tokenType":"Bearer","expiresIn":32400,"appId":"APP-1DA27118FH6238323","scopeCount":29}
[2/4] Draft Created        : {"providerInvoiceId":"INV2-L6AC-23HU-KWTU-X8FY","providerStatus":"DRAFT","totalValue":"35.00"}
[3/4] Draft Retrieved      : {"providerInvoiceId":"INV2-L6AC-23HU-KWTU-X8FY","providerStatus":"DRAFT","recipientViewUrl":"https://www.sandbox.paypal.com/invoice/p/#L6AC23HUKWTUX8FY"}
[4/4] Invoice Sent & Synced: {"providerInvoiceId":"INV2-L6AC-23HU-KWTU-X8FY","providerStatus":"SENT","recipientViewUrl":"https://www.sandbox.paypal.com/invoice/p/#L6AC23HUKWTUX8FY"}
```

---

## 3. Discrepancy & Verification Summary

- **API Capabilities**: **PROVEN LIVE**. The backend connects directly to PayPal Sandbox, authenticates, drafts, and sends invoices.
- **Reconciliation Engine**: **PROVEN VIA AUTOMATED SUITES**. All state machine transitions (`DRAFT` -> `SENT` -> `PAID`), deduplication, and transaction logging pass unit and integration tests.
- **External Delivery**: Live external webhook delivery from PayPal’s dispatch queue is ready in production (`webhookConfigured: true`) and awaits the live buyer checkout during user demonstration.
