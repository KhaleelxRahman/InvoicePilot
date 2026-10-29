# Feature Status Ledger

## Status definitions
- NOT STARTED — no implementation evidence found.
- IN PROGRESS — active implementation, not accepted yet.
- BLOCKED — cannot proceed until a named dependency is resolved.
- IMPLEMENTED — UNVERIFIED — code appears present, but meaningful acceptance test has not passed.
- VERIFIED — meaningful reproducible test passed and evidence recorded.
- DEFERRED — intentionally moved beyond current release, with reason.

## Initial baseline
This ledger is initialized from the supplied directive, not from an inspection of a live codebase. Audit and update Stage 0. If the actual project contains code, inspect it and update rows with evidence rather than assuming either absence or success.

| Feature | Initial status | Evidence/test | Next action |
|---|---|---|---|
| Project audit | NOT STARTED | Not inspected in this session | Inspect files and runtime |
| App foundation | NOT STARTED | No verified evidence | Audit then implement |
| PayPal OAuth Sandbox | NOT STARTED | No successful call reported | Run official-doc-based test |
| PayPal invoice draft/send/retrieve | NOT STARTED | No successful call reported | Verify supported API flow |
| PayPal webhook verification | NOT STARTED | Not tested | Evaluate after core API flow |
| Gemini agent | NOT STARTED | Not verified | Inspect config and test structured output |
| Database persistence | NOT STARTED | Not verified | Inspect and test CRUD/ownership |
| Authentication | NOT STARTED | Not verified | Inspect and test protected routes |
| Approval gate | NOT STARTED | Not verified | Implement server-enforced state machine |
| Activity log | NOT STARTED | Not verified | Implement with core flow |
| UI pages (Part 6) | NOT STARTED | Full inventory pending | Expand into individual screen rows after audit |
| Reminders | NOT STARTED | Not verified | Defer until core path works |
| Insights/forecast | NOT STARTED | Not verified | Implement only with grounded data/calculations |
| MCP/Agent Toolkit | NOT STARTED | No invocation verified | Evaluate after core path |
| Public repository/license | NOT STARTED | Not verified | Inspect Git status/repository |
| Deployment | NOT STARTED | Not verified | Choose after runtime audit |
| Demo video/submission | NOT STARTED | Not recorded | Complete after release verification |

## Evidence format
For each VERIFIED item, record: test date, environment, exact steps/command, expected result, actual result, test artifact/log reference with secrets redacted, commit/build, and remaining limitations.
