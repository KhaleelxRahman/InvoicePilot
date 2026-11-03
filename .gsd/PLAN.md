# GSD Implementation Plan: InvoicePilot Polish & Notifications

## Workstream 1: Visual Identity & Brand Assets
- **Task 1.1**: Design scalable SVG favicon `public/favicon.svg` with high-contrast dual-tone design (deep teal `#0E5A6B` and warm amber `#D97706`) featuring a stylized invoice fold and navigation wing emblem.
- **Task 1.2**: Update `index.html` to reference `/favicon.svg` and update meta description for hackathon evaluators.
- **Task 1.3**: Update `src/client/components/Header.tsx` brand icon with matching distinctive vector artwork, accessible labels, and responsive sizing.
- *Verification*: Visual inspection, build verification (`npm run build`), zero console errors.

## Workstream 2: Real-Event In-App Notifications
- **Task 2.1**: Update `src/server/app.ts` to trigger `repo.createNotification` on:
  - Invoice submitted for approval (`"Approval slip ready"`).
  - Invoice successfully sent via PayPal Sandbox (`"Invoice sent via PayPal Sandbox"` with provider ID and recipient).
  - Partial or full payment recorded (`"Payment recorded"` / `"Invoice settled in full"`).
- **Task 2.2**: Update `src/server/db/repository.ts` and `src/server/db/asyncRepository.ts` to ensure notification creation is atomic and consistent in SQLite and PostgreSQL.
- *Verification*: Vitest unit tests verifying notifications created upon approval, send, and payment.

## Workstream 3: Notification UI & Deep-Linking
- **Task 3.1**: In `src/client/components/Header.tsx`, enhance the notification popover items to detect referenced invoices (regex `INV-[A-Z0-9-]+`) and allow 1-click navigation to that invoice.
- **Task 3.2**: In `src/client/App.tsx`, enhance the dedicated Notifications page with a "View invoice" button for invoice-related alerts, unread filter counts, and clear explanatory copy: *"In-app operational alerts (internal workspace notifications, distinct from client emails sent by PayPal)"*.
- *Verification*: Playwright E2E test verifying notification display, unread filter, and invoice deep-link navigation.

## Workstream 4: Full Suite Verification & Regression Check
- **Task 4.1**: Run `npm run typecheck` (`tsc --noEmit`).
- **Task 4.2**: Run `npm test` (all unit/integration tests).
- **Task 4.3**: Run `npm run build` (client Vite build + server compile).
- **Task 4.4**: Run `npx playwright test` (desktop and mobile E2E tests).
- **Task 4.5**: Run `git diff --check` and check status.
- *Verification*: 100% PASS on all checks with zero errors.

