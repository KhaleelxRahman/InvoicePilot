# INVOICEPILOT — HACKATHON DEMO WALKTHROUGH SCRIPT
**Competition**: PayPal AI Hackathon  
**Target Duration**: 3 Minutes  
**Live URL**: `https://invoicepilot-beryl.vercel.app`  

---

## Storyboard & Step-by-Step Narrative

### 0:00 – 0:30: The Hook & Problem Statement
- **Visual**: Start on InvoicePilot Start Page / Dashboard (`https://invoicepilot-beryl.vercel.app`).
- **Speaker**:
  > "Freelancers and consultants spend over 15% of their working hours creating invoices, calculating taxes, and chasing late payments. But handing financial keys over to an autonomous AI agent is dangerous—LLMs hallucinate, invent amounts, and shouldn't be allowed to move money on their own.
  >
  > Enter **InvoicePilot**: your AI Financial Operations Copilot. Our philosophy is simple: **AI proposes. The user decides. The backend validates. PayPal processes. Verified evidence reconciles.**"

---

### 0:30 – 1:15: Natural-Language Invoice Drafting with Gemini
- **Visual**: Navigate to **AI Assistant** tab.
- **Action**: Enter the prompt:
  ```text
  Draft an invoice for Acme Global Solutions for website development at $5.00 due Nov 20
  ```
- **Speaker**:
  > "Watch how fast and grounded our Gemini integration is. We use Gemini Flash with optimized low-thinking latency, bounded retries, and strict schema validation."
- **Visual**: In ~5 seconds, the structured proposal appears with client Acme Global Solutions, line items, and server-recalculated minor-unit math ($5.00 = 500 minor units).
- **Speaker**:
  > "Notice that Gemini didn't guess the total with floating-point math; our backend calculated the exact minor units. And crucially: **the invoice was not sent to PayPal yet**."

---

### 1:15 – 1:55: The Cryptographic Human Approval Slip
- **Visual**: Click **Propose for Approval** -> The **Paper Approval Slip** modal opens.
- **Speaker**:
  > "This is InvoicePilot's primary security differentiator: the **Cryptographic Approval Slip**.
  >
  > Every financial mutation requires explicit human authorization. The slip displays the exact client, currency, line items, and a SHA-256 payload hash. If the draft is edited after proposal, the hash breaks and the action expires. The AI cannot bypass this gate."
- **Action**: Click **Approve & Send via PayPal**.

---

### 1:55 – 2:30: PayPal Sandbox Dispatch & Buyer Checkout
- **Visual**: Invoice transitions to `SENT`. Detail view shows:
  - `Provider Invoice ID`: `INV2-...`
  - `Recipient View URL`: `https://www.sandbox.paypal.com/invoice/p/...`
- **Speaker**:
  > "Our backend calls PayPal REST API v2 to create and dispatch the invoice. Here is the live recipient payment link generated directly by PayPal Sandbox."
- **Action**: Open the link in a new window.
- **Visual**: The official PayPal Sandbox checkout loads. Log in as `sb-buyer@personal.example.com` and click **Pay $5.00**.
- **Speaker**:
  > "The customer pays using their PayPal account. PayPal then triggers a real webhook event back to InvoicePilot."

---

### 2:30 – 2:50: Webhook Verification & Automatic Reconciliation
- **Visual**: Switch back to InvoicePilot. Show **Activity Log** / **Webhook Event Viewer**.
- **Speaker**:
  > "Our server receives the `INVOICING.INVOICE.PAID` webhook, validates the transmission signature using PayPal's public certificates, deduplicates against replay attacks, and atomically updates the invoice to PAID."
- **Visual**: The invoice chip changes to emerald **PAID**. Dashboard collected revenue updates in real time.

---

### 2:50 – 3:00: Financial Insights & ISO PDF Export
- **Visual**: Briefly show **Financial Insights** (aging buckets 30/60/90+ days, client reliability ranking) and click **Download PDF** to show the pure TypeScript ISO 32000-1 invoice PDF.
- **Speaker**:
  > "From conversational input to verified payment reconciliation, InvoicePilot is a production-ready financial copilot built on Google Gemini, PayPal Sandbox, and Supabase PostgreSQL. Thank you!"

---

## Key Talking Points for Judges

1. **Zero Hallucinated Financial Actions**: AI strictly acts as a proposer; the cryptographic approval slip prevents unauthorized dispatches.
2. **Pure Deterministic Math**: All money is represented in integer minor units, preventing floating-point currency errors.
3. **Resilient AI Pipeline**: Low thinking level, bounded retries, and peer failover guarantee high availability.
4. **Authentic PayPal Sandbox**: Real OAuth tokens, Invoicing v2 resources, and signature-verified webhook processing.
5. **Zero-Dependency PDF Engine**: Pure TypeScript PDF 1.4 generator operating in serverless memory without headless Chrome.
