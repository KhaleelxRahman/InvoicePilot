# MCP and PayPal Agent Toolkit Evaluation

## Current Status
**EVALUATED & DEFERRED (NOT SELECTED)** — 2026-11-01.
Do not connect or claim `@paypal/mcp` or `@paypal/agent-toolkit` is active in production. The repository retains its verified Direct PayPal Invoicing v2 REST adapter as the authoritative, secure, and human-gated payment integration.

---

## Decision Principle & Executive Summary
In accordance with InvoicePilot Core Rules and Stage 13 directive:
> *"Do not implement MCP just for a claim. Research current official PayPal AI docs and the tool reference. Compare supported invoicing capabilities, auth, permissions, Sandbox behavior, runtime compatibility, and security with direct REST calls. Recommend one approach with evidence."*

Following research into current official PayPal AI documentation, the `@paypal/agent-toolkit` (npm), and `@paypal/mcp` (npm) tool references, **we recommend and decide to retain Direct PayPal Invoicing v2 REST calls and NOT adopt MCP / Agent Toolkit for live execution.**

---

## Detailed Evaluation & Comparative Evidence

| Criterion | Direct PayPal Invoicing v2 REST (Selected) | PayPal Agent Toolkit (`@paypal/agent-toolkit`) | Model Context Protocol (`@paypal/mcp`) |
|---|---|---|---|
| **Official Documentation & Source** | Current PayPal Developer Invoicing v2 REST API specification (`api-m.sandbox.paypal.com/v2/invoicing/invoices`). | Official PayPal open-source package (`@paypal/agent-toolkit` on npm / `paypal/agent-toolkit` on GitHub). | Official PayPal MCP server (`@paypal/mcp` on npm / `paypal/agent-toolkit` monorepo). |
| **Target Runtime & Frameworks** | Native Node.js 24 + TypeScript with `node:crypto` and standard `fetch`. Zero external dependencies. | Designed for OpenAI Agents SDK, LangChain, Vercel AI SDK (`ai`), CrewAI, and Amazon Bedrock. | Model Context Protocol clients (Claude Desktop, Cursor, Cline) via stdio or SSE. |
| **Invoicing Capabilities** | Full lifecycle: draft creation (`POST /v2/invoicing/invoices`), detailed itemization with currency minor units, custom notes, tax rates, sending (`POST /v2/invoicing/invoices/{id}/send`), live status retrieval (`GET /v2/invoicing/invoices/{id}`), recipient payment links (`payment_links`), and delivery reminders (`POST .../remind`). Proven in Sandbox (`INV2-WHS9-X55V-Y6AJ-HAAQ`, `INV2-M6YP-NTGY-TRXS-W5FN`). | Exposes functions: `create_invoice`, `list_invoices`, `get_invoice`, `send_invoice`, `send_invoice_reminder`, `record_payment_for_invoice`, `cancel_sent_invoice`. | Mirrors Agent Toolkit functions over JSON-RPC / stdio protocol. |
| **Authentication & Token Lifecycle** | Server-managed OAuth 2.0 client credentials (`grant_type=client_credentials`) with automatic token renewal and caching. `PAYPAL_CLIENT_SECRET` never leaves server memory. | Accepts `clientId` and `clientSecret`, manages internal tokens. | Requires static `PAYPAL_ACCESS_TOKEN` passed via environment variables. Tokens expire after ~9 hours, requiring manual renewal or an external token-refresh sidecar. |
| **Human Approval Gate & Safety Boundary** | **Strictly enforced server-side.** State machine: `DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`. Model tool calls are proposals only. Discarded or rejected drafts can never execute. Payload hash and amount limits revalidated immediately before execution. | **Autonomous by default.** Agent loops (`maxSteps: 10`) allow the model to invoke `send_invoice` or `create_invoice` directly upon LLM decision, violating InvoicePilot's Human Approval Gate Invariant. | **Autonomous by default.** MCP hosts call tools directly based on LLM outputs without a server-enforced state machine or approval slip. |
| **Runtime Compatibility with Stack** | 100% native compatibility with Google Gemini (`gemini-2.5-flash`), Express, SQLite, and Vite frontend. | Requires heavy external dependencies (`@ai-sdk/openai`, `langchain`, `ai`) that conflict with the lightweight, constrained Gemini REST architecture. | Spawns external child processes via `npx -y @paypal/mcp`, introducing process lifecycle hazards, startup latency, and stdio IPC overhead. |
| **Prompt Injection Surface** | Minimal. Model outputs are strictly schema-validated envelopes. Model cannot call restricted tools (`send_approved_invoice`, `approve_action`, `execute_action`). Prompt injection in client notes cannot bypass the approval gate. | Elevated. If tools are passed to an autonomous agent loop, prompt injection could induce the model to execute financial mutations (`send_invoice`, `record_refund`) without human intervention. | Elevated. Unrestricted MCP tool exposure (`--tools=all`) enables arbitrary tool execution if prompt injection succeeds in the host. |
| **Sandbox & CI Determinism** | 100% verified. Real Sandbox verification scripts (`npm run paypal:sandbox:verify`, `npm run paypal:adapter:verify`) and isolated mock mode (`PAYPAL_MODE=mock`) allow deterministic, offline-capable unit and Playwright testing. | Untested in our specific stack; introduces third-party SDK bugs outside our direct control. | Requires external network and valid short-lived bearer token for every stdio run; brittle in CI pipelines. |

