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

## D-003 — Stage 00 repository baseline and upstream document reconciliation
- Date: 2026-10-31
- Status: ACTIVE
- Context and problem: Multiple specification files (`DECISIONS_LOG.md`, `PRD.md`, `FEATURE_DEVELOPMENT.md`, `UI_UX_DESIGN.md`, `HACKATHON_SUBMISSION.md`) reference `InvoicePilot_FINAL.md` (specifically Part 2, Part 6's 26-screen inventory, Part 7, Part 8, and Part 18) and `../MASTER_BUILD_DIRECTIVE.md`, neither of which exists in the repository or parent directory. Additionally, Stage 00 requires verifying what code exists in the repository.
- Requirements/source references: `docs/SOURCE_OF_TRUTH.md`, `docs/PRD.md`, `docs/FEATURE_STATUS.md`, `docs/IMPLEMENTATION_PLAN.md`.
- Options considered:
  1. Invent the missing 26 screens from `InvoicePilot_FINAL.md` Part 6.
  2. Use `docs/PRD.md`, `docs/UI_UX_DESIGN.md`, and the 14 feature groups in `docs/FEATURE_DEVELOPMENT.md` as the verified in-repository baseline while requesting `InvoicePilot_FINAL.md` Part 6 from the user before Stage 10/14 full screen expansion.
- Evidence and official documentation: Repository file tree inspection (`docs/DOCUMENTATION_AUDIT.md`) confirmed 0 application source files exist and neither `InvoicePilot_FINAL.md` nor `MASTER_BUILD_DIRECTIVE.md` is present on disk.
- Decision: Use `docs/PRD.md` and the 20-document `docs/` corpus as the active in-repository specification baseline; track the 14 documented feature groups (`F-001` through `F-014`) in `docs/FEATURE_STATUS.md`, and request user confirmation or delivery of `InvoicePilot_FINAL.md` Part 6 before full 26-screen buildout.
- Rationale and trade-offs: Prevents hallucinating requirements while enabling Stage 1–9 core foundation and PayPal Sandbox proof to proceed after stack confirmation.
- Security/privacy implications: None; preserves all server-side secret, approval-gate, and Sandbox isolation invariants.
- Implementation impact: Stage 00 is complete; Stage 1 awaits confirmation of stack choices or approval of the recommended Node.js + TypeScript + React (Vite) + Express + SQLite + Playwright stack.
- Verification plan: Reconcile `FEATURE_STATUS.md` if `InvoicePilot_FINAL.md` is supplied.
- Follow-up owner/action: User approved stack and 14-group baseline on 2026-10-31 (see `D-004`).

## D-004 — Approved Stage 01 Foundation Stack & 14-Group Screen Baseline
- Date: 2026-10-31
- Status: ACTIVE
- Context and problem: Stage 01 required user confirmation of the runtime/framework, database, auth mechanism, test runner, and the screen inventory baseline while `InvoicePilot_FINAL.md` (26-screen list) remains unavailable.
- Requirements/source references: User authorization prompt (2026-10-31), `docs/ARCHITECTURE.md`, `docs/PRD.md`, `docs/FEATURE_DEVELOPMENT.md`, `docs/UI_UX_DESIGN.md`.
- Options considered: Node.js 24 + TypeScript, React + Vite, Express, SQLite, HTTP-only session auth with isolated demo tenant, and Vitest + Playwright vs. external multi-service stack.
- Evidence and official documentation: Verified in Stage 01 implementation (`package.json`, `src/server/`, `src/client/`, `tests/unit/health.test.ts`, `tests/e2e/stage01-foundation.spec.ts`).
- Decision: Adopt Node.js 24 + TypeScript, React + Vite, Express, SQLite, HTTP-only session authentication with an isolated demo tenant, and Vitest + Playwright. Use the 14 feature groups in `docs/FEATURE_DEVELOPMENT.md` and `docs/PRD.md` (`F-001`–`F-014`) as the active requirements baseline while keeping the missing 26-screen list from `InvoicePilot_FINAL.md` documented as a gap without inventing screens.
- Rationale and trade-offs: Provides a deterministic, single-repository, judge-reproducible architecture with strict server-side validation and explicit `sandbox` vs. `mock` separation.
- Security/privacy implications: Enforces server-only secrets, root `.gitignore`, blank `.env.example`, and rejects invalid `PAYPAL_MODE` values (including `live`).
- Implementation impact: Stage 01 foundation implemented and verified.
- Verification plan: Verified via `npm run typecheck`, `npm test`, `npm run build`, and `npx playwright test`.
- Follow-up owner/action: Proceed to Stage 02 when authorized.

## Pending decisions
- Hosting platform.
- Direct PayPal REST vs MCP/Agent Toolkit, based on verified capabilities (prove direct PayPal Invoicing v2 REST in Sandbox first per `MCP_INTEGRATION.md`).
- Scheduler choice if reminder scheduling is implemented.
- Missing `InvoicePilot_FINAL.md` 26-screen list remains documented as an upstream gap; using the 14 feature groups (`F-001`–`F-014`) as the approved baseline.

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
