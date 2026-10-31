# Setup Guide

## Status
Stage 01 foundation commands verified on Node.js v24 (`2026-10-31`). Later database migration and PayPal Sandbox steps remain pending their respective stages.

## Verified Stage 01 Commands
- **Install dependencies:** `npm install`
- **Start local development server (Express API + Vite React shell on `http://localhost:3000`):** `npm run dev`
- **Typecheck (client + server + tests):** `npm run typecheck`
- **Run unit & API integration tests (Vitest):** `npm test`
- **Run end-to-end browser verification (Playwright desktop 1280x800 & mobile 360x780):** `npx playwright test` (or `npm run test:e2e`)
- **Build production bundle (`dist/client` + `dist/server`):** `npm run build`
- **Start production server:** `npm start`
- **Run Stage 02 PayPal Sandbox live verification script:** `npm run paypal:sandbox:verify`
- **Run Stage 03 PayPal Adapter live Sandbox verification script:** `npm run paypal:adapter:verify`
- **Apply Stage 04 SQLite schema migrations (`data/invoicepilot.db`):** `npm run db:migrate`
- **Reset and seed isolated demo tenant data (`usr_demo_tenant_01`):** `npm run db:seed:demo`

## Stage 02 PayPal Sandbox Account & Local Credential Setup (Never Paste Secrets in Chat)
To run `npm run paypal:sandbox:verify` against live PayPal Sandbox (`https://api-m.sandbox.paypal.com`):
1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/) and ensure **Sandbox** mode is selected.
2. Under **Testing Tools > Sandbox Accounts**, confirm you have:
   - One **Business (Merchant)** Sandbox account (e.g., `sb-merchant@business.example.com`) that issues invoices.
   - One **Personal (Buyer)** Sandbox account (e.g., `sb-buyer@personal.example.com`) that receives and pays invoices.
3. Under **Apps & Credentials** (Sandbox), create or select a REST API app linked to your Business Sandbox account, ensure **Invoicing** permissions/scopes are enabled, and copy the Sandbox **Client ID** and **Client Secret**.
4. Copy `.env.example` to `.env` locally at the repository root (`.env` is gitignored—never commit it or paste credentials into chat) and populate:
   - `PAYPAL_MODE=sandbox`
   - `PAYPAL_CLIENT_ID=<your-sandbox-client-id>`
   - `PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>`
   - `PAYPAL_SANDBOX_INVOICER_EMAIL=<optional-business-sandbox-email>`
   - `PAYPAL_SANDBOX_RECIPIENT_EMAIL=<personal-buyer-sandbox-email>`
5. Execute `npm run paypal:sandbox:verify` to run the live OAuth -> Create Draft -> Retrieve Draft -> Send Invoice -> Retrieve Post-Send verification sequence with automatic token/secret redaction.

## Prerequisites
- Git and the runtime/package manager required by the actual project.
- Access to the Google AI Studio project/build environment.
- PayPal Developer account and Sandbox business/personal test accounts.
- Gemini access if AI features are enabled.
- The selected database and authentication provider, if implemented.

## Initial setup procedure
1. Clone or open the actual repository.
2. Inspect `package.json` or the project's equivalent manifest and identify the real package manager and scripts.
3. Install dependencies using the lockfile-compatible command.
4. Copy `.env.example` to the environment file expected by the server, if supported.
5. Populate secrets only in local/server-side environment configuration. Never paste actual values into prompts or commit them.
6. Configure Sandbox mode explicitly.
7. Configure the selected database/auth provider only after the decision is documented.
8. Run migrations/seed scripts only if they exist and have been reviewed.
9. Start the app using the verified project command.
10. Run the documented test commands and manually verify the core flow.

## Environment variable inventory (names are proposals until implementation is inspected)
```dotenv
APP_ENV=development
APP_BASE_URL=
DATABASE_URL=
GEMINI_API_KEY=
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
AUTH_PROVIDER=
```
Do not put real values in this file or the repository. Remove variables that do not apply to the chosen architecture. Do not expose private values through frontend-prefixed variables.

## Sandbox checklist
- [ ] Developer app and Sandbox credentials created.
- [ ] Business and personal Sandbox accounts available.
- [ ] Credentials configured server-side.
- [ ] OAuth request succeeds and token is never logged in full.
- [ ] Supported invoice operation succeeds.
- [ ] Provider invoice ID is saved and retrieval succeeds.
- [ ] Buyer flow and payment status tested if supported.
- [ ] Webhook verification tested if implemented.

## Troubleshooting
Capture the exact error and request correlation ID; redact secrets, tokens, customer data, and sensitive headers. Check environment mode, credentials, scopes, payload schema, network access, and current official provider docs. Do not retry consequential operations blindly after timeouts; reconcile state first.
