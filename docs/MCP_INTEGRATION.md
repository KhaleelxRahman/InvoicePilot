# MCP and PayPal Agent Toolkit Evaluation

## Current status
NOT STARTED. Do not claim MCP or Agent Toolkit is connected until a real tool invocation is tested.

## Decision principle
MCP is optional. First prove the core PayPal invoice workflow through the simplest reliable supported path. Evaluate current official PayPal AI docs and tool references before choosing MCP, Agent Toolkit, or direct REST API calls.

## Evaluation checklist
- [ ] Confirm official product/repository/documentation and current maintenance state.
- [ ] Verify required invoicing operations are actually exposed.
- [ ] Confirm auth flow, permissions, and Sandbox support.
- [ ] Confirm runtime compatibility with Google AI Studio/application server.
- [ ] Understand tool input/output schemas and error behavior.
- [ ] Identify where approval and authorization checks run.
- [ ] Review prompt-injection and arbitrary-tool risks.
- [ ] Compare implementation cost and demo reliability against direct REST.
- [ ] Run a real, reproducible Sandbox invocation if selected.
- [ ] Record limitations and fallback path.

## Safety requirements if implemented
- Keep credentials outside the model context and browser.
- Validate all arguments and outputs.
- Restrict available tools to the minimum required.
- Keep user approval and server authorization checks identical to direct REST mode.
- Never expose arbitrary payment operations or unrestricted network/filesystem tools to the agent.

## Decision record
Update `DECISIONS_LOG.md` with alternatives, official references, tests performed, trade-offs, and final choice. If not selected, state why; do not imply it is implemented.
