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

- **Release Date**: 2026-11-05
- **Target Git Branch**: `main`
- **Verified Production URL**: [https://inquisitive-biscochitos-83e042.netlify.app/](https://inquisitive-biscochitos-83e042.netlify.app/)
- **Live Health Endpoint**: [https://inquisitive-biscochitos-83e042.netlify.app/api/health](https://inquisitive-biscochitos-83e042.netlify.app/api/health)
- **Deployment Platform**: Netlify (Vite Static SPA + Netlify Serverless Functions via `serverless-http`)
- **Cloud Database Engine**: Supabase Managed PostgreSQL (`postgresql-supabase`, transaction pooler port 6543, SSL required)
- **Local Fallback Database Engine**: Node.js built-in `node:sqlite` (`DatabaseSync`) for offline tests and development
- **Production Build Status**: Verified (`vite build && tsc -p tsconfig.server.json` passing with 0 errors)
- **Automated Test Evidence**:
  - Unit & Integration: **128 / 128 Passed** across 19 suites (Vitest 3)
  - Playwright E2E: **36 / 36 Passed** across `desktop-chromium` (1280x800) and `mobile-360` (360x780)
  - Responsive Viewport Audits: **1440x900** and **390x844** verified with **0 horizontal overflow**
- **Security & Authentication Verification**:
  - Timing-safe `scrypt` password hashing and session tokens
  - Protected API routes enforcing `401 UNAUTHORIZED` on missing auth
  - Strict tenant isolation rejecting cross-user access with `403 FORBIDDEN_OWNER_MISMATCH`
  - Demo authentication backdoor endpoints (`POST /api/auth/demo` and `POST /api/demo/reset`) permanently removed (returning `404 ROUTE_NOT_FOUND`)
  - Server-enforced Human Approval Gate (`DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTED`)
  - Offline invoice PDF download via authenticated endpoint (`GET /api/invoices/:id/pdf`)
- **Known Limitations & Considerations**:
  - Supabase Free tier automatically pauses after 7 days of inactivity; can be unpaused from the Supabase dashboard.
  - Users must provide their own PayPal Sandbox App Client ID and Secret in Settings (or environment variables) to transmit live sandbox invoices to external PayPal sandbox accounts.
