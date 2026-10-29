# UI/UX Design System

## Authority
Follow Part 7 (design direction), Part 8 (writing rules), and Part 6 (screen specifications) of `InvoicePilot_FINAL.md`. The values below are copied from the project directive; inspect the source document for any additional detailed rules.

## Concept
A refined financial workspace inspired by paper invoices, ledgers, receipts, and approval slips. The approval slip is the signature interaction: paper-like surface, perforated edge, serif financial details, restrained yellow review highlight, and brief stamp feedback.

## Typography
- Hanken Grotesk: interface.
- Newsreader: invoice documents, approval slips, policy-style content.
- Tabular numerals for financial amounts and aligned numeric tables.

## Color tokens
### Light
| Token | Value |
|---|---|
| desk | `#EEF0F3` |
| sheet | `#FFFFFF` |
| sheet-2 | `#E4E8ED` |
| ink | `#151A21` |
| ink-muted | `#566070` |
| rule | `#D3D8DF` |
| primary | `#0E5A6B` |
| on-primary | `#FFFFFF` |
| highlight | `#F4D35E` |
| paid | `#1B7F4B` |
| late | `#B3362B` |
| caution | `#9A6200` |
| info | `#2F5FA8` |
### Dark
| Token | Value |
|---|---|
| desk | `#0F151C` |
| sheet | `#17202A` |
| sheet-2 | `#1F2A36` |
| ink | `#E7ECF1` |
| ink-muted | `#98A5B5` |
| rule | `#2C3947` |
| primary | `#5CC3D0` |
| on-primary | `#07161A` |
| highlight | `#E9C441` |
| paid | `#4FD38E` |
| late | `#FF7A6E` |
| caution | `#F0B450` |
| info | `#7FAEF0` |

## Design rules
- No gradients or generic purple fintech look.
- Avoid repetitive card-grid layouts and excessive rounding.
- Avoid decorative animation; motion must explain meaningful state change.
- No fake logos, testimonials, or invented metrics.
- No dead controls or generic marketing filler.
- Use clear hierarchy, fine rules, deliberate whitespace, readable contrast, and aligned financial data.
- Use sentence case and concise, human copy.
- Status must never rely on color alone.

## Interaction requirements
- Every control has a real action, feedback, and appropriate disabled/loading state.
- Approval slip must show client, items, currency, total, due date, and warnings before approval.
- Discarding an action must not execute it.
- Explain errors in user language; do not expose secrets or internal stack traces.
- Provide loading, empty, validation, success, and error states.

## Accessibility and responsive behavior
- Target WCAG AA contrast; verify rather than claim compliance without evidence.
- Semantic elements and labels; keyboard-operable dialogs/forms; visible focus.
- Test 360px width and desktop layouts.
- Respect light, dark, and system theme settings.
- Announce status updates accessibly where appropriate.

## Page inventory
Use Part 6 of the source specification as the complete 26-screen authority. Track each screen in `FEATURE_STATUS.md`; do not treat this design document as proof of implementation.
