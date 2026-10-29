# Application API Contract

## Status
Proposed contract. Routes must be reconciled with the actual server before implementation. Do not document a route as live until it exists and is tested.

## Conventions
- JSON request/response bodies unless provider requires otherwise.
- Authenticate protected routes and enforce ownership server-side.
- Validate every field; reject unknown/invalid action states safely.
- Return consistent error shapes without secrets or stack traces.
- Use idempotency controls for consequential mutations where practical.

## Candidate route inventory
| Method | Route | Purpose | Status |
|---|---|---|---|
| GET | `/api/health` | App health check | NOT STARTED |
| GET/POST | `/api/clients` | List/create clients | NOT STARTED |
| GET/PATCH/DELETE | `/api/clients/:id` | Read/update/delete owned client | NOT STARTED |
| GET/POST | `/api/invoices` | List/create local draft | NOT STARTED |
| GET/PATCH | `/api/invoices/:id` | Read/update owned invoice draft | NOT STARTED |
| POST | `/api/agent/prepare-invoice` | Prepare validated draft via AI | NOT STARTED |
| POST | `/api/actions/:id/approve` | Approve pending action | NOT STARTED |
| POST | `/api/actions/:id/execute` | Execute approved action after revalidation | NOT STARTED |
| POST | `/api/invoices/:id/paypal/send` | Supported PayPal send operation | NOT STARTED |
| POST | `/api/invoices/:id/paypal/refresh` | Retrieve provider details/status | NOT STARTED |
| POST | `/api/webhooks/paypal` | Verify/process provider event | NOT STARTED |
| GET | `/api/activity` | List owned activity records | NOT STARTED |

These routes are suggestions, not requirements to use this exact shape. Avoid duplicate endpoints that weaken the approval boundary.

## Error shape proposal
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Review the highlighted fields.",
    "requestId": "server-generated-correlation-id"
  }
}
```
Never expose access tokens, client secrets, raw provider credentials, stack traces, or private infrastructure details.

## API documentation requirements
For every implemented route, record auth requirements, ownership checks, schema, response, errors, rate limits, idempotency behavior, and tests. PayPal endpoint details must be copied from current official documentation and verified in Sandbox; do not guess them here.
