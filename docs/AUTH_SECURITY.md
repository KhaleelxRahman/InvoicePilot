# Authentication and Security

## Status
Verified implementation (Stage 09 — Authentication, Demo Isolation, and Onboarding verified on 2026-11-01).

## Verified Stage 09 Auth Implementation
- **Cryptographic Password Hashing**: Real password authentication using Node.js native `crypto.scryptSync` with 16-byte cryptographically secure random salt, 64-byte derived key, and `crypto.timingSafeEqual` comparison to eliminate timing side-channels.
- **Session Security & Storage**: Persisted in SQLite `sessions` table (`id`, `user_id`, `token_hash`, `expires_at`, `created_at`). Raw session tokens (32 random bytes / 64 hex chars) are never stored in plaintext in the database; only SHA-256 token hashes are persisted to prevent token replay from database dumps.
- **Session Transport**: Supported via HTTP-only cookie (`invoicepilot_session`, `HttpOnly; SameSite=Lax; Path=/`) and `Authorization: Bearer <sessionToken>` / `x-session-token` headers for headless/API clients.
- **Session Expiration**: Configurable TTL (default 7 days). Expired sessions are rejected with HTTP 401 `SESSION_EXPIRED` and automatically purged from the database.
- **Strict Cross-User Isolation**: Server enforces ownership on every route (`/api/clients`, `/api/invoices`, `/api/actions`, `/api/onboarding`). Any attempt to access or mutate another user's records is rejected with HTTP 403 `FORBIDDEN_OWNER_MISMATCH` or HTTP 404 `NOT_FOUND`.
- **Demo Isolation & Safe Reset Scope**: Demo tenant records have `is_demo = 1`. `POST /api/demo/reset` strictly deletes and re-seeds records belonging to `is_demo = 1`. Real users (`is_demo = 0`), their clients, invoices, line items, and onboarding records are completely isolated and 100% untouched.
- **Secret Redaction**: Passwords, password hashes, and raw token hashes are excluded from all API responses, serialized user models, and Activity audit log payloads.

## Secrets
- PayPal client secret, access tokens, Gemini server key, database service-role keys, auth signing secrets, and webhook secrets remain server-side.
- Do not commit `.env` files or real credentials.
- `.env.example` contains names and blank values only.
- Never log complete tokens or sensitive headers.
- Rotate any leaked credential immediately and record the incident.

## Authentication and authorization
- Use a real selected auth provider for authenticated mode; do not call a fake local flag secure login.
- Verify identity on every protected server request.
- Enforce owner/tenant scope on every record lookup and mutation.
- Use a clearly separated demo tenant/session and never let demo reset touch real user data.
- Apply least privilege and safe session handling supported by the chosen framework/provider.

## Input and output safety
- Validate all inputs server-side, including model-generated tool arguments.
- Encode output and use framework protections against XSS; avoid unsafe HTML rendering.
- Apply CSRF protections where relevant to the chosen cookie/session architecture.
- Rate-limit sensitive endpoints and AI calls where practical.
- Return generic user-safe errors; log a correlation ID rather than secrets.
- Treat user text, client notes, uploaded content, and model outputs as untrusted.

## Financial action safety
- Server-enforced amount limit and currency/date checks.
- Explicit approval before sending.
- Revalidate action immediately before execution.
- Prevent duplicate/stale actions.
- Keep local status distinct from provider-confirmed status.
- Verify webhook authenticity before processing.
- Use idempotency and reconciliation where supported.

## Privacy and data lifecycle
- Minimize stored personal information.
- Document export, deletion, retention, and conversation history behavior.
- Never use real customer data in demo fixtures.
- Do not promise legal compliance without qualified review.

## Release security checklist
- [x] Secret scan and git history review
- [x] `.gitignore` checked
- [x] Auth and ownership tests pass (`tests/unit/stage09AuthOnboarding.test.ts` 10/10 & `tests/e2e/stage09-auth-onboarding.spec.ts` 4/4)
- [x] No client-side private keys
- [x] Provider mode defaults to Sandbox (`PAYPAL_MODE=sandbox`)
- [x] Webhook verification tested and verified (`tests/unit/stage08PayPalEndToEnd.test.ts`)
- [x] Error/log output redacted
- [x] Dependency/build checks run (`npm run build`, `npm run typecheck`, `npm test`)
- [x] Demo reset scope verified (real users untouched on reset)
