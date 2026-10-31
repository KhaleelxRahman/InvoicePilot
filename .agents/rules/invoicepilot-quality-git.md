---
trigger: always_on
description: "Always-on feature quality, mandatory Playwright E2E verification, and safe Git staging workflow rules for InvoicePilot."
---

# InvoicePilot Feature Quality, Playwright & Git Workflow Rule

## Apply this workflow to every request
At the start of every user request:
- Read the current request and classify it as a question, documentation task, bug fix, feature, or other task.
- Answer questions directly without making code or Git changes.
- For implementation requests, inspect the relevant project documentation, code, and current Git status before editing.
- Follow the user’s requested scope and the verified InvoicePilot requirements and architecture. Do not add unrelated features or silently change business logic.
- Check `git status --short --branch` first. Preserve all pre-existing user changes and identify them before editing.

## Implementation quality
For every app or UI implementation request:
- Implement the complete requested behavior against clear acceptance criteria.
- Cover normal use, validation, error states, loading states, and relevant security boundaries.
- Keep the change focused, consistent with the existing architecture, and free of unrelated refactors.
- Review the result for regressions, accessibility basics, responsive behavior where relevant, and browser console errors.
- Do not claim a feature works unless you have verified it.

## Mandatory Playwright verification
After every app or UI code change:
- Use the repository’s existing Playwright setup and commands when available.
- Run the relevant Playwright end-to-end tests, including the requested user journey and affected regression paths. Use the configured browsers/projects where practical.
- If a local app server is needed, start it using the project’s documented or configured command; do not use production data or live payment credentials.
- If a test fails, investigate, fix issues within the authorized scope, and rerun the affected tests. Continue until they pass or a real blocker prevents verification.
- If Playwright is missing or the app cannot run, do not claim success. Report what is missing, what you attempted, and the exact next step needed. Do not silently skip verification.
- For documentation-only or question-only requests with no app behavior change, state that Playwright is not applicable instead of running irrelevant browser tests.
- Use Playwright’s actual test results as evidence; never fabricate a pass. Follow its configured test projects and commands rather than inventing a test command. [Playwright test execution](https://playwright.dev/docs/running-tests)

## Safe Git workflow
- Before changes, record the existing `git status --short --branch` and distinguish pre-existing changes from this task.
- After implementation and successful applicable verification:
  - Review the exact files changed.
  - Stage only files produced by the current authorized task, using explicit paths: `git add -- <file paths>`.
  - Do not stage pre-existing user changes, secrets, `.env` files, machine-specific files, or Reticle session/run artifacts.
  - Run `git diff --cached --check`, `git diff --cached --stat`, and `git status --short --branch`.
  - Report exactly what is staged and any unstaged or pre-existing changes.
- Never commit, amend, push, reset, clean, or discard changes unless the user explicitly asks. If the user asks for a commit or push, verify the staged diff first and act only on the authorized changes.

## Final response
For each implementation request, report:
- What changed
- Playwright command(s) run and pass/fail outcome
- Any verification limits or remaining failures
- Exact staged files and Git status
- Confirmation that unrelated and pre-existing changes were preserved
- Do not call work “perfect” or “complete” when tests fail, verification was skipped, or material blockers remain.
