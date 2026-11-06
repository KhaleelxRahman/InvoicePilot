# Local Development Guide (Windows 11 / PowerShell)

## 1. Prerequisites
- **Node.js**: `v22.13.0+` or `v24.x` (includes native `node:sqlite` support)
- **npm**: `v10.0.0+`
- **Shell**: Windows PowerShell 5.1 or PowerShell 7+

Verify your runtime versions:
```powershell
node -v
npm -v
```

---

## 2. Initial Setup

```powershell
# 1. Install dependencies
npm install

# 2. Create local .env if not already present (never overwrite an existing .env without checking)
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# 3. Run local SQLite schema migrations
npm run db:migrate

# 4. Seed or reset the synthetic demo workspace (optional)
npm run db:seed:demo
```

---

## 3. Recommended Local `.env` Settings

For local development, keep `DATABASE_URL` empty so InvoicePilot uses the local SQLite database at `data/invoicepilot.db`:

```env
APP_ENV=development
PORT=3000
APP_BASE_URL=http://localhost:3000
DATABASE_URL=
AUTH_PROVIDER=session
GEMINI_API_KEY=
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_SANDBOX_INVOICER_EMAIL=
PAYPAL_SANDBOX_RECIPIENT_EMAIL=
PAYPAL_TIMEOUT_MS=15000
```

- **Mock Mode Option**: If you want to test full invoice dispatch locally without connecting to PayPal Sandbox over the network, set `PAYPAL_MODE=mock` in `.env`.
- **Sandbox Mode Option**: Set `PAYPAL_MODE=sandbox` and supply your PayPal Developer Sandbox `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

---

## 4. Running the Application Locally

### Development Mode (Hot Reload)
```powershell
npm run dev
```
- Serves both the React SPA (via Vite middleware) and the Express API at **`http://localhost:3000`**.

### Production Build & Standalone Server Mode
```powershell
npm run build
npm start
```
- Compiles `dist/client` and `dist/server`, then runs `node dist/server/index.js` on **`http://localhost:3000`**.

---

## 5. Running Tests & Verification Scripts

```powershell
# Static TypeScript typecheck
npm run typecheck

# Vitest unit & integration test suite (20 files, 135 tests)
npm test

# Standalone Gemini AI & fallback CLI verification
npx tsx scripts/verifyGeminiCli.ts

# Standalone PayPal webhook lifecycle & signature rejection CLI verification
npx tsx scripts/verifyWebhookHandling.ts

# Playwright E2E browser tests (Desktop Chromium & Mobile 360)
npm run test:e2e
```