---

## Evaluation Checklist Findings

1. **Official product/repository/documentation:**
   - PayPal maintains `@paypal/agent-toolkit` (v0.3.x) and `@paypal/mcp` (v0.2.x) on npm. They are active community SDKs aimed primarily at OpenAI/LangChain/Claude Desktop integrations.
2. **Invoicing operations exposed:**
   - Both toolkits expose basic invoicing functions (`create_invoice`, `send_invoice`, `get_invoice`, `list_invoices`). However, they do not offer any capabilities beyond what PayPal Invoicing v2 REST already provides.
3. **Auth flow, permissions, and Sandbox support:**
   - `@paypal/mcp` requires a pre-existing `PAYPAL_ACCESS_TOKEN` environment variable rather than performing automated OAuth client credentials negotiation. This introduces operational fragility since tokens expire in ~9 hours.
4. **Runtime compatibility with Google AI Studio / Gemini:**
   - InvoicePilot uses Google Gemini via official REST v1beta function declarations and structured JSON output. `@paypal/agent-toolkit` provides adapters for Vercel AI SDK and LangChain, but lacks a first-class, lightweight integration for raw Gemini REST calls without pulling in unnecessary wrapper frameworks.
5. **Approval and authorization check location:**
   - In MCP and Agent Toolkits, tools execute immediately when the agent decides to invoke them. In InvoicePilot, financial execution must *never* happen autonomously; consequential actions require human review on the Approval Slip.
6. **Prompt injection & arbitrary tool risks:**
   - Granting an agent direct access to an MCP server exposing `send_invoice` or `record_refund` creates high-severity prompt injection vulnerability. Keeping tool calls strictly as *draft proposals* reviewed by humans eliminates this vulnerability by design.
7. **Implementation cost vs. demo reliability:**
   - Direct REST is already 100% implemented, tested, and verified across Stages 02, 03, and 08. Adopting MCP would replace working, tested code with an experimental wrapper that adds latency and failure points without improving user experience.

---

## Final Decision & Architecture Invariant
- **Decision:** **RETAIN DIRECT PAYPAL REST v2 ADAPTER; DEFER MCP / AGENT TOOLKIT.**
- **Status in UI & Docs:**
  - Status is recorded as `EVALUATED & DEFERRED (NOT CONNECTED)` in `docs/FEATURE_STATUS.md` and `docs/DECISIONS_LOG.md` (Decision `D-005`).
  - InvoicePilot will not claim MCP connectivity or display misleading "MCP Connected" badges.
  - Core PayPal Sandbox operations remain powered by the verified adapter (`src/server/paypal/adapter.ts`).
