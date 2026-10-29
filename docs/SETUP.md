# Setup Guide

## Status
This is a setup template. Replace placeholders only after inspecting the actual project. Do not invent commands or claim a clean setup has passed before testing it.

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
