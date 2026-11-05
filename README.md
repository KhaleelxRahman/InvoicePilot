# InvoicePilot

> **AI-Assisted Invoicing & Safe Payment Workspace for Freelancers & Consultants**
> *Built for the PayPal AI Hackathon — Build What's Next with PayPal and AI.*

[![Live Website](https://img.shields.io/badge/Live%20Demo-inquisitive--biscochitos--83e042.netlify.app-00457C?style=for-the-badge&logo=netlify&logoColor=white)](https://inquisitive-biscochitos-83e042.netlify.app/)
[![GitHub Repository](https://img.shields.io/badge/GitHub-KhaleelxRahman%2FInvoicePilot-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/KhaleelxRahman/InvoicePilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Playwright Tests](https://img.shields.io/badge/Playwright-36%2F36%20Passed-brightgreen.svg?style=for-the-badge&logo=playwright&logoColor=white)](tests/e2e)
[![Vitest Unit Tests](https://img.shields.io/badge/Vitest-128%2F128%20Passed-brightgreen.svg?style=for-the-badge&logo=vitest&logoColor=white)](tests/unit)
[![TypeScript 5.7](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Database: Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)

---

## 🌐 Live Application & Official Links

* **Production Deployed Web App**: [https://inquisitive-biscochitos-83e042.netlify.app/](https://inquisitive-biscochitos-83e042.netlify.app/)
* **Live Health & Provider Status**: [https://inquisitive-biscochitos-83e042.netlify.app/api/health](https://inquisitive-biscochitos-83e042.netlify.app/api/health)
* **GitHub Repository**: [https://github.com/KhaleelxRahman/InvoicePilot](https://github.com/KhaleelxRahman/InvoicePilot)

---

## 1. Executive Summary & Problem Statement

### The Problem
Independent freelancers, contractors, and boutique agencies lose an average of **20+ hours each month** on administrative billing friction:
1. **Manual Invoicing Overhead**: Manually creating line items, calculating fractional sales taxes, and converting currency rates.
2. **Payment Chasing & Awkward Collections**: Uncomfortable follow-ups with overdue clients, resulting in strained client relationships or delayed cash flow.
3. **The Danger of Autonomous "AI Agents"**: Generative AI promises automation, but autonomous AI agents that send financial documents or trigger payment requests without human review represent an unacceptable business liability. Hallucinated totals, wrong recipient addresses, or premature dunning emails can destroy client trust.

### The Solution: InvoicePilot
InvoicePilot bridges generative AI and secure enterprise payments with an uncompromising principle: **AI prepares; the Human authorizes; PayPal transacts.**

* **Grounded AI Preparation**: Google Gemini drafts itemized invoices and tone-aware reminders using strict structured schemas. It resolves client names only against stored profiles—it cannot invent phantom clients or hallucinate totals.
* **The Human Approval Gate**: A server-enforced state machine (`DRAFTED` &rarr; `PENDING_APPROVAL` &rarr; `APPROVED` &rarr; `EXECUTING` &rarr; `EXECUTED`). Consequential actions require explicit human review via a digital Paper Action Authorization Slip before any call reaches PayPal.
* **Official PayPal Invoicing v2 Sandbox**: Direct REST API integration for creating drafts, retrieving official hosted buyer payment links, and processing signature-verified webhooks.
* **Production-Grade Craft**: High-contrast, responsive Impeccable design system, timing-safe scrypt user authentication, full client-side PDF downloads, and verified Supabase PostgreSQL cloud persistence.

---

## 2. Visual Walkthrough & Product Gallery

| Screen | Verified Capability | Screenshot |
| :--- | :--- | :--- |
| **Landing & Auth** | Dedicated sign-in and account registration with live password validation and timing-safe encrypted sessions. | ![Landing Page](docs/assets/screenshots/01-landing-page.png) |
| **Workspace Overview** | Clean, uncluttered dashboard welcoming fresh accounts with actionable zero-state quick links. | ![Workspace Overview](docs/assets/screenshots/03-overview-dashboard.png) |
| **Client Management** | Client profiles with currency defaults, billing preferences, and historical payment reliability tracking. | ![Client Management](docs/assets/screenshots/04-client-management.png) |
| **Conventional Invoice Drafting** | Real-time multi-item draft builder with exact integer minor-unit math and calendar date validations. | ![Invoice Creation](docs/assets/screenshots/05-invoice-draft-calculations.png) |
| **Invoice Details & PDF** | Official downloadable PDF copy generated locally via secure header-authenticated API routes. | ![Invoice Details & PDF](docs/assets/screenshots/06-invoice-details-pdf.png) |
| **The Human Approval Gate** | Authoritative Action Slip highlighting total amounts, recipient email, safety cap warnings, and execution consequences. | ![Approval Slip](docs/assets/screenshots/07-approval-slip-gate.png) |
| **Constrained Gemini AI** | Natural language invoice assistant converting conversational prompts into validated drafts with form fallback. | ![Gemini AI Assistant](docs/assets/screenshots/08-ai-gemini-assistant.png) |
| **Client-Aware Reminders** | Context-adaptive reminder generator offering Polite, Firm, or Final Notice tone based on payment history. | ![Client-Aware Reminders](docs/assets/screenshots/09-client-aware-reminders.png) |
| **PayPal Sandbox Settings** | Transparent provider status indicator, connection diagnostics, and safety limits configuration. | ![PayPal Settings](docs/assets/screenshots/11-paypal-sandbox-settings.png) |
| **Audit Trail & Activity Log** | Immutable append-only audit trail logging state transitions, provider IDs, and webhook receipts. | ![Audit Trail](docs/assets/screenshots/10-audit-trail-activity.png) |
| **Operational Completion** | Capability to mark deliverables and operational work as fulfilled without modifying payment status. | ![Operational Completion](docs/assets/screenshots/14-operational-work-completion.png) |
| **Mobile Responsive UX** | Seamless, zero-overflow experience tested across 360px and 390px mobile viewports with off-canvas navigation. | ![Mobile Responsive](docs/assets/screenshots/12-mobile-responsive-dashboard.png) |

---

## 3. Hackathon Judging Criteria — Evidence Map

| Official Criterion | How InvoicePilot Delivers | Verifiable Code / Evidence |
| :--- | :--- | :--- |
| **A. Technological Implementation** | Complete full-stack architecture: React 19 SPA, Express on Netlify Functions, Supabase PostgreSQL pooler with TLS enforcement, PayPal Invoicing v2 REST integration, Google Gemini structured output, and strict owner authorization. | • [`src/server/paypal/paypalClient.ts`](src/server/paypal/paypalClient.ts)<br>• [`src/server/ai/geminiClient.ts`](src/server/ai/geminiClient.ts)<br>• [`src/server/db/asyncRepository.ts`](src/server/db/asyncRepository.ts)<br>• 128 Vitest + 36 Playwright tests passing |
| **B. Design & User Experience** | Built on PBakaus's **Impeccable** design system: High-contrast typography (`Newsreader` serif + `Hanken Grotesk`), paper preview document aesthetics, responsive off-canvas mobile navigation, keyboard accessibility, dark/light theme toggle, and zero horizontal overflow. | • [`src/client/App.tsx`](src/client/App.tsx)<br>• [`src/client/components/InvoiceDetailView.tsx`](src/client/components/InvoiceDetailView.tsx)<br>• [`docs/assets/screenshots/`](docs/assets/screenshots/) |
| **C. Potential Impact** | Solves critical cash-flow and collection delays for 70M+ global freelancers. Protects independent contractors from awkward conversations through data-grounded tone reminders, prevents costly billing mistakes, and automates payment reconciliation via PayPal. | • [`src/server/domain/reminders.ts`](src/server/domain/reminders.ts)<br>• [`src/server/domain/calculations.ts`](src/server/domain/calculations.ts)<br>• [`tests/unit/stage11Reminders.test.ts`](tests/unit/stage11Reminders.test.ts) |
| **D. Innovation / Idea** | **The Authoritative Human Approval Gate**: Instead of dangerous autonomous agents that hallucinate or execute actions behind the user's back, InvoicePilot formalizes AI tools as *proposals*. The server physically blocks PayPal transmission until the human reviews and signs the digital slip. | • [`src/server/domain/approvalStateMachine.ts`](src/server/domain/approvalStateMachine.ts)<br>• [`src/client/components/ApprovalSlip.tsx`](src/client/components/ApprovalSlip.tsx)<br>• [`tests/unit/stage06Approval.test.ts`](tests/unit/stage06Approval.test.ts) |
| **E. Presentation & Polish** | Transparent product readiness: Comprehensive documentation, 170-second demo script, live Netlify site with health monitoring, 100% reproducible test suites, and clean open-source MIT repository. | • [`docs/HACKATHON_SUBMISSION.md`](docs/HACKATHON_SUBMISSION.md)<br>• Live Netlify Health API<br>• Fully scripted 3-minute walkthrough |

---

## 4. System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (React 19 + TypeScript)"]
        UI["Impeccable UI Shell"]
        AuthView["Auth & Registration"]
        DocPreview["Paper Invoice Preview"]
        SlipModal["Human Approval Slip Modal"]
        PDFDownloader["Client-Side PDF Downloader"]
    end

    subgraph ServerlessBackend["Netlify Serverless Functions (Node.js 22 LTS)"]
        Router["Express API Router"]
        AuthMiddleware["scrypt Session Auth & IDOR Guard"]
        StateMachine["Approval State Machine Guard"]
        CalcEngine["Integer Minor-Unit Math Engine"]
        GeminiAdapter["Gemini Structured Outputs Adapter"]
        PayPalAdapter["PayPal REST Invoicing v2 Client"]
    end

    subgraph DataStore["Cloud Persistence (Supabase)"]
        PostgresPool["PostgreSQL Connection Pool (pg.Pool)"]
        Tables[("Users, Sessions, Clients, Invoices, Actions, Activity")]
    end

    subgraph ExternalServices["External Providers"]
        GeminiAPI["Google Gemini 2.5 Flash API"]
        PayPalSandbox["PayPal Invoicing v2 Sandbox REST API"]
    end

    UI -->|HTTP / JSON + Bearer Token| Router
    Router --> AuthMiddleware
    AuthMiddleware --> StateMachine
    StateMachine --> CalcEngine

    CalcEngine -->|Query / Mutation| PostgresPool
    PostgresPool --> Tables

    StateMachine -.->|Draft Structured Invoice| GeminiAdapter
    GeminiAdapter -->|JSON Schema Prompt| GeminiAPI

    StateMachine ==>|Execute Approved Slip Only| PayPalAdapter
    PayPalAdapter -->|OAuth 2.0 Token + Invoicing v2| PayPalSandbox
    PayPalSandbox -.->|Webhooks (SHA256withRSA)| Router
```

---

## 5. Core Architectural Innovations

### 1. The Human Approval Gate State Machine
Consequential actions (such as dispatching an invoice to PayPal or delivering an overdue reminder) require explicit authorization. The server rejects any execution attempt unless an active approval slip has transitioned through the formal state machine:

```mermaid
stateDiagram-v2
    [*] --> DRAFTED: User or Gemini Agent creates draft
    DRAFTED --> PENDING_APPROVAL: Propose Action (Generates Approval Slip)
    PENDING_APPROVAL --> APPROVED: Human reviews & signs slip
    PENDING_APPROVAL --> REJECTED: Human discards or edits draft
    APPROVED --> EXECUTING: Trigger Dispatch Request
    APPROVED --> STALE_EXPIRED: Payload modified or timeout elapses
    EXECUTING --> EXECUTED: PayPal Sandbox confirms transmission
    EXECUTING --> FAILED: Provider error (Clean recovery & audit logged)
    EXECUTED --> [*]
    REJECTED --> [*]
    STALE_EXPIRED --> DRAFTED: Re-draft required
```

### 2. Grounded AI Integration (Google Gemini 2.5 Flash)
* **Zero Hallucinated Clients**: Gemini functions resolve client names strictly against stored `clients` in the active user's workspace.
* **Strict Schema Validation**: Tool outputs are validated against Zod schemas. If the model attempts to generate negative amounts, invalid currencies, or dates where `dueDate < issueDate`, the server rejects the response.
* **Always-Available Fallback**: If the Gemini API is unreachable, quota is exceeded, or credentials are unconfigured, the UI seamlessly preserves the full conventional invoice creation form.

### 3. Official PayPal Sandbox REST Workflow
* **OAuth 2.0 Client Credentials**: Automated token caching and renewal (`/v1/oauth2/token`).
* **Invoicing v2 Endpoints**: Creates drafts via `POST /v2/invoicing/invoices`, executes sends via `POST /v2/invoicing/invoices/{id}/send`, and synchronizes status via `GET /v2/invoicing/invoices/{id}`.
* **Reconciliation on Timeout**: If an ambiguous network timeout occurs during dispatch, InvoicePilot queries PayPal before retrying to prevent duplicate customer invoices.
* **Webhook Signature Verification**: Verifies incoming PayPal webhook signatures (`SHA256withRSA`) before processing status updates to `PAID` or `CANCELLED`.

---

## 6. Technology Stack

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6 | Fast, accessible single-page application with zero heavy UI library bloat. |
| **Styling & Design** | CSS Design Tokens, Impeccable System | Responsive layout (360px–1440px), high contrast, dark/light themes, serif document typography. |
| **Backend** | Node.js 22 LTS, Express 4.21, `serverless-http` | RESTful API running locally or deployed as Netlify Serverless Functions. |
| **Cloud Database** | Supabase PostgreSQL (`pg` pool, TLS) | Persistent cloud storage with foreign-key cascade safety and strict owner isolation. |
| **Local Database** | `node:sqlite` (DatabaseSync) | Zero-setup, instant in-memory or on-disk transactional database for development and tests. |
| **AI Engine** | Google Gemini API (`gemini-2.5-flash`) | Structured function calling with server-side validation. |
| **Payments** | PayPal Invoicing v2 REST API (Sandbox) | Official PayPal business invoicing, payment status refresh, and webhooks. |
| **Testing** | Vitest 3, Playwright 1.50 | 128 unit/integration tests and 36 end-to-end tests across Chromium and Mobile Edge. |

---

## 7. Quickstart & Local Setup

### Prerequisites
* **Node.js**: v22.13.0 LTS or higher (`node -v`)
* **npm**: v10.0.0 or higher (`npm -v`)

### 1. Clone & Install
```bash
git clone https://github.com/KhaleelxRahman/InvoicePilot.git
cd InvoicePilot
npm install
```

### 2. Configure Environment Variables
Create a local `.env` file from the template:
```bash
cp .env.example .env
```
Populate your environment variables (placeholders only; never commit secrets):
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration (Optional: SQLite used by default if blank)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres

# PayPal Developer Sandbox (Optional: Mock mode active if blank)
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret

# Google Gemini API (Optional: Conventional form fallback active if blank)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

### 3. Initialize Database Migrations
```bash
npm run db:migrate
```

### 4. Start Local Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser. Register a new account or log in with your credentials to explore the workspace.

---

## 8. Verification & Testing Evidence

InvoicePilot maintains automated test coverage across all domain rules, state machine transitions, and UI workflows:

```bash
# 1. Typecheck TypeScript across client and server
npm run typecheck

# 2. Run unit and integration tests (128 passing tests)
npm test

# 3. Production client & server build
npm run build

# 4. Run end-to-end Playwright tests (36 passing tests)
npx playwright test

# 5. Run visible headed Playwright tests (Watch browser live on screen)
npx playwright test tests/e2e/release-audit.spec.ts --headed
```

### Verified Test Summary
* **Unit & Integration (`vitest`)**: **128 / 128 Passed** across 19 suites:
  * Security regressions & IDOR prevention: 7/7
  * Approval slip & state machine: 6/6
  * PayPal Sandbox end-to-end: 5/5
  * Client-aware reminders: 6/6
  * Grounded insights & math calculations: 14/14
  * Supabase PostgreSQL engine: 10/10
  * Invoice PDF generator: 4/4
* **End-to-End (`playwright`)**: **36 / 36 Passed** across `desktop-chromium` (1280x800) and `mobile-360` (360x780).
* **Responsive Audits**: Verified on `1440x900` desktop and `390x844` mobile with **0 horizontal overflow**.

---

## 9. Production Deployment

* **Hosting Target**: **Netlify**
* **Deployment Method**: Continuous Deployment connected to GitHub `main` branch.
* **Serverless Adapter**: Express app wrapped via `serverless-http` under `netlify/functions/api.ts`.
* **Database Connection**: Supabase pooled connection with SSL strict TLS verification.
* **Production Health Check**:
  ```bash
  curl -s https://inquisitive-biscochitos-83e042.netlify.app/api/health
  ```
  Returns:
  ```json
  {
    "status": "ok",
    "service": "invoicepilot",
    "paypalMode": "sandbox",
    "databaseEngine": "postgresql-supabase",
    "databaseConfigured": true,
    "schemaVersion": 6,
    "approvalGateEnforced": true
  }
  ```

---

## 10. Future Roadmap

* **Live PayPal Production Mode**: Transition from Sandbox credentials to Live PayPal merchant onboarding once certified for production processing.
* **Multi-Currency FX Lock**: Automatic foreign currency lock-in at invoice creation date via ECB feeds.
* **WhatsApp & SMS Reminders**: Expand reminder delivery channels to include verified business WhatsApp templates.
* **Recurring Subscriptions**: Recurring retainer scheduling with automatic PayPal subscription billing.

---

## 11. License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

*InvoicePilot — Crafted for the PayPal AI Hackathon (2026).*
