# INVOICEPILOT — VIDEO SCENE & EVIDENCE MAP
### 02:56 Master Demonstration Film (176.000s)

**Target Video:** `video-production/InvoicePilot_Judge_Cinematic_Demo_2m56.mp4`
**Audio Voice:** `en-US-ChristopherNeural` (Rate +6%)
**Loudness:** -18.5 dB Mean Volume, -0.0 dB True Peak
**Framerate:** 30.00 fps (5,280 frames)

---

## TIMELINE & SCENE EVIDENCE BREAKDOWN

### Scene 1: Premium Opening & Official PayPal Hackathon Branding
- **Time:** `00:00.000 – 00:12.000` (12.0s / 360 frames)
- **Narration:** *"Welcome to InvoicePilot, a working prototype built for the PayPal AI Hackathon 2026. This is intelligent financial operations with absolute human control."* (10.82s speech / +1.18s headroom)
- **Visual Display:**
  - Official PayPal Hackathon Badge (`video-production/paypal_hackathon_badge.png`) with authentic PayPal vector monogram and "PAYPAL AI HACKATHON 2026".
  - Metallic 3D title: `INVOICEPILOT` • `AI-POWERED FINANCIAL OPERATIONS`.
  - Core invariant banner: `AI PREPARES. • HUMANS APPROVE. • THE BACKEND VALIDATES. • PAYPAL PROCESSES.`
  - Explicit prototype disclosure: `A WORKING HACKATHON PROTOTYPE`.
- **Underlying Code Evidence:** `src/client/components/StartPage.tsx`, `package.json`.

---

### Scene 2: Problem & Solution
- **Time:** `00:12.000 – 00:25.000` (13.0s / 390 frames)
- **Narration:** *"Freelancers lose hours to manual invoicing, while autonomous AI creates financial risk. InvoicePilot introduces human control: AI prepares, humans approve, and PayPal transacts."* (12.89s speech / +0.11s headroom)
- **Visual Display:**
  - 3 structured contrast cards on subtle financial ledger grid:
    1. `THE MANUAL BURDEN` (Uncompensated hours, tax errors, fragmented emails)
    2. `THE AUTONOMOUS AI RISK` (Black-box execution, hallucinations, zero accountability)
    3. `THE INVOICEPILOT INVARIANT` (Structured proposals, SHA-256 approval, deterministic integer math)
  - Bottom principle: `Human-in-the-Loop Financial Control`.
- **Underlying Code Evidence:** `docs/PRD.md`, `README.md`.

---

### Scene 3: Login & Onboarding (Real App Starting Point)
- **Time:** `00:25.000 – 00:43.000` (18.0s / 540 frames)
- **Sub-segments:**
  - `00:25–00:34` (9.0s): `live-walkthrough-screenshots/01-start-page.png`
  - `00:34–00:43` (9.0s): `live-walkthrough-screenshots/02-registration-form.png`
- **Narration:** *"Every journey begins at the live start page. Freelancers authenticate securely via scrypt sessions, complete business onboarding, and configure payment preferences before entering the workspace."* (12.74s speech / +5.26s headroom)
- **Visual Display:**
  - Actual high-resolution browser viewport of the live running application (`https://invoicepilot-beryl.vercel.app/`).
  - Chapter Indicator: `CHAPTER 01 • APPLICATION ENTRY & ONBOARDING`.
  - Callout: `Secure Scrypt Session Authentication & Multi-Tenant Workspace Initialization`.
- **Underlying Code Evidence:** `src/client/components/StartPage.tsx`, `src/client/components/AuthModal.tsx`, `src/server/app.ts` (`/api/auth/register`, `/login`).

---

### Scene 4: Dashboard & Client Management
- **Time:** `00:43.000 – 01:00.000` (17.0s / 510 frames)
- **Sub-segments:**
  - `00:43–00:51.5` (8.5s): `live-walkthrough-screenshots/13-overview-screen.png`
  - `00:51.5–01:00` (8.5s): `live-walkthrough-screenshots/06-client-created.png`
