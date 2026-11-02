# InvoicePilot

> AI-assisted invoicing and payment management workspace for freelancers, consultants, and small service businesses, built for the **PayPal AI Hackathon**.

InvoicePilot combines grounded Gemini structured invoice preparation, an authoritative **Human Approval Gate** state machine, official **PayPal Sandbox REST Invoicing v2** integration, client-aware tone-adjusted reminder drafting, and verified receivables aging & 30-day probability-weighted cash-flow forecasts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 22 LTS](https://img.shields.io/badge/Node.js-22%20LTS-green.svg)](https://nodejs.org/)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Playwright Tests](https://img.shields.io/badge/Playwright-24%2F24%20Passed-brightgreen.svg)](tests/e2e)
[![Vitest Unit Tests](https://img.shields.io/badge/Vitest-91%2F91%20Passed-brightgreen.svg)](tests/unit)

---

## Key Features

1. **Grounded AI Invoice Drafting (Gemini Structured Outputs)**:
   - Natural language invoice preparation via Gemini function calling.
   - Client names resolved strictly against authorized stored profiles.
   - Strict Zod schema validation; mathematical recalculations of taxes, subtotals, and totals enforced server-side.
   - Conventional form fallback preserved whenever AI is unavailable or produces invalid inputs.
   - Prompt-injection sanitization prevents parameter overrides or unauthorized payment status claims.

2. **Authoritative Human Approval Gate**:
   - Consequential financial operations (sending invoices or reminders) cannot be executed autonomously by AI.
   - Enforces a formal state machine: `DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED` (with terminal states `REJECTED`, `EXPIRED`, `FAILED`, `CANCELLED`).
   - Paper approval slip UI presents total, currency, recipient summary, warnings, safety limit comparisons, and what will happen.
   - Revalidates invoice totals, currency, and staleness immediately before sending.

3. **Official PayPal Sandbox REST Integration**:
   - Live OAuth 2.0 token exchange with client credential protection.
   - Invoicing v2 draft creation, retrieval, and sending.
   - Separate tracking of local draft state vs. provider-confirmed status (`DRAFT`, `SENT`, `PAID`, `CANCELLED`).
   - Signature-verified PayPal webhook processing (`SHA256withRSA`) with payload hash deduplication.
   - Ambiguous timeout reconciliation to prevent duplicate invoice sends.

4. **Client-Aware Reminder Drafts & Tone Templates**:
   - Generates tone-adjusted reminders (`polite`, `firm`, `final`) based on actual invoice age and historical payment performance.
   - Requires explicit human approval before any reminder is delivered.
   - Observable scheduler (`POST /api/reminders/process-scheduled`) processes due reminders against verified delivery targets.

5. **Receivables Aging & Cash-Flow Insights**:
   - Grounded receivables aging buckets (`current`, `1–30d`, `31–60d`, `61–90d`, `90d+`) derived purely from validated database records.
   - Probability-weighted 30-day cash-flow forecast labeled explicitly as estimates with confidence indicators.
   - Client reliability ratings and payment latency rankings calculated from actual payment history.
   - Partial payment tracking with automatic settlement when balance reaches zero.

6. **Authentication, Demo Isolation & Privacy Controls**:
   - Multi-tenant session authentication with `scrypt` password hashing and secure HttpOnly cookie / Bearer token support.
   - Pre-seeded deterministic demo tenant (`demo.freelancer@invoicepilot.local`) with safe 1-click reset that never touches other user data.
   - Developer mode with PayPal Webhook Event Viewer and raw JSON payload modal inspector.
   - Data privacy: sanitized workspace JSON export and permanent cascading account deletion.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, responsive CSS design tokens (`360px` mobile to desktop), WCAG AA contrast, Light/Dark/System theme toggle. Deployed on **Netlify**.
- **Backend**: Node.js 22 LTS, Express 4.21, adapted for **Netlify Functions** (`serverless-http`), with local development server support.
- **Database**: **Supabase Free PostgreSQL** (`pg` connection pool with SSL) for serverless production; on-disk SQLite (`node:sqlite` DatabaseSync) with transactional migrations for local development & testing.
- **AI Agent**: Google Gemini API via official structured outputs schema and strict server-side validation.
- **Payment Provider**: PayPal Sandbox REST APIs (OAuth 2.0, Invoicing v2, Webhooks v1).
- **Testing**: Vitest 3 (unit & contract tests), Playwright 1.50 (end-to-end tests across desktop-chromium and mobile-360).

---

## Quick Start (Fresh Setup)

### Prerequisites
- Node.js 22 LTS or later (`node -v`)
- npm 10 or later (`npm -v`)

### 1. Clone & Install
```bash
git clone https://github.com/KhaleelxRahman/InvoicePilot.git
cd InvoicePilot
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
*(InvoicePilot runs out of the box in `PAYPAL_MODE=mock` or `PAYPAL_MODE=sandbox`. To connect live Sandbox credentials, populate `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`.)*

### 3. Initialize Database & Seed Demo Tenant
```bash
npm run db:migrate
npm run db:seed:demo
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The workspace automatically logs into the demo freelancer tenant.

### 5. Production Build & Execution
```bash
npm run build
npm start
```

---

## Available NPM Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Starts dev server with Vite HMR on `http://localhost:3000` |
| `npm run build` | Builds client assets via Vite and compiles server TypeScript into `dist/` |
| `npm start` | Runs compiled production Express server from `dist/server/index.js` |
| `npm run typecheck` | Type-checks entire codebase (`tsc --noEmit`) |
| `npm test` | Runs all 91 unit and contract tests via Vitest |
| `npm run test:e2e` | Runs all 24 Playwright end-to-end user journeys (desktop + 360px mobile) |
| `npm run paypal:sandbox:verify` | Standalone CLI proof verifying live PayPal Sandbox Invoicing v2 API |
| `npm run paypal:adapter:verify` | Verifies PayPal adapter draft/send/retrieve in current mode |
| `npm run db:migrate` | Applies pending SQLite schema migrations |
| `npm run db:migrate:supabase` | Applies schema migrations and synthetic demo seed to Supabase PostgreSQL |
| `npm run db:seed:demo` | Seeds or resets demo tenant data (`demo.freelancer@invoicepilot.local`) |

---

## Hackathon Evaluation & Demo Guide

For evaluators reviewing the submission:
- **Demo Arc & Walkthrough**: Consult [`docs/HACKATHON_SUBMISSION.md`](docs/HACKATHON_SUBMISSION.md) for the structured 3-minute demo script.
- **Feature Verification Ledger**: Inspect [`docs/FEATURE_STATUS.md`](docs/FEATURE_STATUS.md) for reproducible test evidence for every feature.
- **PayPal Integration Evidence**: Inspect [`docs/PAYPAL_INTEGRATION.md`](docs/PAYPAL_INTEGRATION.md) for Sandbox API response logs and webhook verification results.
- **Architecture & Security**: Consult [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/AUTH_SECURITY.md`](docs/AUTH_SECURITY.md).
- **Decision Records**: See [`docs/DECISIONS_LOG.md`](docs/DECISIONS_LOG.md) for architecture decisions (including D-005 on Direct REST v2 vs. MCP).

---

## License

This project is licensed under the [MIT License](LICENSE).
