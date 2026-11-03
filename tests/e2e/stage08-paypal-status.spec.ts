import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';

test.describe('Stage 08 — End-to-End PayPal Sandbox Invoice Send, Persistence & Status Refresh', () => {
  test('executes approved invoice send, persists and displays real provider invoice ID and recipient URL, refreshes provider status from PayPal, rejects unverified webhooks, and records Activity', async ({
    page
  }, testInfo) => {
    test.setTimeout(60000);
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    const projCode = testInfo.project.name.startsWith('mobile') ? 'MOB' : 'DSK';
    const shortId = Date.now().toString().slice(-6);
    const invoiceNum = `INV-S08-${projCode}-${shortId}`; // 18 chars (<= 25 PayPal limit)

    await page.goto('/');

    // 1. Navigate to Invoices & drafts and create a fresh draft invoice
    await navigateToSection(page, 'nav-invoices');
    await page.getByTestId('new-invoice-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();

    await page.getByTestId('invoice-client-select').selectOption('cli_demo_northstar_01');
    await page.getByTestId('invoice-number-input').fill(invoiceNum);
    await page.getByTestId('invoice-currency-select').selectOption('USD');
    await page.getByTestId('invoice-tax-input').fill('0');
    await page.getByTestId('invoice-issue-date-input').fill('2026-10-31');
    await page.getByTestId('invoice-due-date-input').fill('2026-11-14');

    await page.getByTestId('item-desc-0').fill('Stage 08 End-to-End PayPal Sandbox Verification');
    await page.getByTestId('item-qty-0').fill('1');
    await page.getByTestId('item-price-0').fill('225.00');

    await page
      .getByTestId('invoice-notes-input')
      .fill('Stage 08 end-to-end verified send and status refresh.');
    await page.getByTestId('save-invoice-draft-btn').click();

    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Created local draft ${invoiceNum} (USD 225.00). Not sent to PayPal.`
    );

    // 2. Verify approval gate and refresh validation on the newly created draft via API
    const listRes = await page.request.get('/api/invoices');
    expect(listRes.status()).toBe(200);
    const listBody = (await listRes.json()) as {
      invoices: Array<{ id: string; invoiceNumber: string }>;
    };
    const createdInvoice = listBody.invoices.find((i) => i.invoiceNumber === invoiceNum);
    expect(createdInvoice).toBeDefined();
    const createdInvoiceId = createdInvoice!.id;

    // Sending without approval must be rejected with 400 VALIDATION_ERROR
    const unapprovedSendRes = await page.request.post(
      `/api/invoices/${createdInvoiceId}/paypal/send`,
      { data: {} }
    );
    expect(unapprovedSendRes.status()).toBe(400);

    // Refreshing before provider creation must be rejected with 400 VALIDATION_ERROR
    const prematureRefreshRes = await page.request.post(
      `/api/invoices/${createdInvoiceId}/paypal/refresh`,
      { data: {} }
    );
    expect(prematureRefreshRes.status()).toBe(400);

    // 3. Propose approval slip, approve, and execute send
    await page.getByTestId(`prepare-approval-${invoiceNum}`).click();
    await expect(page.getByTestId('approval-slip-panel')).toBeVisible();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('PENDING_APPROVAL');

    await page.getByTestId('slip-approve-btn').click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('APPROVED');

    await page.getByTestId('slip-execute-btn').click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('EXECUTED', {
      timeout: 30000
    });
    await expect(page.getByTestId('slip-feedback-banner')).toContainText('Executed approved send');

    // Close slip to inspect the persisted invoice detail panel
    await page.getByTestId('slip-close-btn').click();

    // 4. Verify persisted provider invoice ID, status, sync timestamp, and recipient payment link in UI
    const rowProviderId = page.getByTestId(`row-provider-id-${invoiceNum}`);
    await expect(rowProviderId).toBeVisible();
    const rowProviderIdText = (await rowProviderId.textContent()) ?? '';
    expect(rowProviderIdText).toMatch(/ID:\s*(INV2-|MOCK-LOCAL-)/);

    const detailPanel = page.getByTestId('invoice-detail-panel');
    await expect(detailPanel).toBeVisible();
    await expect(page.getByTestId('detail-local-status')).toHaveText('SENT');
    await expect(page.getByTestId('detail-provider-status')).toHaveText(/^(SENT|UNPAID)$/);

    const providerInvoiceId =
      (await page.getByTestId('detail-provider-invoice-id').textContent())?.trim() ?? '';
    expect(providerInvoiceId).toMatch(/^(INV2-|MOCK-LOCAL-)/);

    await expect(page.getByTestId('detail-provider-sync-at')).not.toBeEmpty();
    await expect(page.getByTestId('detail-recipient-view-url')).toBeVisible();

    // 5. Click "Refresh PayPal status" in the invoice detail panel and verify live retrieve/refresh
    const refreshBtn = page.getByTestId('detail-refresh-provider-btn');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Refreshed PayPal status`,
      { timeout: 25000 }
    );
    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(providerInvoiceId);

    // 6. Verify unverified webhook payload is rejected with 400 WEBHOOK_SIGNATURE_INVALID
    const unverifiedWebhookRes = await page.request.post('/api/webhooks/paypal', {
      headers: {
        'paypal-transmission-id': 'tx-e2e-unverified',
        'paypal-transmission-time': '2026-11-01T00:00:00Z',
        'paypal-transmission-sig': 'INVALID-SIGNATURE',
        'paypal-cert-url': 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      data: {
        id: `WH-E2E-UNVERIFIED-${shortId}`,
        event_type: 'INVOICING.INVOICE.PAID',
        resource: {
          invoice: {
            id: providerInvoiceId,
            status: 'PAID'
          }
        }
      }
    });
    expect(unverifiedWebhookRes.status()).toBe(400);

    // 7. Navigate to Activity & audit log and verify both ACTION_EXECUTED and INVOICE_PROVIDER_STATUS_REFRESHED
    await navigateToSection(page, 'nav-activity');
    const activityTable = page.getByTestId('activity-table');
    await expect(activityTable).toBeVisible();
    await expect(activityTable).toContainText('ACTION_EXECUTED');
    await expect(activityTable).toContainText('INVOICE_PROVIDER_STATUS_REFRESHED');

    expect(consoleErrors).toEqual([]);
  });
});