- **Narration:** *"The dashboard aggregates live account data: total receivables, aging buckets, and collection forecasts. In client management, users maintain verified client profiles scoped strictly to their account."* (12.82s speech / +4.18s headroom)
- **Visual Display:**
  - Real operational dashboard showing $12,450.00 Total Billed, $3,200.00 Outstanding, aging buckets, and 30-day forecast.
  - Real client catalog showing tenant-scoped client cards and contact details.
  - Chapter Indicator: `CHAPTER 02 • LIVE DASHBOARD & CLIENT CATALOG`.
- **Underlying Code Evidence:** `src/server/insights/cashFlowInsights.ts`, `src/server/db/repository.ts`.

---

### Scene 5: Conventional Invoice Creation
- **Time:** `01:00.000 – 01:22.000` (22.0s / 660 frames)
- **Sub-segments:**
  - `01:00–01:11` (11.0s): `live-walkthrough-screenshots/07-invoice-draft-form.png`
  - `01:11–01:22` (11.0s): `live-walkthrough-screenshots/08-invoice-saved-detail.png`
- **Narration:** *"Here is conventional invoice creation. Users draft multi-line items with instant tax calculations. All financial amounts are tracked in integer minor units, completely preventing floating-point rounding errors."* (13.78s speech / +8.22s headroom)
- **Visual Display:**
  - Real multi-line item builder interface with descriptions, quantities, unit prices, and tax rates.
  - Real saved invoice detail view displaying draft status, amounts, and PDF export action.
  - Chapter Indicator: `CHAPTER 03 • CONVENTIONAL INVOICE AUTHORING`.
- **Underlying Code Evidence:** `src/client/components/InvoiceDraftForm.tsx`, `src/server/db/schema.ts` (`parseDecimalToMinorUnits`, `formatMinorUnitsToDecimal`).

---

### Scene 6: Gemini AI Copilot Assistant
- **Time:** `01:22.000 – 01:40.000` (18.0s / 540 frames)
- **Narration:** *"With our Gemini copilot, natural language requests are converted into structured schema outputs. Gemini resolves client identities exclusively against stored records—it never invents clients, and never executes autonomously."* (14.35s speech / +3.65s headroom)
- **Visual Display:**
  - Real browser capture of Gemini AI copilot (`live-walkthrough-screenshots/14-ai-assistant.png`).
  - Natural language invoice draft prompt parsing into structured line items.
  - Chapter Indicator: `CHAPTER 04 • GEMINI ASSISTANT: STRUCTURED PROPOSALS`.
  - Callout: `AI BOUNDARY: AI Proposes Structured JSON Schema Only • Zero Autonomous Dispatch`.
- **Underlying Code Evidence:** `src/server/agent/geminiAgent.ts`, `tests/unit/geminiAgent.test.ts`.

---

### Scene 7: Validation & Human Approval Gate
- **Time:** `01:40.000 – 01:57.000` (17.0s / 510 frames)
- **Narration:** *"Before any invoice leaves the system, it halts at the Paper Approval Slip. The backend generates a SHA-256 payload hash and locks execution until the user manually signs off."* (12.14s speech / +4.86s headroom)
- **Visual Display:**
  - Real browser capture of the signature Paper Approval Slip (`live-walkthrough-screenshots/12-paper-approval-slip.png`).
  - Cryptographic SHA-256 payload hash display, execution state lock, and explicit "Approve & Send to PayPal" button.
  - Chapter Indicator: `CHAPTER 05 • THE SIGNATURE PAPER APPROVAL SLIP`.
- **Underlying Code Evidence:** `src/client/components/ApprovalSlip.tsx`, `src/server/app.ts` (`ApprovalSlipPayload`, state transitions).

---

### Scene 8: PayPal Sandbox REST API Integration
- **Time:** `01:57.000 – 02:14.000` (17.0s / 510 frames)
- **Sub-segments:**
  - `01:57–02:05.5` (8.5s): `live-walkthrough-screenshots/18-settings-paypal.png`
  - `02:05.5–02:14` (8.5s): `docs/assets/screenshots/11-paypal-sandbox-settings.png`
