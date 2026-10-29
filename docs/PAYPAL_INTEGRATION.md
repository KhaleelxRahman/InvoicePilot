# PayPal Sandbox Integration

## Status
No successful real Sandbox API call is presumed. Populate the evidence section only after performing tests.

## Official references to consult
- https://developer.paypal.com/
- https://developer.paypal.com/dashboard/
- https://developer.paypal.com/invoicing/about
- https://developer.paypal.com/api/rest/
- https://developer.paypal.com/api/webhooks/overview
- https://docs.paypal.ai/
- https://docs.paypal.ai/developer/tools/ai/agent-toolkit-quickstart
- https://docs.paypal.ai/developer/tools/ai/mcp-quickstart

Verify current endpoints, payload fields, scopes, status semantics, and event types against official docs. This document intentionally does not guess endpoint details.

## Required milestones
1. Create/confirm Sandbox app and test accounts.
2. Configure credentials on server only.
3. Acquire OAuth token and redact it from logs.
4. Create invoice draft using documented API.
5. Send invoice using documented supported operation after approval gate exists.
6. Save actual provider invoice ID and response.
7. Retrieve invoice and compare actual provider status.
8. Test supported buyer payment flow if available.
9. Verify webhook signatures and process events idempotently if implemented.
10. Test invalid payloads, authorization errors, rate limits, timeouts, and safe retries.

## Adapter contract
Keep one internal interface for Sandbox and Mock modes. Include explicit mode in configuration and UI. Never silently fall back from Sandbox to mock or Live. Mock responses must be visibly labeled and must not create fake provider IDs that resemble real ones.

## State integrity
Local draft status and provider-confirmed status are distinct. Only a validated provider response or verified webhook can update provider-confirmed fields. After ambiguous timeouts, reconcile by retrieving known provider state before retrying a potentially duplicative action.

## Test evidence ledger
| Date | Operation | Environment | Expected | Actual | Evidence/reference | Status |
|---|---|---|---|---|---|---|
| Not run | OAuth token | Sandbox | Token returned securely | Not tested | None | NOT STARTED |
| Not run | Create draft | Sandbox | Actual invoice ID returned | Not tested | None | NOT STARTED |
| Not run | Send invoice | Sandbox | Provider confirms send | Not tested | None | NOT STARTED |
| Not run | Retrieve invoice | Sandbox | Matching provider record | Not tested | None | NOT STARTED |
| Not run | Buyer payment/status | Sandbox | Supported flow reflected | Not tested | None | NOT STARTED |
| Not run | Webhook verification | Sandbox | Signature verified and event idempotent | Not tested | None | NOT STARTED |
