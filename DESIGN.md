---
name: InvoicePilot Design System
description: The Precision Ledger — High-craft financial workspace for freelancers and small service businesses
colors:
  primary: "#285B4A"
  primary-hover: "#1E4638"
  primary-subtle: "#E9F1EC"
  surface-desk: "#F5F6F3"
  surface-card: "#FFFFFF"
  surface-secondary: "#EEF1ED"
  surface-hover: "#E3E8E3"
  ink: "#202923"
  ink-muted: "#66716A"
  rule: "#DEE4DF"
  rule-light: "#E8ECE8"
  status-paid: "#236B4D"
  status-paid-bg: "#EBF5F0"
  status-late: "#A83832"
  status-late-bg: "#FAECEB"
  status-caution: "#94601A"
  status-caution-bg: "#FDF6EB"
  status-info: "#315A75"
  status-info-bg: "#EDF4F8"
  overlay-backdrop: "rgba(21, 26, 24, 0.65)"
  modal-backdrop: "rgba(0, 0, 0, 0.45)"
  scrim-backdrop: "rgba(0, 0, 0, 0.25)"
typography:
  display:
    fontFamily: "'Newsreader', Georgia, serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  display-sm:
    fontFamily: "'Newsreader', Georgia, serif"
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  headline-sm:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title-sm:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.005em"
  body:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0em"
  body-sm:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.01em"
  caption:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  micro:
    fontFamily: "'Hanken Grotesk', -apple-system, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "20px 24px"
  input:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System

## Overview

**Creative North Star: The Precision Ledger**

InvoicePilot is built for independent professionals who treat their business with seriousness and dignity. Its design rejects generic "AI SaaS" templates—no fluorescent gradients, no floating decorative cards, no noisy glow effects, and no clichéd side-tab borders.

Instead, InvoicePilot draws on the timeless craft of trusted financial documents: warm paper surfaces, calm forest greens, deep typographic contrast, crisp 1px borders, and tabular numerals. The interface operates quietly and with restraint, getting completely out of the freelancer's way while conveying rock-solid security and human-in-the-loop control.

## Colors

The color system is strictly restrained and semantic. Color is reserved for state indicators, primary actions, and financial outcomes:

- **Primary Brand**: Deep Forest Green (`#285B4A` in light, `#8FBFA6` in dark). Conveys trust, longevity, and financial stability without the coldness of corporate blue.
- **Surfaces**: Layered neutral planes (`--desk` ground, `--sheet` card surface, `--sheet-2` subtle controls). Surfaces are never muddy gray; they carry a slight warm paper tint in light mode and deep forest slate in dark mode.
- **Financial Status Vocabularies**:
  - **Paid / Completed**: Pine Green (`#236B4D` / `#EBF5F0` bg). Solid confirmation of settled funds.
  - **Pending Approval / Caution**: Amber Ochre (`#94601A` / `#FDF6EB` bg). Demands review before dispatch.
  - **Overdue / Failed / Action Required**: Restrained Crimson (`#A83832` / `#FAECEB` bg). Clear urgency without shouting.
  - **Draft / In-Flight**: Slate Teal (`#315A75` / `#EDF4F8` bg). Neutral progress.
- **WCAG AA Compliance**: All text pairings maintain a contrast ratio of at least 4.5:1 against their backgrounds (3:1 for display typography).

## Typography

Typography establishes clear, scannable hierarchy through proportion and weight, not decorative tricks:

- **UI & Controls (`Hanken Grotesk`)**: A contemporary humanist sans-serif with high legibility at micro sizes, used across all forms, buttons, tables, and navigation.
- **Financial Documents & Invoices (`Newsreader`)**: A refined serif face reserved for document headers, company names, and paper invoice titles.
- **Tabular Figures (`tabular-nums`)**: Tabular numeric figures (`font-variant-numeric: tabular-nums`) are enforced across all monetary amounts, invoice dates, account numbers, and rates so columns align with mathematical precision.
- **Scale & Ratio**: Fixed rem scale with tight ratios (1.15–1.2x). No giant fluid headers that break in dashboards.
- **Line Measure**: Prose and explanatory descriptions are kept to 65–75 characters per line for effortless reading.

