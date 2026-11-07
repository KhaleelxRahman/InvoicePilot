# INVOICEPILOT — FINAL EXECUTION BASELINE

**Date**: November 7, 2026  
**Auditor**: Senior Engineering Team  
**Repository**: `https://github.com/KhaleelxRahman/InvoicePilot`  
**Production URL**: `https://invoicepilot-beryl.vercel.app`  

---

## 1. Baseline System State

| Property | Value | Evidence |
|---|---|---|
| **Git Branch** | `main` | `git status --short --branch` |
| **HEAD Commit** | `7857a5e689f119a50e8b98784b719a1d4b9ebe94` | `git log -n 1 --oneline` |
| **Working Tree** | Clean tracking `origin/main` | `git status` |
| **Node.js Runtime** | `v24.22.1` | `node -v` |
| **npm Version** | `11.19.1` | `npm -v` |
| **Database Engine** | Supabase PostgreSQL via `DATABASE_URL` | `src/server/db/postgresPoolAdapter.ts`, `/api/health` |
| **Database Schema** | Version 6 (4 cumulative PostgreSQL migrations) | `src/server/db/schema.ts`, `migrations/` |
| **Deployment Engine** | Vercel Serverless Functions (`api/index.ts`, `maxDuration: 60`) | `vercel.json` |
| **Production Health** | HTTP 200 `status: ok`, PostgreSQL & Gemini active | `GET /api/health` |

---

## 2. Test Execution Verification Baseline

| Command | Exit Code | Duration | Outcome |
|---|---|---|---|
| `npm test` (`vitest run`) | `0` | 17.45s | **21 passed (21 files), 157 passed (157 tests)** |
| `npm run typecheck` (`tsc --noEmit`) | `0` | 6s | **0 errors, clean output** |
| `npm run lint` (`tsc --noEmit`) | `0` | 7s | **0 errors, clean output** |
| `npm run build` | `0` | 1.72s | **0 errors, client bundles & server compile complete** |
| `npx playwright test` | `0` | 210s (3.5m)| **13 files, 36 passed (18 desktop, 18 mobile)** |
| `npm run paypal:sandbox:verify` | `0` | 5.5s | **5/5 steps PASSED against live PayPal Sandbox** |
| `npm run paypal:adapter:verify` | `0` | 5.5s | **4/4 steps PASSED through server adapter** |

---

## 3. Environment Variable Inventory (Redacted)

- `DATABASE_URL`: Configured (Supabase PostgreSQL pool connection with TLS)
- `GEMINI_API_KEY`: Configured (Google AI Studio)
- `GEMINI_MODEL`: `gemini-3.8-flash` (with `gemini-3.5-flash-lite` peer failover)
- `GEMINI_TIMEOUT_MS`: `20000`
- `GEMINI_MAX_RETRIES`: `2`
- `GEMINI_TOTAL_BUDGET_MS`: `50000`
- `GEMINI_THINKING_LEVEL`: `low`
- `PAYPAL_MODE`: `sandbox`
- `PAYPAL_CLIENT_ID`: Configured
- `PAYPAL_CLIENT_SECRET`: Configured
- `PAYPAL_WEBHOOK_ID`: Configured
- `SESSION_SECRET`: Configured

---

## 4. Known Gaps & Blockers

- **Technical Blockers**: Zero. All code, routes, database adapters, tests, and builds are fully operational.
- **Operational Condition**: An interactive buyer checkout in PayPal Sandbox with a personal buyer test account is required to generate the live inbound webhook for video recording.
