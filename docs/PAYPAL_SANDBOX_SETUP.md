# INVOICEPILOT — PAYPAL SANDBOX SETUP & CONFIGURATION GUIDE

This document provides exact, step-by-step instructions for setting up and connecting PayPal Sandbox to InvoicePilot.

---

## 1. Prerequisites

1. A PayPal Developer Account at [developer.paypal.com](https://developer.paypal.com).
2. Access to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).

---

## 2. Step-by-Step Configuration

### Step 1: Create or Inspect Sandbox Accounts
1. Log into [developer.paypal.com](https://developer.paypal.com).
2. Go to **Testing Tools** -> **Sandbox Accounts**.
3. Confirm you have:
   - **Business Account (Seller)**: Used as the invoicer merchant (e.g., `sb-seller@business.example.com`).
   - **Personal Account (Buyer)**: Used to log into PayPal checkout and pay invoices (e.g., `sb-buyer@personal.example.com`).
4. Note down the buyer account email and system-generated password for the demo walkthrough.

---

### Step 2: Create a REST API App
1. Go to **Apps & Credentials** in the Developer Dashboard.
2. Toggle the switch at the top to **Sandbox**.
3. Click **Create App**:
   - **App Name**: `InvoicePilot Sandbox App`
   - **App Type**: `Merchant`
   - **Sandbox Business Account**: Select your Business account from Step 1.
4. Click **Create App**.

---

### Step 3: Copy Sandbox API Credentials
On the app details page:
1. Copy the **Client ID** (e.g., `A...`).
2. Click **Show** under Secret and copy the **Client Secret**.
3. **DO NOT commit or share these credentials publicly.**

---

### Step 4: Register the Webhook
1. Scroll down to the **Webhooks** section on the app page and click **Add Webhook**.
2. **Webhook URL**:
   ```text
   https://invoicepilot-beryl.vercel.app/api/webhooks/paypal
   ```
   *(For local testing with ngrok: `https://<your-subdomain>.ngrok-free.app/api/webhooks/paypal`)*
3. **Event Types**: Select the following Invoicing events:
   - `Invoicing invoice created` (`INVOICING.INVOICE.CREATED`)
   - `Invoicing invoice sent` (`INVOICING.INVOICE.SENT`)
   - `Invoicing invoice paid` (`INVOICING.INVOICE.PAID`)
   - `Invoicing invoice cancelled` (`INVOICING.INVOICE.CANCELLED`)
   - `Invoicing invoice refunded` (`INVOICING.INVOICE.REFUNDED`)
4. Click **Save**.
5. Copy the generated **Webhook ID** (e.g., `9AB...`).

---

### Step 5: Configure Environment Variables in Vercel
1. Open your Vercel Project Dashboard for `invoicepilot`.
2. Go to **Settings** -> **Environment Variables**.
3. Ensure the following environment variables are set for the **Production** environment:

| Variable Name | Value | Purpose |
|---|---|---|
| `PAYPAL_MODE` | `sandbox` | Forces Sandbox endpoints (never live money) |
| `PAYPAL_CLIENT_ID` | `<Your Sandbox Client ID>` | OAuth authentication |
| `PAYPAL_CLIENT_SECRET` | `<Your Sandbox Client Secret>` | OAuth authentication |
| `PAYPAL_WEBHOOK_ID` | `<Your Webhook ID>` | Signature verification |
| `PAYPAL_INVOICER_EMAIL` | `<Your Sandbox Business Email>` | Invoicer contact email |

4. Redeploy or trigger a new build so Vercel loads the updated secrets.

---

## 3. Verifying Setup in InvoicePilot

1. Visit `https://invoicepilot-beryl.vercel.app/api/health`.
2. Verify the JSON response contains:
   ```json
   {
     "status": "ok",
     "paypalMode": "sandbox",
     "isMock": false,
     "modeLabel": "PayPal Sandbox Mode (No Live Money)",
     "sandboxCredentialsConfigured": true,
     "webhookConfigured": true
   }
   ```
3. If both `sandboxCredentialsConfigured` and `webhookConfigured` are `true`, the PayPal Sandbox setup is complete and active!
