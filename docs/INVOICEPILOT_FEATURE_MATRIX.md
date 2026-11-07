# INVOICEPILOT — FEATURE COMPLETION & VERIFICATION MATRIX

**Date**: November 7, 2026  
**Status Key**:
- **COMPLETE AND VERIFIED**: Directly verified with reproducible automated test suites and live production evidence.
- **IMPLEMENTED, NOT FULLY VERIFIED**: Implementation exists and passes automated mock tests; live external delivery requires manual operational action.
- **PARTIALLY IMPLEMENTED**: Code exists for subsets of capability; optional extensions omitted.
- **NOT IMPLEMENTED**: Feature not attempted.
- **BLOCKED**: Requires unavailable external credentials.
- **FAILED**: Reproducible failure or defect exists.

---

## Complete Feature Matrix

| ID | Feature Name | Primary Endpoint / Component | Database Tables | Test Suite | Status | Production Verified |
|---|---|---|---|---|---|---|
| **F01** | User Registration | `POST /api/auth/register`, `AuthModal.tsx` | `users` | `stage09AuthOnboarding.test.ts`, `start-page-auth.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F02** | User Login & Sessions | `POST /api/auth/login`, `POST /api/auth/logout` | `users` | `stage09AuthOnboarding.test.ts`, `start-page-auth.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F03** | 4-Step Onboarding Wizard | `GET/POST /api/onboarding/*`, `App.tsx` | `users`, `settings`, `clients` | `stage09-auth-onboarding.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F04** | Client CRUD & Profile | `GET/POST/PATCH/DELETE /api/clients/*` | `clients`, `invoices` | `stage05Workflow.test.ts`, `stage05-conventional-workflow.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F05** | Invoice Draft Builder | `POST /api/invoices`, `InvoiceDraftForm.tsx` | `invoices`, `invoice_items` | `stage05Workflow.test.ts`, `stage05-conventional-workflow.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F06** | Minor-Unit Arithmetic | `schema.ts` (`formatMinorUnitsToDecimal`) | N/A | `stage05Workflow.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F07** | Basis Point Tax Engine | `src/server/app.ts` (`parseTaxRateBps`) | `invoices` | `stage05Workflow.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F08** | ISO 32000-1 PDF Engine | `GET /api/invoices/:id/pdf` | `invoices`, `invoice_items`, `settings` | `invoicePdf.test.ts` (4 tests) | **COMPLETE AND VERIFIED** | YES |
| **F09** | Gemini AI Invoice Drafter | `POST /api/agent/prepare-invoice` | `invoices`, `invoice_items` | `geminiReliability.test.ts`, `stage07GeminiAgent.test.ts` | **COMPLETE AND VERIFIED** | YES (4.5–5.7s) |
| **F10** | Low Thinking & Retries | `geminiAgent.ts` (`postGenerateContentWithRetry`) | N/A | `geminiReliability.test.ts` (12 tests) | **COMPLETE AND VERIFIED** | YES |
| **F11** | Peer Model Failover | `geminiAgent.ts` (503 failover to Flash-Lite) | N/A | `geminiReliability.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F12** | Cryptographic Approval Slip | `POST /api/actions`, `ApprovalSlip.tsx` | `pending_actions`, `invoices` | `stage06Approval.test.ts`, `stage06-approval-slip.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F13** | Approval State Machine | `POST /api/actions/:id/approve`, `/reject` | `pending_actions`, `invoices` | `stage06Approval.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F14** | PayPal OAuth Token Engine | `src/server/paypal/adapter.ts` | In-memory token cache | `paypalAdapter.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F15** | PayPal Invoice Creation | `createDraftInvoice` (PayPal REST v2) | `invoices` (`provider_invoice_id`) | `stage08PayPalEndToEnd.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F16** | PayPal Invoice Dispatch | `POST /api/invoices/:id/paypal/send` | `invoices` (`provider_recipient_view_url`)| `stage08PayPalEndToEnd.test.ts`, `stage08-paypal-status.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F17** | PayPal Status Refresh | `POST /api/invoices/:id/paypal/refresh` | `invoices` (`provider_status`) | `stage08PayPalEndToEnd.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F18** | Webhook Signature Check | `verifyWebhookSignature` in `adapter.ts` | `webhook_events` | `stage08PayPalEndToEnd.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F19** | Webhook Reconciliation | `POST /api/webhooks/paypal` | `invoices`, `activity_logs`, `webhook_events` | `stage08PayPalEndToEnd.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F20** | Webhook Deduplication | `repo.recordWebhookEvent` | `webhook_events` (unique constraint) | `stage08PayPalEndToEnd.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F21** | Inbound Live Webhook | Inbound from PayPal Sandbox infrastructure | `webhook_events` | Integration tests pass | **IMPLEMENTED, NOT FULLY VERIFIED** | Operational (needs buyer checkout) |
| **F22** | Aging Buckets (30/60/90+) | `GET /api/insights`, `cashFlowInsights.ts` | `invoices`, `clients` | `stage12Insights.test.ts`, `stage12-insights.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F23** | Slow Payer Ranking | `cashFlowInsights.ts` (`calculateSlowPayerRankings`)| `clients`, `invoices` | `stage12Insights.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F24** | Payment Reminders & Tone | `POST /api/invoices/:id/reminders/draft` | `reminders`, `pending_actions` | `stage11Reminders.test.ts`, `stage11-reminders.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F25** | Distributed Rate Limiter | `src/server/app.ts` (`checkRateLimit`) | `rate_limits` | `securityHeadersAndRateLimit.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F26** | Workspace JSON Export | `GET /api/export` | All user tables | `stage10CorePages.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F27** | Account Deletion Cascade | `POST /api/account/delete` | All user tables | `supabasePostgresRepository.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F28** | Invoice Preset Templates | `GET/POST/DELETE /api/templates/*` | `templates` | `stage14RemainingScope.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F29** | Webhook Event Viewer | `GET /api/webhooks/paypal/events` | `webhook_events` | `stage14RemainingScope.test.ts` | **COMPLETE AND VERIFIED** | YES |
| **F30** | Theme Switching | `tokens.css`, `App.tsx` | LocalStorage | `stage01-foundation.spec.ts`, `frontend-polish.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F31** | Global Search (`Ctrl+K`) | `GlobalSearch.tsx`, `App.tsx` | In-memory search index | `frontend-polish.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F32** | Mobile Drawer & Backdrop | `Sidebar.tsx`, `tokens.css` | DOM state | `frontend-polish.spec.ts` | **COMPLETE AND VERIFIED** | YES |
| **F33** | MCP Toolkit Integration | `src/server/agent/mcpTools.ts` (Optional) | N/A | `stage13McpEvaluation.test.ts` | **PARTIALLY IMPLEMENTED** | Kept optional |
