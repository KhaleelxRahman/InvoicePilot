# INVOICEPILOT — FEATURE INVENTORY & COVERAGE MATRIX
### Complete Verification & Video Representation Audit

This inventory distinguishes strictly between verified source code, running application verification, and demonstration representation.

---

## 1. COMPREHENSIVE FEATURE INVENTORY

| Feature | Implemented? | Verified in Code? | Verified in Running App? | Show in Video? | Evidence / Location |
|:---|:---:|:---:|:---:|:---:|:---|
| **Live Start Page & Entry Route** | YES | YES | YES | YES (Scene 3) | `src/client/components/StartPage.tsx` |
| **Authentication (Register / Login)** | YES | YES | YES | YES (Scene 3) | `src/server/app.ts`, scrypt hashing, `POST /api/auth/register`, `/login` |
| **Session Persistence & Scoping** | YES | YES | YES | YES (Scene 3) | `invoicepilot_session` HttpOnly cookie, multi-tenant owner scoping |
| **Business Setup & Onboarding** | YES | YES | YES | YES (Scene 3) | Business name, email, currency, default terms initialized |
| **Overview Dashboard Metrics** | YES | YES | YES | YES (Scene 4) | Total billed, outstanding, paid, aging buckets (0-30, 31-60, 61+) |
| **Aging Buckets & Forecasts** | YES | YES | YES | YES (Scene 4) | Derived directly from database records in minor units |
| **Client Management (CRUD)** | YES | YES | YES | YES (Scene 4) | `src/client/components/ClientDetailView.tsx`, `src/server/db/repository.ts` |
| **Conventional Invoice Builder** | YES | YES | YES | YES (Scene 5) | `src/client/components/InvoiceDraftForm.tsx`, multi-item draft creation |
| **Deterministic Minor-Unit Math** | YES | YES | YES | YES (Scene 5) | Server-side integer minor units (`cents`), basis point tax calculations |
| **Saved Invoice Details & Status** | YES | YES | YES | YES (Scene 5) | `src/client/components/InvoiceDetailView.tsx`, local draft state |
| **Gemini AI Invoice Assistant** | YES | YES | YES | YES (Scene 6) | `src/server/agent/geminiAgent.ts`, Google Gemini 3.8 Flash, strict Zod schema |
| **Catalog Client Grounding** | YES | YES | YES | YES (Scene 6) | AI resolves client identities strictly against stored database catalog |
| **Fallback Conventional Form** | YES | YES | YES | YES (Scene 6) | Graceful fallback if Gemini API is unreachable or returns malformed output |
| **Paper Approval Slip Gate** | YES | YES | YES | YES (Scene 7) | `src/client/components/ApprovalSlip.tsx`, SHA-256 payload lock, human signoff |
| **Server State Machine Transitions** | YES | YES | YES | YES (Scene 7) | `DRAFT -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED` |
| **PayPal Sandbox OAuth Bearer Token** | YES | YES | YES | YES (Scene 8) | Live token acquisition (`APP-1DA27118FH6238323`), `src/server/paypal/adapter.ts` |
| **PayPal Invoicing v2 Draft Creation** | YES | YES | YES | YES (Scene 8) | Live Invoicing v2 draft creation (`INV2-N8JF-JW4U-DEM9-2J34`) |
| **PayPal Invoicing v2 Send & Links** | YES | YES | YES | YES (Scene 8) | Live invoice send (`INV2-L6AC-23HU-KWTU-X8FY`), recipient payment URL |
| **External Buyer Sandbox Checkout** | OPERATIONAL | YES | SANDBOX | DISCLOSED (Scene 8) | Buyer checkout occurs externally on PayPal's hosted sandbox page |
| **Standardized Invoice PDF 1.4** | YES | YES | YES | YES (Scene 9) | `src/server/pdf/invoicePdfGenerator.ts`, pure TypeScript, zero dependencies |
| **Append-Only Activity Audit Trail** | YES | YES | YES | YES (Scene 9) | `activity_log` table, immutable chronological recording of all actions |
| **Client-Aware Reminder Modals** | YES | YES | YES | DOCUMENTED | `src/client/components/ReminderModal.tsx`, polite/firm/final tone drafts |
| **Webhook Signature Verification** | YES | YES | TESTED | YES (Scene 10) | `PAYPAL-TRANSMISSION-SIG` header verification against PayPal certificates |
| **Zero-Trust Multi-Tier Architecture**| YES | YES | YES | YES (Scene 10) | React 19 + Express 4 + Supabase PostgreSQL + Gemini + PayPal Sandbox |
| **Vitest Test Suite (157 Tests)** | YES | YES | YES | YES (Scene 10) | 157 unit/integration tests passing (scrypt, arithmetic, tenancy, state) |
| **Playwright E2E Tests (36 Tests)** | YES | YES | YES | YES (Scene 10) | 36 browser tests passing (Chromium + Mobile Safari viewports, 0 overflow) |

---

## 2. FEATURE INTEGRITY & SCOPE BOUNDARIES

1. **What is Implemented & Verified:**
   - Full local invoice authoring, line items, dynamic tax calculations, and database persistence.
   - Constrained Gemini 3.8 Flash copilot generating structured schema drafts.
   - Non-bypassable Paper Approval Slip with SHA-256 hash generation and human signoff.
   - PayPal Invoicing REST API v2 draft creation, sending, and buyer payment link retrieval.
   - ISO 32000-1 PDF 1.4 invoice generation directly in memory.
   - Comprehensive multi-tenant isolation and append-only activity logging.

2. **What is Disclosed as Prototype Boundary:**
   - Buyer payment is an **external PayPal Sandbox checkout** requiring a sandbox buyer account (`sb-buyer@personal.example.com`).
   - No autonomous money movement or bank debits.
   - No live production money processed (`PAYPAL_MODE=sandbox`).
