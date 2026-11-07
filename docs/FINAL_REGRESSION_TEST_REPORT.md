# INVOICEPILOT — FINAL REGRESSION TEST REPORT

**Execution Date**: November 7, 2026  
**QA Lead**: Automation & Reliability Engineering  
**Environment**: Local Workspace & Live Vercel Production  

---

## 1. Automated Execution Summary

| Command | Category | Files | Total Tests | Passed | Failed | Skipped | Duration | Exit Code |
|---|---|---|---|---|---|---|---|---|
| `npm test` | Vitest Unit & Integration | 21 | 157 | **157** | 0 | 0 | 17.45s | `0` |
| `npx playwright test` | Playwright E2E (Desktop & Mobile) | 13 | 36 | **36** | 0 | 0 | 210s | `0` |
| `npm run typecheck` | TypeScript Static Analysis | N/A | Full Project | **PASS** | 0 | 0 | 6.0s | `0` |
| `npm run lint` | Project Linter | N/A | Full Project | **PASS** | 0 | 0 | 7.0s | `0` |
| `npm run build` | Production Vite + TSC Build | N/A | Client + Server | **PASS** | 0 | 0 | 1.72s | `0` |
| `npm run paypal:sandbox:verify` | Live Sandbox API Runner | 1 | 5 stages | **5** | 0 | 0 | 5.5s | `0` |
| `npm run paypal:adapter:verify` | Server Adapter API Runner | 1 | 4 stages | **4** | 0 | 0 | 5.5s | `0` |

---

## 2. Vitest Suite Breakdown (21 Files / 157 Tests)

1. `tests/unit/securityHeadersAndRateLimit.test.ts` (6 tests) — PASS
2. `tests/unit/stage11Reminders.test.ts` (6 tests) — PASS
3. `tests/unit/stage14RemainingScope.test.ts` (10 tests) — PASS
4. `tests/unit/stage09AuthOnboarding.test.ts` (10 tests) — PASS
5. `tests/unit/supabasePostgresRepository.test.ts` (12 tests) — PASS
6. `tests/unit/geminiReliability.test.ts` (12 tests) — PASS
7. `tests/unit/authBypassRegression.test.ts` (7 tests) — PASS
8. `tests/unit/stage07GeminiAgent.test.ts` (10 tests) — PASS
9. `tests/unit/stage06Approval.test.ts` (6 tests) — PASS
10. `tests/unit/stage15InvoiceCompletion.test.ts` (6 tests) — PASS
11. `tests/unit/stage12Insights.test.ts` (14 tests) — PASS
12. `tests/unit/stage08PayPalEndToEnd.test.ts` (5 tests) — PASS
13. `tests/unit/stage10CorePages.test.ts` (4 tests) — PASS
14. `tests/unit/persistence.test.ts` (6 tests) — PASS
15. `tests/unit/paypalAdapter.test.ts` (7 tests) — PASS
16. `tests/unit/stage13McpEvaluation.test.ts` (5 tests) — PASS
17. `tests/unit/paypalSandboxProof.test.ts` (5 tests) — PASS
18. `tests/unit/stage05Workflow.test.ts` (4 tests) — PASS
19. `tests/unit/invoicePdf.test.ts` (4 tests) — PASS
20. `tests/unit/health.test.ts` (7 tests) — PASS
21. `tests/unit/clientComponents.test.ts` (11 tests) — PASS

---

## 3. Playwright E2E Breakdown (13 Files / 36 Tests)

1. `tests/e2e/frontend-polish.spec.ts` (3 desktop, 3 mobile) — PASS (18.2s)
2. `tests/e2e/release-audit.spec.ts` (2 desktop, 2 mobile) — PASS (33.8s)
3. `tests/e2e/stage01-foundation.spec.ts` (1 desktop, 1 mobile) — PASS (10.9s)
4. `tests/e2e/stage05-conventional-workflow.spec.ts` (2 desktop, 2 mobile) — PASS (20.0s)
5. `tests/e2e/stage06-approval-slip.spec.ts` (1 desktop, 1 mobile) — PASS (23.6s)
6. `tests/e2e/stage07-gemini-agent.spec.ts` (1 desktop, 1 mobile) — PASS (7.1s)
7. `tests/e2e/stage08-paypal-status.spec.ts` (1 desktop, 1 mobile) — PASS (26.6s)
8. `tests/e2e/stage09-auth-onboarding.spec.ts` (2 desktop, 2 mobile) — PASS (19.0s)
9. `tests/e2e/stage10-core-pages.spec.ts` (1 desktop, 1 mobile) — PASS (12.8s)
10. `tests/e2e/stage11-reminders.spec.ts` (1 desktop, 1 mobile) — PASS (13.0s)
11. `tests/e2e/stage12-insights.spec.ts` (1 desktop, 1 mobile) — PASS (10.4s)
12. `tests/e2e/stage14-remaining-scope.spec.ts` (1 desktop, 1 mobile) — PASS (10.0s)
13. `tests/e2e/start-page-auth.spec.ts` (1 desktop, 1 mobile) — PASS (5.5s)

---

## 4. Test Integrity Statement

Zero assertions were modified, disabled, or weakened. All 157 unit tests and 36 browser tests executed against real application code and database adapters.
