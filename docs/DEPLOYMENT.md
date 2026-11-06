# Vercel Deployment Guide

## 1. Overview
InvoicePilot deploys as a hybrid static + serverless application on **Vercel**:
- **Frontend SPA**: Built with Vite (`npm run build`) to `dist/client` and served from Vercel's global CDN.
- **Backend API**: Express 4 application exported from [`api/index.ts`](../api/index.ts) and routed via [`vercel.json`](../vercel.json) (`/api/*` → `/api/index`, with `maxDuration: 60`).
- **Database**: Supabase PostgreSQL (`DATABASE_URL` via Transaction Pooler on port `6543`).

---

## 2. Pre-Deployment Checklist

Before running a production deployment, verify all of the following locally:

```powershell
# 1. Verify Vercel CLI login and linked project
npx vercel whoami
Get-Content .vercel/project.json

# 2. Verify remote environment variable names and scopes (never print secret values)
npx vercel env ls

# 3. Run the local verification gate
npm run typecheck
npm test
npm run build
```

### Required Production Environment Variables in Vercel (`khaleelxrahmans-projects/invoicepilot`)
Ensure the following variables are present in the `Production` scope (see [docs/ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)):
- `DATABASE_URL` (`Secret`) — Supabase PostgreSQL connection string (migrated through Migration `004`)
- `APP_ENV` (`production`)
- `APP_BASE_URL` (`https://invoicepilot-beryl.vercel.app`)
- `PAYPAL_MODE` (`sandbox`)
- `PAYPAL_CLIENT_ID` (`Secret`)
- `PAYPAL_CLIENT_SECRET` (`Secret`)
- `PAYPAL_WEBHOOK_ID` (`Secret`)
- `GEMINI_API_KEY` (`Secret`, optional)

---

## 3. Database Migration Before First Deployment

If deploying against a fresh Supabase PostgreSQL instance, apply the idempotent schema migrations (`001`, `002`, `003`, `004`) before traffic hits the deployment:

```powershell
npm run db:migrate:supabase
```

All migrations use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and safe constraint updates so existing production data is preserved.

---

## 4. Deploying to Vercel

### Preview Deployment
```powershell
npx vercel
```

### Production Deployment
```powershell
npx vercel --prod
```

- **Production Domain**: `https://invoicepilot-beryl.vercel.app`
- **Webhook Endpoint**: `https://invoicepilot-beryl.vercel.app/api/webhooks/paypal`

---

## 5. Post-Deployment Live Verification Runbook

After `npx vercel --prod` reports `Ready`, execute these non-destructive verification checks:

### 1. Health & Configuration Check
```powershell
Invoke-RestMethod -Uri "https://invoicepilot-beryl.vercel.app/api/health" | ConvertTo-Json
```
Confirm:
- `status`: `"ok"`
- `environment`: `"production"`
- `paypalMode`: `"sandbox"`
- `databaseEngine`: `"postgresql-supabase"`
- `databaseConfigured`: `true`
- `sandboxCredentialsConfigured`: `true`
- `webhookConfigured`: `true`
- `schemaVersion`: `6`

### 2. Security Headers & CSP Check
```powershell
$res = Invoke-WebRequest -Uri "https://invoicepilot-beryl.vercel.app/api/health" -Method Get
$res.Headers["Strict-Transport-Security"]
$res.Headers["Content-Security-Policy"]
$res.Headers["X-Frame-Options"]
$res.Headers["X-Content-Type-Options"]
```

### 3. Unverified Webhook Rejection Check (Fail-Closed Proof)
```powershell
try {
  Invoke-WebRequest -Uri "https://invoicepilot-beryl.vercel.app/api/webhooks/paypal" `
    -Method Post `
    -ContentType "application/json" `
    -Body '{"id":"WH-TEST-INVALID","event_type":"INVOICING.INVOICE.PAID","resource":{"id":"INV2-FAKE"}}'
} catch {
  $_.Exception.Response.StatusCode.value__
}
```
Confirm the endpoint returns HTTP `400` (`WEBHOOK_SIGNATURE_INVALID`) and never `500`.

### 4. PayPal Sandbox OAuth Check
Authenticate in the live UI (or via session token) and trigger `POST /api/paypal/verify-oauth` from **Settings → PayPal Sandbox** to confirm live OAuth 2.0 token acquisition against `https://api-m.sandbox.paypal.com`.
