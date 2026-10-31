# Risk Register

| Risk | Likelihood/impact | Mitigation | Trigger/owner | Status |
|---|---|---|---|---|
| PayPal invoice API flow differs from assumptions | Medium/High | Verify current official docs and run independent Sandbox tests before UI integration | Any failed/ambiguous API operation | OPEN |
| Secret accidentally exposed | Medium/Critical | Server-side secrets, gitignore, secret scan, rotate leaked keys | Secret found in logs/repo/chat | OPEN |
| Mock response mistaken for real | Medium/High | Explicit mode labels and isolated adapters | UI or logs omit mode | OPEN |
| AI creates incorrect invoice data | Medium/High | Schema and business validation, user review, conventional form fallback | Invalid model output | OPEN |
| Approval bypass or duplicate send | Low/High | Server state machine, revalidation, idempotency/reconciliation | Repeated/stale action test fails | OPEN |
| Webhook spoofing/duplicate processing | Medium/High | Verify signatures and idempotency | Webhook feature begins | OPEN |
| Scope creep delays core demo | High/High | Core acceptance journey first; defer optional features explicitly | Core path not verified | OPEN |
| Platform cannot host required backend | Medium/High | Inspect environment early and test server capabilities | Server/secret support unclear | OPEN |
| Forecasts imply false precision | Medium/Medium | Ground calculations, label estimates, test boundaries | Forecast feature begins | OPEN |
| Incomplete setup instructions | Medium/High | Fresh-environment README test | Release preparation | OPEN |
| Accessibility defects | Medium/Medium | Keyboard, contrast, responsive checks per stage | UI stage completion | OPEN |
| Missing upstream `InvoicePilot_FINAL.md` (Part 6 26-screen list) | High/Medium | Track 14 documented feature groups (`F-001`–`F-014`) in `FEATURE_STATUS.md` (`D-003`, `D-004`); keep missing 26-screen list documented as a gap without inventing screens | Stage 10 / 14 planning | OPEN |
| Root `.gitignore` absent before Stage 1 | Low/Critical | Mitigated in Stage 01: root `.gitignore` and blank `.env.example` created and verified | Stage 1 complete | MITIGATED (Stage 01) |

Update likelihood/impact based on actual project evidence. Do not mark a risk closed without evidence.
