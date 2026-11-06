# Environment Variables Reference & Checklist

This document lists every environment variable read by InvoicePilot in [`src/server/config.ts`](../src/server/config.ts), [`src/server/app.ts`](../src/server/app.ts), and [`src/server/db/postgresPoolAdapter.ts`](../src/server/db/postgresPoolAdapter.ts).

> [!IMPORTANT]
> Never commit `.env` or `.env.local` to Git, and never expose secret values in logs, screenshots, or issue reports.

---

## 1. Complete Variable Inventory

| Variable Name | Required? | Secret? | Default Value | Read Location | Purpose |
| :--- | :---: | :---: | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes (Serverless)** | **Yes** | `data/invoicepilot.db` *(local only)* | `src/server/config.ts#L71` | Supabase PostgreSQL connection string (`postgresql://...`). Empty locally to use SQLite. |
| `APP_ENV` | **Yes** | No | `development` | `src/server/config.ts#L46` | `production` \| `development` \| `test`. Controls `Secure` session cookies, HSTS, CORS localhost exclusion, and demo auto-seeding guard. |
| `APP_BASE_URL` | **Yes (Prod)** | No | `https://<VERCEL_URL>` or `http://localhost:3000` | `src/server/config.ts#L82` | Canonical origin URL for CORS validation and metadata. |
| `PAYPAL_MODE` | **Yes** | No | `sandbox` | `src/server/config.ts#L37` | `sandbox` or `mock`. Rejects any other value (`live` is forbidden). |
| `PAYPAL_CLIENT_ID` | **Yes (Sandbox)** | **Yes** | `""` | `src/server/config.ts#L89` | PayPal Sandbox REST API App Client ID. |
| `PAYPAL_CLIENT_SECRET` | **Yes (Sandbox)** | **Yes** | `""` | `src/server/config.ts#L90` | PayPal Sandbox REST API App Client Secret. |
| `PAYPAL_WEBHOOK_ID` | **Yes (Webhooks)** | **Yes** | `""` | `src/server/config.ts#L91` | PayPal Sandbox Webhook ID for `/v1/notifications/verify-webhook-signature`. |
| `GEMINI_API_KEY` | Optional | **Yes** | `""` | `src/server/config.ts#L86` | Google Gemini API key. Falls back to deterministic parser and manual form when unset. |
| `GEMINI_MODEL` | Optional | No | `gemini-3.8-flash` | `src/server/config.ts#L108` | Gemini model identifier (automatically normalizes legacy `gemini-2.5-flash` / `gemini-1.5-flash` to `gemini-3.8-flash`). |
| `GEMINI_TIMEOUT_MS` | Optional | No | `15000` | `src/server/config.ts#L56` | Timeout in milliseconds for Gemini API calls. |
| `PAYPAL_TIMEOUT_MS` | Optional | No | `15000` | `src/server/config.ts#L53` | Timeout in milliseconds for PayPal Sandbox HTTP calls. |
| `PAYPAL_SANDBOX_INVOICER_EMAIL` | Optional | No | `undefined` | `src/server/config.ts#L92` | Optional PayPal Sandbox merchant email override. |
| `PAYPAL_SANDBOX_RECIPIENT_EMAIL` | Optional | No | `sb-buyer-invoicepilot@personal.example.com` | `src/server/config.ts#L94` | Default buyer email for CLI sandbox verification. |
| `AUTH_PROVIDER` | Optional | No | `session` | `src/server/config.ts#L85` | Session authentication identifier. |
| `PORT` | Optional | No | `3000` | `src/server/config.ts#L50` | Listening port for local/standalone server. |
| `RATE_LIMIT_LOGIN_MAX` | Optional | No | `20` (`100` test) | `src/server/app.ts#L418` | Max login requests per minute per IP. |
| `RATE_LIMIT_REGISTER_MAX` | Optional | No | `20` (`100` test) | `src/server/app.ts#L424` | Max registration requests per minute per IP. |
| `RATE_LIMIT_AGENT_MAX` | Optional | No | `30` (`100` test) | `src/server/app.ts#L430` | Max AI assistant requests per minute per IP. |
| `SUPABASE_SSL_CA` / `DATABASE_SSL_CA` | Optional | No | `undefined` | `src/server/db/postgresPoolAdapter.ts#L36` | Custom root CA certificate for strict PostgreSQL TLS validation. |

---

## 2. Verified Vercel & Local Scope Checklist (`khaleelxrahmans-projects/invoicepilot`)

Verified via `npx vercel env ls` (names and scopes only; secret values are never displayed):

| Variable Name | Vercel `Production` | Vercel `Preview` | Vercel `Development` | Local `.env` | Notes |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `DATABASE_URL` | **CONFIGURED** (`Secret`) | *Not Set (Intentional)* | *Not Set (Uses Local SQLite)* | *Empty (Uses Local SQLite)* | Production uses Supabase PostgreSQL. Preview does not silently reuse production DB credentials unless explicitly added. |
| `APP_ENV` | **CONFIGURED** (`Secret`) | **CONFIGURED** (`Config`) | **CONFIGURED** (`Config`) | **CONFIGURED** (`development`) | `production` in Production/Preview; `development` in Development/Local. |
| `APP_BASE_URL` | **CONFIGURED** (`Config`) | *Dynamic (`VERCEL_URL`)* | **CONFIGURED** (`Config`) | **CONFIGURED** (`http://localhost:3000`) | Production set to `https://invoicepilot-beryl.vercel.app`; Preview auto-resolves `https://${VERCEL_URL}`. |
| `PAYPAL_MODE` | **CONFIGURED** (`Secret`) | **CONFIGURED** (`Config`) | **CONFIGURED** (`Config`) | **CONFIGURED** (`sandbox`) | Set to `sandbox` across all environments. |
| `PAYPAL_CLIENT_ID` | **CONFIGURED** (`Secret`) | *Optional* | *Optional* | **CONFIGURED** | PayPal Sandbox REST Client ID. |
| `PAYPAL_CLIENT_SECRET` | **CONFIGURED** (`Secret`) | *Optional* | *Optional* | **CONFIGURED** | PayPal Sandbox REST Client Secret. |
| `PAYPAL_WEBHOOK_ID` | **CONFIGURED** (`Secret`) | *Optional* | *Optional* | *Empty* | Registered for `https://invoicepilot-beryl.vercel.app/api/webhooks/paypal`. |
| `GEMINI_API_KEY` | *Optional (Fallback Active)* | *Optional (Fallback Active)* | *Optional (Fallback Active)* | *Empty (Fallback Active)* | Deterministic parser and conventional form fallback operate when unset. |

