# Deployment and Release Guide

## Deployment Architecture & Platform Compatibility

InvoicePilot is built as a single-process, production-ready full-stack application:
- **Server Runtime**: Node.js 22 LTS is required because the database persistence layer utilizes the official Node.js built-in `node:sqlite` (`DatabaseSync`) module.
- **Client Delivery**: Express static asset middleware serves the compiled SPA from `dist/client`, with client-side SPA routing fallback to `dist/client/index.html`.
- **Database Persistence**: SQLite database stored on disk (configured via `DATABASE_URL`).
- **Provider Security**: PayPal credentials (`PAYPAL_CLIENT_SECRET`), webhook IDs, Gemini API keys, and session secrets are retained strictly on the server and never sent to or bundled in the browser.

### Recommended Cloud Hosting Options (Node 22 + Persistent Disk)
1. **Railway**:
   - Runtime: Node.js 22 (via `nixpacks.toml` or Dockerfile).
   - Storage: Attach a Railway Persistent Volume mounted at `/data`.
   - Set `DATABASE_URL=/data/invoicepilot.sqlite`.
2. **Render**:
   - Service: Web Service (Node environment).
   - Storage: Render Persistent Disk mounted at `/var/data`.
   - Set `DATABASE_URL=/var/data/invoicepilot.sqlite`.
3. **Fly.io**:
   - Deploy via Dockerfile with `fly vol create invoicepilot_data` mounted at `/data`.
4. **Self-Hosted VPS (Ubuntu 24.04 LTS / Debian 12)**:
   - Run Node 22 via PM2 or systemd unit behind Nginx reverse proxy with Let's Encrypt SSL.

---

## Required Environment Variables

| Variable | Required | Description | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Node environment | `production` |
| `PORT` | Yes | HTTP port | `3000` |
| `APP_BASE_URL` | Yes | Public HTTPS URL | `https://invoicepilot.yourdomain.com` |
| `DATABASE_URL` | Yes | Path to persistent SQLite database file | `/data/invoicepilot.sqlite` |
| `SESSION_SECRET` | Yes | Cryptographic secret for signing auth tokens | `64-character-hex-string` |
| `AUTH_PROVIDER` | No | Auth mechanism (default: `session`) | `session` |
| `PAYPAL_MODE` | Yes | Provider mode (`sandbox` or `mock`) | `sandbox` |
| `PAYPAL_CLIENT_ID` | Yes (Sandbox) | PayPal Sandbox App Client ID | `A...` |
| `PAYPAL_CLIENT_SECRET` | Yes (Sandbox) | PayPal Sandbox App Secret | `E...` |
| `PAYPAL_WEBHOOK_ID` | Optional | PayPal Webhook ID for signature verification | `WH-...` |
| `GEMINI_API_KEY` | Optional | Google Gemini API key for structured agent | `AIza...` |
| `PAYPAL_TIMEOUT_MS` | No | HTTP timeout in milliseconds (default: 15000) | `15000` |

---

## Production Build & Startup Sequence

```bash
# 1. Install production dependencies
npm ci --omit=dev

# 2. Build Vite frontend SPA & compile TypeScript server to dist/
npm run build

# 3. Apply SQLite schema migrations to production database
npm run db:migrate

# 4. (Optional) Seed initial demo tenant data for evaluation
npm run db:seed:demo

# 5. Launch compiled Express server
npm start
```

---

## Webhook Endpoint Configuration

Configure the PayPal Sandbox Webhook in the PayPal Developer Dashboard:
- **Webhook URL**: `https://<your-domain>/api/webhooks/paypal`
- **Subscribed Events**:
  - `INVOICING.INVOICE.PAID`
  - `INVOICING.INVOICE.CANCELLED`
  - `INVOICING.INVOICE.REFUNDED`
  - `INVOICING.INVOICE.SCHEDULED`
- **Verification**: The server automatically validates incoming webhook signatures via `POST /v1/notifications/verify-webhook-signature` using `PAYPAL_WEBHOOK_ID`.

---

## Rollback & Failure Recovery Procedures

1. **Application Code Rollback**:
   - Re-deploy previous known-good Git commit using hosting platform's 1-click rollback or container tag re-pointing.
