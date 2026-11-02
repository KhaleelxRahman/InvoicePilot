# AI Agent Design and Safety

## Purpose
Help users prepare invoices, retrieve grounded information, draft reminders, and explain available financial records. The agent proposes actions; it does not independently authorize financial operations.

## Initial capabilities
- Parse natural-language invoice requests into structured candidate drafts.
- Resolve client references only against authorized stored clients.
- Ask a concise clarification when required information is missing or ambiguous.
- Explain validation errors.
- Retrieve and summarize authorized invoice records.
- Identify overdue invoices using persisted dates/status.
- Draft client-appropriate reminders.
- Summarize aging/forecast data only after those calculations exist and are tested.

## Candidate tool names
- `prepare_invoice_draft`
- `get_invoice_details`
- `request_invoice_send_approval`
- `get_financial_insights`
- `send_approved_invoice`

Tool names and schemas must match the actual implementation. A model tool call is not authorization.

## Required controls
1. Strict schema validation of model output.
2. Server-side client/invoice ownership checks.
3. Server-side financial calculations and amount limits.
4. Currency/date validation.
5. Explicit human approval before sending.
6. Revalidation immediately before execution.
7. Duplicate-action protection and stale-approval handling.
8. Activity records for proposed/approved/rejected/failed/executed states.
9. Safe provider/model timeout handling.
10. Prompt-injection resistance: treat client notes and user text as untrusted data, not system instructions.

## Approval state machine (proposal)
`DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`

Alternative terminal/recovery states: `REJECTED`, `EXPIRED`, `FAILED`, `CANCELLED`. Enforce valid transitions server-side. A discarded/rejected action must not send an invoice.

## Model failure behavior
- If Gemini is unavailable, offer the conventional invoice form.
- If output is malformed, reject it and ask for a retry/clarification; do not execute.
- If provider execution times out, reconcile by retrieving provider/local state before retrying.
- Never claim payment received or invoice sent without authoritative evidence.

## Evaluation cases
Missing client; ambiguous amount; invalid currency; missing due date; amount over limit; approval bypass attempt; prompt injection in notes; duplicate tool call; unauthorized invoice ID; stale approval; provider timeout; model timeout; unsupported financial claim; Hinglish input if supported.

## Privacy
Store only necessary conversation data, never secrets, and document retention/deletion. Clearly communicate when the agent uses stored client or invoice data.

## Stage 07 Verified Implementation & Model/Config Limitations
- **Implementation (`src/server/agent/geminiAgent.ts`, `src/server/app.ts`, `src/client/App.tsx`)**:
  - Uses the official Google Gemini REST `generateContent` endpoint (`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`) with server-only `x-goog-api-key` authentication, `tools.functionDeclarations`, and `generationConfig.responseSchema` (`responseMimeType: "application/json"`).
  - Implemented and schema-validated tools:
    - `prepare_invoice_draft`: Resolves clients strictly from `repo.listClientsForOwner(ownerUserId)`, validates ISO-4217 currency, YYYY-MM-DD calendar dates, positive integer quantities, decimal unit prices, tax rates, and workspace safety limit (`maxInvoiceAmountMinor`) before saving a local `DRAFT`.
    - `get_invoice_details`: Retrieves an authorized invoice record via `repo.getInvoiceForOwner(ownerUserId, id)` (denying cross-owner access with `403 FORBIDDEN_OWNER_MISMATCH`).
    - `request_invoice_send_approval`: Proposes an existing local draft for human review on the Approval Slip (`DRAFTED -> PENDING_APPROVAL`).
    - `ask_clarification`: Requests concise user clarification when client, amount, or fields are missing or ambiguous.
  - Restricted tools (`send_approved_invoice`, `approve_action`, `execute_action`) are explicitly blocked if emitted by a model; consequential execution is only possible through the human Approval Slip workflow (`POST /api/actions/:id/approve` and `POST /api/actions/:id/execute`).
- **Model & Configuration Limitations**:
  - `GEMINI_API_KEY` is optional in local development (`.env` currently has `GEMINI_API_KEY=` blank unless supplied by the operator). When `GEMINI_API_KEY` is blank, invalid, rate-limited, or times out (`GEMINI_TIMEOUT_MS`, default `15000`ms), `/api/agent/prepare-invoice` returns `status: "AGENT_ERROR"` with `fallbackToConventionalForm: true` and preserves full access to the conventional non-AI invoice form.
  - Reminder drafting (`Stage 11`) is verified using `POST /api/invoices/:id/reminders/draft` and `repo.generateReminderDraft`.
  - Grounded aging and cash-flow insights (`Stage 12`) are implemented via the candidate tool `get_financial_insights` and endpoint `GET /api/insights`. Projections are probability-weighted statistical estimates (`isEstimate: true`), currencies are strictly isolated without combining, and clients without payment history are tagged `INSUFFICIENT_HISTORY`.
  - Verified by `tests/unit/stage12Insights.test.ts` (14/14 passed) and `tests/e2e/stage12-insights.spec.ts` (desktop + 360px mobile).
