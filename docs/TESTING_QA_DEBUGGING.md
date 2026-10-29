# Testing, QA, and Debugging

## Principles
Record exact tests and actual results. A test not run is `NOT RUN`, not passed. Redact secrets in logs and screenshots.

## Unit tests
- Amount/currency/line item/due-date validation
- Money rounding and total calculations
- Agent output parsing and schema validation
- Approval state transitions and stale action behavior
- Invoice status mapping
- Aging/reliability/forecast calculations once implemented
- Authorization helpers
- Idempotency behavior

## Integration tests
- Protected routes and owner isolation
- Database CRUD and constraints
- Gemini tool-call parsing and malformed output
- PayPal OAuth and invoice create/send/retrieve in Sandbox
- PayPal error/timeouts and safe reconciliation
- Webhook signature verification and duplicate events, if implemented
- Activity logging
- Mock/Sandbox adapter separation

## End-to-end acceptance test
1. Sign in or use isolated demo account.
2. Create/select client.
3. Prepare invoice through form; separately test AI draft.
4. Review all details and warnings.
5. Discard and confirm no provider send occurred.
6. Prepare a new draft and explicitly approve.
7. Verify real Sandbox request, response, and provider invoice ID.
8. Retrieve the invoice using the provider ID.
9. Complete supported buyer payment flow if available.
10. Verify actual status refresh/webhook behavior.
11. Check Activity records.
12. Test provider failure and timeout/retry reconciliation.

## Agent adversarial cases
Missing/ambiguous client; ambiguous amount; invalid currency; missing date; over-limit invoice; approval bypass; prompt injection in notes; duplicate tool call; unauthorized invoice ID; stale approval; Gemini timeout; PayPal timeout; unsupported claims; Hinglish input if supported.

## UI/accessibility checks
- 360px mobile and desktop
- Light, dark, system theme
- Keyboard-only navigation and focus visibility
- Labels and validation announcements
- Contrast and status not conveyed by color alone
- Loading, empty, error, success, disabled states
- Every visible control performs a meaningful action

## Bug report format
- Title and severity
- Environment/build/commit
- Preconditions and test data (synthetic only)
- Exact reproduction steps
- Expected vs actual result
- Console/server logs with secrets redacted
- Screenshot/video if useful
- Suspected scope, not asserted cause
- Regression test added

## Release gate
No release while core Sandbox acceptance path is failing, secrets are exposed, approval can be bypassed, or docs materially misrepresent functionality.
