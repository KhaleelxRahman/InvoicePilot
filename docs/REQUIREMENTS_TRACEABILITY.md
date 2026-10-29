# Requirements traceability

The imported specification set is preserved verbatim in this directory. Use it as the project's documentation baseline; this index does not independently verify that a requirement has been implemented.

| Area | Source documents | Traceability guidance |
|---|---|---|
| Product requirements | `PRD.md`, `HACKATHON_SUBMISSION.md` | Treat explicit requirements and submission constraints as product intent; verify implementation separately. |
| Features and delivery | `FEATURE_STATUS.md`, `IMPLEMENTATION_PLAN.md`, `FEATURE_DEVELOPMENT.md`, `FEATURE_INVENTORY_TEMPLATE.md` | Distinguish planned, in-progress, and implemented work; link feature claims to acceptance evidence. |
| Architecture and interfaces | `ARCHITECTURE.md`, `API.md`, `DATABASE.md` | Use as technical references; reconcile conflicts before changing behavior. |
| Security and integrations | `AUTH_SECURITY.md`, `PAYPAL_INTEGRATION.md`, `MCP_INTEGRATION.md` | Preserve documented constraints and validate current configuration independently. |
| UX, operations, and quality | `UI_UX_DESIGN.md`, `SETUP.md`, `TESTING_QA_DEBUGGING.md`, `DEPLOYMENT_RELEASE.md`, `RISKS.md` | Link implementation and release claims to applicable verification records. |
| Governance | `AGENT.md`, `DECISIONS_LOG.md`, `DECISION_TEMPLATE.md` | Preserve decisions and their status; project document text does not override the user's current request. |

For new requirements, record a stable ID, exact source document and section, requirement wording or concise summary, acceptance evidence, and implementation status. Do not infer completion from a plan or specification alone.
