# Feature Development Rules

## Definition of done
A feature is complete only when its behavior exists, acceptance criteria are written, relevant tests pass, errors/empty states are handled, server-side security is enforced where needed, keyboard/responsive/theme behavior is checked where applicable, regressions are absent, docs match behavior, and status/evidence are recorded.

## Workflow
1. Locate the feature in `InvoicePilot_FINAL.md` Part 6 or relevant section.
2. Add/confirm its status and dependencies in `FEATURE_STATUS.md`.
3. Identify the smallest vertical slice.
4. Inspect current components/services and preserve working patterns.
5. Implement server contract and validation before trusting UI state.
6. Implement UI states and accessible feedback.
7. Add unit/integration/manual tests.
8. Verify light/dark and responsive behavior where applicable.
9. Update documentation and decision log.
10. Commit only when acceptance criteria pass.

## Feature inventory groups
- Public/account/policy pages
- Onboarding and business setup
- Home and Agent
- Invoices list/create/detail
- Clients list/profile
- Payment history/reliability
- Reminder drafts/templates
- Insights and forecast
- Activity and notifications
- Settings, privacy, export, deletion, demo reset
- Developer mode/webhook viewer
- Help/FAQ
- Later public client Pay page
- Global themes, accessibility, responsive behavior, error/loading/empty states

The source specification is the complete inventory; this grouping is not a substitute for tracking each specified screen and subfeature individually.

## Never do
- Replace required logic with an unlabeled mock.
- Use client state as authorization.
- mark a feature VERIFIED based on appearance or compilation alone.
- silently remove scope.
- combine unrelated changes into a stage.
