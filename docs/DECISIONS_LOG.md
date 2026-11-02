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

## D-005 — Direct PayPal Invoicing REST vs MCP / PayPal Agent Toolkit Evaluation
- Date: 2026-11-01 (Stage 13)
- Status: ACTIVE
- Context and problem: Stage 13 required evaluating official PayPal AI documentation, tool references, and MCP against direct REST calls. We must determine whether to integrate `@paypal/mcp` / `@paypal/agent-toolkit` or retain the existing direct PayPal Invoicing v2 REST adapter.
- Requirements/source references: Stage 13 Prompt, `docs/MCP_INTEGRATION.md`, `docs/PAYPAL_INTEGRATION.md`, `docs/ARCHITECTURE.md`.
- Options considered:
  1. Adopt `@paypal/agent-toolkit` or `@paypal/mcp` for agent-driven PayPal execution.
  2. Retain the verified Direct PayPal Invoicing v2 REST adapter (`src/server/paypal/adapter.ts`) and record MCP as `EVALUATED & DEFERRED (NOT SELECTED)`.
- Evidence and official documentation:
  - Official npm package research (`@paypal/agent-toolkit` and `@paypal/mcp`): Both SDKs are designed for autonomous agent execution loops (OpenAI Agents SDK, LangChain, Vercel AI SDK), where the LLM directly calls tools without a human approval gate.
  - `@paypal/mcp` requires static `PAYPAL_ACCESS_TOKEN` passing in environment variables, which expires in ~9h and does not support automated OAuth client credentials lifecycle management in standard stdio mode.
  - Direct REST v2 adapter is already fully verified in live Sandbox (`INV2-WHS9-X55V-Y6AJ-HAAQ`), with automated token caching and zero token exposure to the LLM context.
  - Direct REST guarantees the Human Approval Gate invariant (`DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`) is strictly enforced server-side.
- Decision: Retain Direct PayPal Invoicing v2 REST adapter as the authoritative PayPal integration. Defer MCP and PayPal Agent Toolkit as evaluated and not selected.
- Rationale and trade-offs:
  - Preserves strict server-side human approval gate and prevents arbitrary autonomous financial mutations.
  - Avoids pulling heavy third-party framework dependencies (`langchain`, `@ai-sdk/openai`) into our lightweight Gemini REST architecture.
  - Eliminates stdio child process management hazards and expired static token failures.
  - Directly fulfills the project mandate: *"Do not implement MCP just for a claim... If not selected, document why and keep status as evaluated/deferred, not connected."*
- Security/privacy implications:
  - Significantly reduces attack surface: no arbitrary tools exposed to LLM context; credentials never leave server process memory; prompt injection cannot bypass the approval slip.
- Verification plan: Verified in `tests/unit/stage13McpEvaluation.test.ts`, `docs/MCP_INTEGRATION.md`, and all existing unit and Playwright test suites.
- Follow-up owner/action: Keep status recorded as `EVALUATED & DEFERRED (NOT CONNECTED)` across all documentation and UI ledgers. Proceed to Stage 14 when authorized.

## Pending decisions
- Hosting platform.
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
