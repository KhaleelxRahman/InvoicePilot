# Product Requirements Document

## Status
Draft generated from the supplied master directive and `InvoicePilot_FINAL.md`. Update after project inspection. This document does not prove any feature exists.

## Problem
Freelancers, consultants, and very small businesses need to create invoices, follow up on unpaid invoices, and understand expected cash flow without juggling disconnected tools. InvoicePilot aims to reduce administrative effort while keeping users in control of financial actions.

## Product vision
An AI-assisted invoicing workspace combining conventional invoice controls, a natural-language agent, real PayPal Sandbox invoicing, client-aware reminder drafts, and grounded financial insights.

## Target users
- Freelancers and independent consultants
- Small service businesses
- Users who issue invoices and manually follow up on payments

## Goals
1. Demonstrate meaningful, genuine PayPal Sandbox integration.
2. Demonstrate useful AI that produces validated invoice drafts.
3. Require explicit human approval for consequential actions.
4. Deliver a coherent, responsive product experience.
5. Make the project reproducible from its public repository and documentation.

## Non-goals for the first MVP
- Live-money processing
- Autonomous invoice sending
- Multi-provider accounting suite
- Unverified MCP integration solely for marketing
- Complex enterprise permissions or multi-service architecture without a demonstrated need

## Primary user journey
Use the primary acceptance journey in `../MASTER_BUILD_DIRECTIVE.md`: enter app; select/create client; draft invoice; review approval slip; approve; execute a real Sandbox operation; retrieve provider details; test supported buyer payment; synchronize verified status; review Activity.

## Functional requirements
- Client CRUD with ownership enforcement.
- Invoice draft creation/editing with line items, currency, due date, tax where specified, and validation.
- Natural-language draft preparation through a constrained AI agent, with a conventional form fallback.
- Approval state machine and explicit confirmation before sending.
- Server-side PayPal Sandbox OAuth and supported invoice lifecycle operations.
- Persistent invoice records with provider IDs and separate local/provider status.
- Safe payment status synchronization and verified webhook handling if implemented.
- Activity history for important user/agent/provider events.
- Client-aware reminder drafting; scheduled/sent behavior only when actually implemented and verified.
- Grounded aging and cash-flow insights only from available persisted data.
- Clearly separated mock and Sandbox modes.

## Quality requirements
- Secrets server-side; server authorization and validation.
- Exact/safe money representation and explicit currency.
- Idempotent webhook handling and duplicate-action protection where applicable.
- Responsive layouts, keyboard navigation, visible focus, contrast-conscious themes.
- Meaningful loading, empty, success, and error states.
- Reproducible setup, tests, and honest limitation documentation.

## MVP acceptance criteria
- [ ] App starts from documented setup.
- [ ] A client can be created/selected and stored.
- [ ] A valid invoice can be drafted conventionally without AI.
- [ ] AI can prepare a validated draft or ask for clarification; failure falls back to form.
- [ ] User can edit/discard draft; discard does not send.
- [ ] Explicit approval is required before server execution.
- [ ] Real Sandbox OAuth is verified.
- [ ] A real Sandbox invoice operation returns an actual provider ID.
- [ ] The invoice can be retrieved from PayPal using that ID.
- [ ] Errors do not falsely show success.
- [ ] Activity captures the relevant transitions.
- [ ] README enables another person to reproduce the demo.

## Success measures for the demo
- Complete end-to-end path succeeds repeatedly.
- Judges can distinguish AI assistance from actual provider operations.
- Approval and failure states are understandable.
- Repository and demo instructions are reproducible.

## Risks
See `RISKS.md` and `DECISIONS_LOG.md`. Critical risks include API integration uncertainty, secret exposure, unsupported flow assumptions, false status claims, scope creep, and time constraints.

## Open questions
Resolve based on project inspection and source specification: actual runtime capabilities; selected database/auth; available secrets configuration; precise supported PayPal invoice flow; hosting target; whether optional integrations are worth the cost.
