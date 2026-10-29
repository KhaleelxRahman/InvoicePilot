# Architecture

## Status
Proposed architecture pending Stage 0 project inspection. Do not assume the existing project matches this diagram.

## High-level boundaries
```mermaid
flowchart LR
  U[User / Browser] --> FE[React + TypeScript UI]
  FE --> API[Application Server]
  API --> AUTH[Auth Provider]
  API --> DB[(Selected Database)]
  API --> GEM[Gemini API]
  API --> PP[PayPal Sandbox REST API]
  PP --> WH[Webhook Endpoint]
  WH --> API
  API --> ACT[Activity / Audit Records]
```

## Responsibilities
### Frontend
Screens, accessible forms, agent conversation, approval slip, tables, charts, theme, validation feedback, and calls to application API. No private provider credentials.

### Application server
Authentication/authorization, business validation, invoice/client operations, action state machine, Gemini tool processing, PayPal OAuth/API calls, webhook verification, persistence, activity logging, rate limits, and safe errors.

### External providers
Gemini; PayPal Sandbox; one selected database/auth provider; hosting and scheduler if actually needed.

## Key trust boundaries
- Browser input is untrusted.
- Model output is untrusted until schema-validated and business-validated.
- PayPal responses are provider data and must be checked before updating local state.
- Webhook payloads are untrusted until signature verification passes.
- User-owned records must be authorized on every server operation.

## Critical sequence: approved invoice send
```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as App Server
  participant DB as Database
  participant PP as PayPal Sandbox
  U->>FE: Review and approve draft
  FE->>API: Submit approval/action ID
  API->>DB: Load action and verify ownership/state
  API->>API: Revalidate amount, currency, due date, limits
  API->>PP: Perform supported invoice operation
  PP-->>API: Actual provider response
  API->>DB: Persist provider ID/status and Activity
  API-->>FE: Confirmed result or clear failure
  FE-->>U: Show actual outcome
```

## Architectural decisions to record
- Existing runtime and build tool.
- Database and auth provider (one each unless justified).
- PayPal REST direct integration vs official agent tools/MCP.
- Demo session isolation strategy.
- Hosting target.
- Scheduling strategy for reminders, if implemented.

Record material decisions in `DECISIONS_LOG.md`. Verify current provider docs before relying on endpoints or fields.
