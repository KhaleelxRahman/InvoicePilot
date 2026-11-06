import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApiApp } from '../src/server/app.js';
import { loadAppConfig } from '../src/server/config.js';
import { openAndMigrateDatabase } from '../src/server/db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from '../src/server/db/repository.js';
import { MockPayPalAdapter } from '../src/server/paypal/adapter.js';

async function main() {
  console.log('=== InvoicePilot: Inbound PayPal Webhook Lifecycle & Security Verification ===');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-wh-verify-'));
  const dbFilePath = path.join(tmpDir, 'webhook-verify.sqlite');
  const db = openAndMigrateDatabase(dbFilePath);
  const repo = new InvoicePilotRepository(db);
  const seeded = repo.resetAndSeedDemoTenant();
  const invoiceId = seeded.invoices[0].id;

  const adapter = new MockPayPalAdapter();
  const config = loadAppConfig({
    DATABASE_URL: `file:${dbFilePath}`,
    PAYPAL_MODE: 'mock',
    PAYPAL_WEBHOOK_ID: 'WH-TEST-VERIFY-ID'
  });
  const app = createApiApp(config, adapter, repo);

  try {
    // Sync an initial provider invoice ID
    repo.recordProviderInvoiceSync(DEMO_TENANT_USER_ID, invoiceId, {
      providerMode: 'mock',
      providerInvoiceId: 'MOCK-LOCAL-9999',
      providerStatus: 'SENT',
      localStatus: 'SENT'
    });

    // 1. Unverified Webhook Signature Verification
    console.log('[1/5] Testing unverified signature rejection...');
    const unverifiedRes = await request(app)
      .post('/api/webhooks/paypal')
      .set('paypal-transmission-id', 'tx-test-01')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-transmission-sig', 'FORGED-INVALID-SIGNATURE')
      .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({
        id: 'WH-EVT-01',
        event_type: 'INVOICING.INVOICE.PAID',
        resource: { invoice: { id: 'MOCK-LOCAL-9999', status: 'PAID' } }
      });

    if (unverifiedRes.status !== 400 || unverifiedRes.body?.error?.code !== 'WEBHOOK_SIGNATURE_INVALID') {
      console.error('FAIL: Expected HTTP 400 WEBHOOK_SIGNATURE_INVALID, got:', unverifiedRes.status, unverifiedRes.body);
      process.exit(1);
    }
    console.log('  -> PASSED: Unverified payload safely rejected with HTTP 400.');

    // 2. Verified PAID Webhook
    console.log('[2/5] Testing verified INVOICING.INVOICE.PAID delivery...');
    const paidRes = await request(app)
      .post('/api/webhooks/paypal')
      .set('paypal-transmission-id', 'tx-test-02')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
      .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({
        id: 'WH-EVT-PAID-01',
        event_type: 'INVOICING.INVOICE.PAID',
        resource: { invoice: { id: 'MOCK-LOCAL-9999', status: 'PAID' } }
      });

    const invAfterPaid = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, invoiceId);
    if (paidRes.status !== 200 || invAfterPaid.providerStatus !== 'PAID') {
      console.error('FAIL: Expected invoice status PAID, got:', invAfterPaid.providerStatus);
      process.exit(1);
    }
    console.log('  -> PASSED: Invoice status refreshed to PAID via verified webhook.');

    // 3. Verified CANCELLED Webhook
    console.log('[3/5] Testing verified INVOICING.INVOICE.CANCELLED delivery...');
    const cancelRes = await request(app)
      .post('/api/webhooks/paypal')
      .set('paypal-transmission-id', 'tx-test-03')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
      .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({
        id: 'WH-EVT-CANCEL-01',
        event_type: 'INVOICING.INVOICE.CANCELLED',
        resource: { invoice: { id: 'MOCK-LOCAL-9999', status: 'CANCELLED' } }
      });

    const invAfterCancel = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, invoiceId);
    if (cancelRes.status !== 200 || invAfterCancel.providerStatus !== 'CANCELLED' || invAfterCancel.localStatus !== 'CANCELLED') {
      console.error('FAIL: Expected invoice status CANCELLED, got:', invAfterCancel);
      process.exit(1);
    }
    console.log('  -> PASSED: Invoice status refreshed to CANCELLED via verified webhook.');

    // 4. Verified REFUNDED Webhook
    console.log('[4/5] Testing verified INVOICING.INVOICE.REFUNDED delivery...');
    const refundRes = await request(app)
      .post('/api/webhooks/paypal')
      .set('paypal-transmission-id', 'tx-test-04')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
      .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({
        id: 'WH-EVT-REFUND-01',
        event_type: 'INVOICING.INVOICE.REFUNDED',
        resource: { invoice: { id: 'MOCK-LOCAL-9999', status: 'REFUNDED' } }
      });

    const invAfterRefund = repo.getInvoiceForOwner(DEMO_TENANT_USER_ID, invoiceId);
    if (refundRes.status !== 200 || invAfterRefund.providerStatus !== 'REFUNDED') {
      console.error('FAIL: Expected invoice status REFUNDED, got:', invAfterRefund.providerStatus);
      process.exit(1);
    }
    console.log('  -> PASSED: Invoice status refreshed to REFUNDED via verified webhook.');

    // 5. Replay Protection / Deduplication
    console.log('[5/5] Testing duplicate webhook deduplication...');
    const duplicateRes = await request(app)
      .post('/api/webhooks/paypal')
      .set('paypal-transmission-id', 'tx-test-04')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-transmission-sig', 'MOCK-VERIFIED-SIGNATURE')
      .set('paypal-cert-url', 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .send({
        id: 'WH-EVT-REFUND-01',
        event_type: 'INVOICING.INVOICE.REFUNDED',
        resource: { invoice: { id: 'MOCK-LOCAL-9999', status: 'REFUNDED' } }
      });

    if (duplicateRes.status !== 200 || duplicateRes.body?.deduplicated !== true) {
      console.error('FAIL: Expected deduplicated: true, got:', duplicateRes.body);
      process.exit(1);
    }
    console.log('  -> PASSED: Replay attack/duplicate delivery idempotently deduplicated.');

    console.log('\n[Webhook Verification] All 5 webhook lifecycle & security checks PASSED.');
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main();

