# Authentication and Security

## Status
Security requirements and checklist; implementation must be verified against actual code and selected providers.

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
- [ ] Secret scan and git history review
- [ ] `.gitignore` checked
- [ ] Auth and ownership tests pass
- [ ] No client-side private keys
- [ ] Provider mode defaults to Sandbox
- [ ] Webhook verification tested if implemented
- [ ] Error/log output redacted
- [ ] Dependency/build checks run
- [ ] Demo reset scope verified
