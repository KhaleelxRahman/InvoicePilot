# GSD Specification: InvoicePilot Hackathon Polish & Notification Deep-Linking

## 1. Goal & Objectives
Elevate InvoicePilot into a polished, trustworthy, professional hackathon prototype that meets official PayPal AI Hackathon judging criteria without inventing unverified capabilities or live payment claims:
1. **Brand Identity**: Replace the generic placeholder icon and inline data-URI favicon with an original, distinctive InvoicePilot vector brand mark and matching scalable favicon.
2. **In-App Notification Integrity**: Expand real application lifecycle events that generate legitimate in-app notifications (invoice sent to PayPal, approval slip ready, payment recorded), add record deep-linking (clicking a notification opens the relevant invoice), and clearly distinguish in-app alerts from external email notifications.
3. **Customer-Facing UX & Copy Polish**: Ensure all visible customer screens use natural business-friendly language, removing any leftover technical jargon.
4. **Safety & Zero-Regression Verification**: Enforce integer minor units, the Human Approval Gate, server-side secret isolation, and verify 100% test passing across Vitest and Playwright.

## 2. Technical Invariants & Rules
- **No Floating-Point Money**: Maintain integer minor units (cents) and basis-point tax calculations.
- **Human Approval Gate**: Consequential actions (invoices and reminders) must pass `DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`.
- **Mode Separation**: Default to `sandbox` with explicit `mock` support. No PayPal Live mode.
- **Zero Fabrication**: Do not claim notifications were sent via email/SMS when they are in-app alerts. Do not fake data.

## 3. Acceptance Criteria
- [ ] Crisp vector SVG brand mark in `Header.tsx` and matching vector favicon in `public/favicon.svg` linked in `index.html`.
- [ ] Real app events trigger in-app notifications: invoice dispatched to PayPal, approval slip created, payment recorded.
- [ ] Notification cards and header dropdown items link directly to the referenced invoice or record when clicked.
- [ ] Clear in-app alert labeling distinguishing internal notifications from external client communications.
- [ ] Unit tests added for notification lifecycle on invoice dispatch and payment recording.
- [ ] All 116+ unit tests and 30 Playwright E2E tests pass with 0 errors.