2. **Database Migration Safety**:
   - Migrations are append-only and backward-compatible (Version 1 through 5). Column additions and new tables do not break prior version reads.
   - Backup SQLite database file prior to deployment: `sqlite3 /data/invoicepilot.sqlite ".backup /data/backup-$(date +%s).sqlite"`.
3. **Provider Fallback**:
   - If PayPal Sandbox APIs experience outages, switch `PAYPAL_MODE=mock` in host environment variables to preserve local workflow testing without inventing provider success.

---

## Release Record & Final Verification Audit

- **Release Date**: 2026-11-02
- **Target Git Branch**: `main`
- **Target Architecture**: Netlify (Frontend Static SPA + Netlify Functions Serverless Express API) + Supabase Free PostgreSQL
- **Local Production Build Verification**: `dist/client` + `dist/server` built and verified (`npm run build`, `npm run typecheck` passed with 0 errors)
- **Deployment Status**: `PREPARED & VERIFIED LOCALLY` (Netlify configuration `netlify.toml` and serverless adapter `netlify/functions/api.ts` prepared; Supabase PostgreSQL migration script `migrations/001_initial_supabase_schema.sql` and CLI `db:migrate:supabase` prepared)
- **Database Engine**: Supabase Free PostgreSQL (with local SQLite retained for offline development and local test suite)
- **Supabase Free Limits & Constraints**:
  - Storage: 500 MB database quota
  - Inactivity Pauses: Free tier projects automatically pause after 7 consecutive days of inactivity; can be unpaused from the Supabase Project Dashboard
  - Connection Pooling: Use Supabase Transaction Pooler (`port 6543`) with `?sslmode=require` for serverless Netlify Functions to prevent database connection exhaustion
- **Netlify Deployment Configuration**:
  - Build command: `npm run build`
  - Publish directory: `dist/client`
  - Functions directory: `netlify/functions`
  - Same-origin routing: `[[redirects]] from = "/api/*" to = "/.netlify/functions/api/:splat" status = 200`
- **Demo Video**: `NOT RECORDED` (170-second rehearsal script prepared in `docs/HACKATHON_SUBMISSION.md`; awaiting video recording)
- **Test Suite Results**:
  - Unit/Contract Tests: 91/91 passed (100% pass across 14 test suites)
  - Playwright E2E Tests: 24/24 passed across `desktop-chromium` (1280x800) and `mobile-360` (360x780)
- **Clean Setup Check**: Fresh database migration (`v1`) and demo seeding (`usr_demo_tenant_01`, 2 clients, 1 invoice) passed cleanly on test database without exposing `.env` or overwriting existing user data.
- **Security Audit Re-Check Findings**:
  1. **Dependencies (`npm audit`)**: Production dependencies (`npm audit --omit=dev`) pass with **0 vulnerabilities** after updating `zod` to `^4.6.7` (resolving GHSA-mrhx-c7xc-m3w5). Dev-only test runner dependencies (`vitest`/`tinypool`) are excluded from production deployments.
  2. **Session Cookies & CSRF**: Session cookie `invoicepilot_session` enforces `HttpOnly; SameSite=Lax; Max-Age=604800` and dynamically includes `; Secure` when `NODE_ENV=production`. API endpoints also accept explicit `x-session-token` / Bearer headers, providing defense-in-depth against CSRF.
  3. **Manual Payments vs. PayPal Status**: `recordPartialPayment` marks `paid_amount_minor` and, upon full settlement, sets `provider_status = 'PAID'`. For invoices already dispatched to PayPal Sandbox (`providerInvoiceId` present), local offline payments mark the local ledger paid without invoking PayPal's `/v2/invoicing/invoices/{id}/record-payment` REST endpoint, creating a divergence until refreshed or reconciled via webhooks.
  4. **Webhook Event Viewer**: `/api/webhooks/paypal/events` requires an authenticated owner session (`requireOwner`) and stores/returns `payload_hash` rather than exposing raw JSON bodies or customer PII. However, webhook records are stored globally for the application webhook endpoint rather than isolated per user account.
- **Known Limitations**:
  - Supabase Free tier pauses after 7 days of inactivity.
  - Public Client Pay page deferred (relies securely on PayPal Sandbox hosted `providerRecipientViewUrl`).
