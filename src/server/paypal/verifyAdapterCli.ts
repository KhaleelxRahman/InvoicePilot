import { loadAppConfig } from '../config.js';
import { createPayPalAdapter } from './adapter.js';

async function main() {
  console.log('=== InvoicePilot Stage 03: PayPal Adapter Live Sandbox Verification ===');
  const config = loadAppConfig(process.env, { loadDotEnvFile: true });
  const adapter = createPayPalAdapter({
    mode: config.paypalMode,
    clientId: config.paypalClientId,
    clientSecret: config.paypalClientSecret,
    invoicerEmail: config.paypalInvoicerEmail,
    timeoutMs: config.paypalTimeoutMs
  });

  console.log(`Adapter Mode      : ${adapter.mode}`);
  console.log(`Adapter isMock    : ${adapter.isMock}`);
  console.log(`Adapter Label     : ${adapter.modeLabel}`);
  console.log('-----------------------------------------------------------------------');

  // 1. OAuth verification through adapter
  const oauthResult = await adapter.verifyOAuthToken();
  if (!oauthResult.ok) {
    console.error('[Adapter OAuth Failed]', JSON.stringify(oauthResult, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('[1/4] OAuth Token Verified :', JSON.stringify(oauthResult.data));

  // 2. Create draft invoice through adapter
  const invoiceNumber = `IP-ADP-${Date.now().toString().slice(-6)}`;
  const today = new Date().toISOString().slice(0, 10);
  const createResult = await adapter.createDraftInvoice({
    invoiceNumber,
    invoiceDate: today,
    currencyCode: 'USD',
    recipientEmail: config.paypalRecipientEmail,
    items: [
      {
        name: 'Stage 03 Adapter Verification Service',
        description: 'Server PayPal Adapter contract check',
        quantity: '1',
        unitAmountValue: '35.00',
        currencyCode: 'USD'
      }
    ]
  });

  if (!createResult.ok) {
    console.error('[Adapter Create Draft Failed]', JSON.stringify(createResult, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('[2/4] Draft Created        :', JSON.stringify(createResult.data));

  const providerId = createResult.data.providerInvoiceId;

  // 3. Retrieve draft invoice through adapter
  const retrieveDraftResult = await adapter.retrieveInvoice(providerId);
  if (!retrieveDraftResult.ok) {
    console.error('[Adapter Retrieve Draft Failed]', JSON.stringify(retrieveDraftResult, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('[3/4] Draft Retrieved      :', JSON.stringify(retrieveDraftResult.data));

  // 4. Send invoice through adapter (re-fetches provider status after send)
  const sendResult = await adapter.sendInvoice({
    providerInvoiceId: providerId,
    sendToRecipient: true,
    sendToInvoicer: false
  });
  if (!sendResult.ok) {
    console.error('[Adapter Send Invoice Failed]', JSON.stringify(sendResult, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log('[4/4] Invoice Sent & Synced:', JSON.stringify(sendResult.data));
  console.log('\n[Stage 03 Adapter Result] Real PayPal Sandbox lifecycle verified through adapter.');
}

main().catch((err) => {
  console.error(
    '[Stage 03 Adapter Fatal Error]',
    err instanceof Error ? err.message : 'Unknown error'
  );
  process.exitCode = 1;
});
