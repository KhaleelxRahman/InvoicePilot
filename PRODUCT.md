# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Freelancers, independent consultants, digital agencies, and small service businesses who bill clients in multiple currencies, manage milestone contracts, and need reliable, low-friction payment management.

## Product Purpose

InvoicePilot is an AI-assisted invoicing and payment management workspace built for the PayPal AI Hackathon. It enables freelancers to draft invoices, resolve client details, calculate taxes and totals server-side, schedule client-aware reminders, and reconcile payments via PayPal Sandbox.

Every consequential action—sending an invoice, dispatching a reminder, or synchronizing payments—is guarded by a server-enforced human approval gate (`DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`). The system never sends invoices or moves money autonomously.

## Positioning

Unlike conventional accounting suites bloated with double-entry ledgers, and unlike unconstrained AI wrappers that hallucinate financial actions, InvoicePilot combines:
1. **Earned Familiarity**: A fast, distraction-free ledger and workspace that gets out of the freelancer's way.
2. **Server-Enforced Approval Slips**: Complete financial transparency and zero autonomous side-effects.
3. **PayPal Sandbox REST Integration**: Direct, production-grade PayPal v2 Invoicing integration with verified webhooks and webhook idempotency.
4. **Constrained Gemini Intelligence**: Structured natural language drafting with strict schema validation, prompt-injection sanitization, and automatic conventional form fallback.

## Key Workflows

- **Authentication & Workspace Onboarding**: Multi-tenant session authentication, password hashing with timing-safe scrypt, persistent session tokens, and a 4-step first-run onboarding wizard with instant demo workspace preview.
- **Client Management**: Unified directory of clients with currency defaults, billing notes, payment history, and lifetime value tracking.
- **Invoice Lifecycle**: Conventional and agent-assisted drafting, real-time client resolution, server-side line item calculations, approval slip review, PayPal Sandbox dispatch, status refresh, and manual/partial payment recording.
- **Client-Aware Reminders**: Tone-adjusted reminder drafting (`polite`, `firm`, `final`), server-enforced approval state machine, and observable scheduling.
- **Financial Insights**: Grounded multi-currency aging buckets, 30-day cash flow forecast estimates, payment latency tracking, and weekly activity summaries.
- **Developer & Audit Transparency**: Real-time mode indicators (`sandbox` vs. `mock`), verified PayPal webhook log with JSON inspector, and append-only activity trail.

## Constraints & Invariants

- **Financial Integrity**: Minor unit integers (`totalMinor`, `subtotalMinor`) with ISO currency codes; zero floating-point money math.
- **Sandbox Preservation**: Default provider mode to PayPal Sandbox (`PAYPAL_MODE=sandbox`); zero real money transactions, zero live payments.
- **Strict Human Approval Gate**: AI tool calls are proposals, never authorization. Discarded or rejected drafts never execute.
- **Accessibility & Craft**: WCAG AA color contrast (≥4.5:1 text), responsive layout from 360px mobile viewports to desktop, visible keyboard focus rings, and zero generic AI design tells.