- **Narration:** *"Approved invoices dispatch directly to the PayPal Sandbox Invoicing API, generating real buyer payment links. Notice this is strictly a test sandbox environment—no live money is ever moved."* (13.03s speech / +3.97s headroom)
- **Visual Display:**
  - Real PayPal Sandbox configuration and live status reflection.
  - Verified invoice dispatch evidence (`INV2-L6AC-23HU-KWTU-X8FY`) and buyer link (`sandbox.paypal.com/invoice/p/#...`).
  - Chapter Indicator: `CHAPTER 06 • PAYPAL SANDBOX REST API INTEGRATION`.
  - Prominent Badge: `PAYPAL SANDBOX ONLY — NO REAL MONEY MOVED • EXTERNAL BUYER CHECKOUT`.
- **Underlying Code Evidence:** `src/server/paypal/adapter.ts`, `docs/PAYPAL_SANDBOX_E2E_EVIDENCE.md`.

---

### Scene 9: Standardized PDF & Audit Activity Ledger
- **Time:** `02:14.000 – 02:25.000` (11.0s / 330 frames)
- **Sub-segments:**
  - `02:14–02:19.5` (5.5s): Actual generated invoice PDF document sheet (`video-production/invoice_pdf_sheet.png`)
  - `02:19.5–02:25` (5.5s): `live-walkthrough-screenshots/15-activity-log.png`
- **Narration:** *"Users can instantly download a standardized PDF invoice, while the append-only activity log records every lifecycle transition and webhook event."* (9.02s speech / +1.98s headroom)
- **Visual Display:**
  - Real ISO 32000-1 compliant PDF 1.4 invoice document preview (#INV-2026-1002) generated by `invoicePdfGenerator.ts`.
  - Real chronological audit log showing invoice created, approved, dispatched, and webhook status transitions.
  - Chapter Indicator: `CHAPTER 07 • STANDARDIZED PDF & AUDIT LEDGER`.
- **Underlying Code Evidence:** `src/server/pdf/invoicePdfGenerator.ts`, `src/server/db/schema.ts` (`activity_log` table).

---

### Scene 10: Verified Architecture & Engineering Rigor
- **Time:** `02:25.000 – 02:42.000` (17.0s / 510 frames)
- **Narration:** *"Our zero-trust architecture spans React 19, Express, Supabase PostgreSQL, and PayPal REST APIs, validated by one hundred fifty-seven Vitest unit tests and thirty-six Playwright browser tests."* (13.30s speech / +3.70s headroom)
- **Visual Display:**
  - Technical engineering blueprint schematic mapping all 7 system layers.
  - Card 1: `157 Vitest Tests (100% Pass)` covering scrypt security, arithmetic, tenancy, and state machines.
  - Card 2: `36 Playwright Tests (100% Pass)` covering desktop Chromium + mobile viewports with 0 layout overflow.
  - Chapter Indicator: `ENGINEERING FOUNDATION & CODEBASE RIGOR`.
- **Underlying Code Evidence:** `docs/ARCHITECTURE.md`, `tests/unit/`, `tests/e2e/`.

---

### Scene 11: Conclusion, Verified Links & Thank You
- **Time:** `02:42.000 – 02:56.000` (14.0s / 420 frames)
- **Narration:** *"AI proposes, humans decide, and PayPal processes. Inspect our verified GitHub repository, or test the live demo today. Thank you for watching."* (11.59s speech / +2.41s headroom)
- **Visual Display:**
  - Official PayPal Hackathon Badge.
  - Metallic 3D `INVOICEPILOT` title & `AI PROPOSES. HUMANS DECIDE. THE BACKEND VALIDATES. PAYPAL PROCESSES.`
  - Prototype disclosure: `A WORKING HACKATHON PROTOTYPE • PayPal Sandbox Integration Only`.
  - Dual clickable cards:
    - `github.com/KhaleelxRahman/InvoicePilot`
    - `invoicepilot-beryl.vercel.app`
  - Display title: `THANK YOU FOR WATCHING` with smooth fade-to-black at 02:55.0–02:56.0.
- **Underlying Code Evidence:** `README.md`, `docs/DECISIONS_LOG.md`.
