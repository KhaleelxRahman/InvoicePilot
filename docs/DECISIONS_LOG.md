# Decisions Log

Record material decisions with date, context, options, evidence, rationale, consequences, and status. Do not backdate decisions or present assumptions as final decisions.

## D-001 — Source of truth
- Date: 2026-10-24 (workspace preparation date; adjust if inaccurate for actual project history)
- Decision: `InvoicePilot_FINAL.md` is the product authority.
- Rationale: It is the supplied final team document and replaces earlier briefs according to its opening section.
- Consequence: Feature scope and product design are traced back to this file.
- Status: ACTIVE

## D-002 — Initial implementation status
- Date: 2026-10-24 (workspace preparation date; adjust if inaccurate for actual project history)
- Decision: Treat application features and PayPal integration as unverified until actual project inspection and tests provide evidence.
- Rationale: The master directive explicitly states the current status is specification-only and no successful Sandbox API call has been tested.
- Consequence: Feature status starts as NOT STARTED unless actual inspection proves otherwise.
- Status: ACTIVE

## Pending decisions
- Runtime/framework based on actual project files.
- Database and auth provider (one each).
- Hosting platform.
- Direct PayPal REST vs MCP/Agent Toolkit, based on verified capabilities.
- Demo mode isolation and reset behavior.
- Scheduler choice if reminder scheduling is implemented.

### Decision template
- ID/date:
- Context/problem:
- Options considered:
- Evidence and official references:
- Decision:
- Rationale/trade-offs:
- Security impact:
- Follow-up/tests:
- Status:
