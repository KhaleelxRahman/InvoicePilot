# INVOICEPILOT — GEMINI AI MODEL & INTEGRATION VALIDATION

**Audit Date**: November 7, 2026  
**Provider**: Google Gemini API via REST v1beta  
**Primary Model**: `gemini-3.8-flash`  
**Candidate Peer Failover Models**: `gemini-3.5-flash-lite`, `gemini-3.6-flash`  

---

## 1. Model Configuration & Official Capabilities

| Property | Value / Configuration | Rationale / Specification |
|---|---|---|
| **API Version** | `v1beta` | Standard Google AI Studio REST API endpoint |
| **Primary Model ID** | `gemini-3.8-flash` | Latest high-speed multimodal Flash model with tool-calling support |
| **Peer Fallback Model** | `gemini-3.5-flash-lite` | Ultra-low latency fallback when Google AI Studio experiences 503 high demand |
| **Thinking Config** | `{ thinkingConfig: { thinkingLevel: 'low' } }` | Eliminates deep reasoning chain latency for structured JSON operations |
| **Temperature** | Omitted | Adheres to official Gemini 3 guidance recommending default temperature |
| **Response Schema** | `GEMINI_RESPONSE_SCHEMA` (strict JSON) | Enforces structured tool envelope matching `StructuredModelEnvelopeSchema` |

---

## 2. Tool Boundaries & Capabilities

The Gemini agent is strictly restricted to proposing structured actions:

| Tool Name | Purpose | Permissions |
|---|---|---|
| `prepare_invoice_draft` | Extracts client, items, unit prices, due dates | Read stored catalog; Propose local draft |
| `get_invoice_details` | Retrieves authorized invoice summary for user | Read-only; Tenant-isolated |
| `request_invoice_send_approval` | Proposes a paper approval slip for sending | Proposal only; Creates `PENDING_APPROVAL` action |
| `ask_clarification` | Asks concise follow-up if details are ambiguous | Conversational clarification |
| `get_financial_insights` | Retrieves deterministic aging and cash-flow metrics | Read-only; Computed server-side |

### Prohibited Autonomous Capabilities:
- **No autonomous invoice dispatch tool exists**.
- **No payment execution or balance update tool exists**.
- **No direct database query or execution tool exists**.
- **No secret retrieval tool exists**.

---

## 3. Resilience & Timeout Architecture

```text
[Incoming User Request]
        │
        ▼ (Timeout: 20,000ms / Attempt)
[Attempt 1: gemini-3.8-flash]
        │
        ├── Success (200) ──► Parse Candidate Parts (Filter Thought) ──► Schema Validation ──► Output
        │
        └── Transient Error (503 High Demand / Timeout / 429)
                │
                ▼ (Exponential Backoff with Jitter)
[Attempt 2: Failover to gemini-3.5-flash-lite]
        │
        ├── Success (200) ──► Parse Candidate Parts ──► Schema Validation ──► Output
        │
        └── Exhausted / Non-transient ──► Conventional Form Fallback (No Silent Failures)
```

- **Per-Attempt Timeout**: 20,000ms
- **Maximum Retries**: 2 (up to 3 total attempts)
- **Total Request Budget**: 50,000ms (safely terminates before Vercel's 60s function limit)
- **Idempotency Guarantee**: All retries occur *before* database record creation. Retrying cannot create duplicate drafts.

---

## 4. Live Verification Evidence

- **Unit Test Suite**: `tests/unit/geminiReliability.test.ts` (12 tests passed in 5.88s)
- **End-to-End Suite**: `tests/e2e/stage07-gemini-agent.spec.ts` (2 tests passed on desktop & mobile)
- **Live Production Endpoint Calls** (`https://invoicepilot-beryl.vercel.app/api/agent/prepare-invoice`):
  1. Prompt: *"Draft an invoice for Acme Global Solutions for 2 units of Cloud Architecture Consulting at 500.00 USD due 2026-11-20"*
     - **Result**: HTTP 200 in **5,704 ms** (`gemini-3.5-flash-lite` failover). Created draft `inv_da99fbba-6b52-4535-b0d5-57d26fe59a2d` for $1,000.00.
  2. Prompt: *"Draft an invoice for Acme Global Solutions for 1 Web Security Audit at 750 USD due 2026-11-25"*
     - **Result**: HTTP 200 in **4,524 ms** (`gemini-3.5-flash-lite`). Created draft `inv_2f3dba0e-507e-44ba-a53d-d66a78f09e54` for $750.00.