## Layout

- **Shell Architecture**: Responsive top utility bar with universal keyboard search (`Cmd/Ctrl+K`), quick notifications popover, status mode badge, and persistent responsive navigation.
- **Spacing Rhythm**: 4px/8px geometric cadence (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`). Tight groups inside components; generous separation between sections.
- **Responsive Grid**: Fluid full-width desktop viewports up to 1320px container max-width, cleanly collapsing to single-column card flows with sticky bottom actions on mobile viewports down to 360px.
- **Data Presentation**: Responsive table wrappers with clean horizontal scrolling and sticky first columns on narrow screens.

## Elevation & Depth

- **Declare Elevation Once**: Every surface declares elevation either via a single 1px border (`var(--rule)`) or a soft directional shadow, never both simultaneously. "Ghost cards" (wide fuzzy shadows on 1px borders) are prohibited.
- **Shadow Direction**: Subtle, soft offset shadows (`0 1px 2px rgba(..., 0.05)`, `0 4px 6px -1px rgba(..., 0.07)`). Zero-blur block shadows and colored halo glows are prohibited.
- **Tonal Layering**: Depth is achieved through tonal surface contrast (`--desk` -> `--sheet` -> `--sheet-2`) rather than artificial drop shadows.

## Shapes

- **Card Radii**: Standardized at `10px` (`--radius-md`) to `14px` (`--radius-lg`) for clean modern feel without childish pill cards.
- **Control Radii**: `6px` (`--radius-sm`) for buttons, form inputs, and select menus.
- **Pills**: Reserved exclusively for small inline status chips and badges (`--radius-full`), never for outer containers or content cards.
- **No Side-Tab Borders**: Thick colored borders on one side of a card (`border-left: 3px solid ...`) are strictly prohibited. Status is communicated through badges, icons, and subtle tonal surface fills.

## Components

- **Buttons**:
  - Primary: Solid forest green with high-contrast text. Used for main action per screen (e.g., "Create invoice", "Approve & send").
  - Secondary: Crisp card background with subtle 1px border.
  - Ghost: Borderless, subtle hover tint. Used for secondary navigation and utility actions.
  - Danger: Restrained crimson for destructive actions (e.g., "Discard draft", "Delete client").
- **Inputs & Forms**:
  - Accessible labels above inputs, distinct placeholder text, clear hint copy, and validation feedback with icon + message.
  - Focus state: `outline: 2px solid var(--primary); outline-offset: 2px;` with subtle ring expansion.
- **Approval Slip**:
  - The centerpiece of the human approval gate. Formatted as an authentic paper slip with perforated borders, clear financial consequence summary, itemized line items, and binary "Approve & Send" vs "Discard" actions.
- **Empty States**:
  - Contextual, educational empty states with clear SVG illustrations, brief explanatory text, and a prominent primary action to activate the feature.

## Do's and Don'ts

### Do:
- Align all currency values, quantities, and dates with `tabular-nums`.
- Use badges with clear icons for status representation.
- Provide all 7 interactive states on interactive elements: default, hover, focus-visible, active, disabled, loading, and error.
- Use explicit, action-oriented copy ("Approve & Send Invoice", not "Submit").
- Preserve strict PayPal Sandbox vs Mock labeling and warnings.

### Don't:
- **No side-tab borders**: Never use a 3px or 4px colored `border-left` on cards, banners, or lists.
- **No kickers or eyebrows**: Do not place small uppercase labels above main headings. Let headings speak for themselves.
- **No gradient text**: Text must have solid, readable contrast.
- **No decorative glassmorphism**: Avoid blurry backdrop filters on static content cards.
- **No nested cards**: Avoid placing bordered cards inside bordered cards; use dividers or whitespace.
- **No fake sparklines or emojis as icons**: Use crisp, consistent SVG icons throughout.
