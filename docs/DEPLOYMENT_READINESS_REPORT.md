# INVOICEPILOT — DEPLOYMENT & ENVIRONMENT READINESS REPORT

**Deployment Target**: Vercel Serverless Functions + Supabase PostgreSQL  
**Production URL**: `https://invoicepilot-beryl.vercel.app`  
**Configuration**: `vercel.json`  

---

## 1. Production Deployment Health Audit

Direct inspection of `https://invoicepilot-beryl.vercel.app/api/health`:

```json
{
  "status": "ok",
  "service": "invoicepilot",
  "stage": "stage-09-auth-onboarding",
  "environment": "production",
  "authProvider": "session",
  "paypalMode": "sandbox",
  "isMock": false,
  "modeLabel": "PayPal Sandbox Mode (No Live Money)",
  "adapterStatusLabel": "PayPal Sandbox Mode (Live Sandbox API — No Real Money)",
  "sandboxCredentialsConfigured": true,
  "webhookConfigured": true,
  "geminiConfigured": true,
  "geminiModel": "gemini-3.8-flash",
  "databaseEngine": "postgresql-supabase",
  "databaseConfigured": true,
  "schemaVersion": 6,
  "approvalGateEnforced": true,
  "timestamp": "2026-11-07T09:05:00.000Z"
}
```

---

## 2. Serverless Runtime & Configuration

- **Entrypoint**: `api/index.ts` loads Express app via `createApp` with `process.env.VERCEL = '1'`.
- **Function Execution Budget**: `vercel.json` specifies `"maxDuration": 60` for `api/index.ts`.
- **Internal Timeout Budget**: Gemini total budget is set to 50,000ms, ensuring all retries terminate 10 seconds before Vercel's 60s gateway cutoff.
- **Rewrites**:
  - `/api/(.*)` -> `/api/index`
  - `/api` -> `/api/index`
  - `/((?!api(?:/|$)).*)` -> `/index.html` (SPA fallback)

---

## 3. Production Environment Variables Checklist

| Environment Variable | Status in Production | Exposed in Client? |
|---|---|---|
| `DATABASE_URL` | Configured (Supabase PostgreSQL with TLS) | **No** |
| `GEMINI_API_KEY` | Configured (Google AI Studio) | **No** |
| `GEMINI_MODEL` | `gemini-3.8-flash` | **No** |
| `PAYPAL_MODE` | `sandbox` | **No** |
| `PAYPAL_CLIENT_ID` | Configured | **No** |
| `PAYPAL_CLIENT_SECRET` | Configured | **No** |
| `PAYPAL_WEBHOOK_ID` | Configured | **No** |
| `SESSION_SECRET` | Configured | **No** |

---

## 4. Deployment Safety Statement

- **Zero Automatic Deployments**: Deployments are executed intentionally via Vercel CLI or verified GitHub merges.
- **No Live Financial Operations**: `PAYPAL_MODE` is strictly locked to `sandbox`.
- **Database Safety**: Zero destructive SQL migrations have been executed. Schema is stable at version 6.
