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
