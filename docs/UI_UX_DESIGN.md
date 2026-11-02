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
| Token | Value | Description |
|---|---|---|
| desk | `#F5F6F3` | Warm neutral paper desk surface |
| sheet | `#FFFFFF` | Pristine card surface |
| sheet-2 | `#EEF1ED` | Soft secondary surface |
| ink | `#202923` | Deep slate-green ink |
| ink-muted | `#66716A` | Muted secondary text |
| rule | `#DEE4DF` | Crisp subtle border |
| primary | `#285B4A` | Deep forest / sage green |
| on-primary | `#FFFFFF` | Text on primary |
| subtle-primary | `#E9F1EC` | Soft primary background |
| highlight | `#F3EFE6` | Soft warm parchment tint |
| paid | `#236B4D` | Pine green success |
| late | `#A83832` | Restrained burgundy / crimson |
| caution | `#94601A` | Deep ochre / amber |
| info | `#315A75` | Slate-teal |

### Dark
| Token | Value | Description |
|---|---|---|
| desk | `#151A18` | Deep forest slate desk surface |
| sheet | `#1C2420` | Refined dark card surface |
| sheet-2 | `#242E29` | Raised dark secondary surface |
| ink | `#E9EFEA` | Crisp light primary text |
| ink-muted | `#A5B0A8` | Muted secondary text |
| rule | `#344139` | Refined dark border |
| primary | `#8FBFA6` | Calm sage green |
| on-primary | `#11231B` | Text on primary |
| subtle-primary | `rgba(143, 191, 166, 0.15)` | Dark primary tint |
| highlight | `rgba(180, 160, 120, 0.15)` | Soft parchment tint |
| paid | `#68C194` | Calm mint green |
| late | `#E26D68` | Soft crimson |
| caution | `#E09F45` | Muted amber |
| info | `#7FA7C4` | Slate blue-teal |

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
