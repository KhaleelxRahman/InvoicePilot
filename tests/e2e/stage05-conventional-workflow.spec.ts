import { expect, test } from '@playwright/test';

test.describe('Stage 05 — Clients and Conventional Invoice Draft Workflow', () => {
  test('creates & edits client, validates invalid draft input, persists & reloads multi-item invoice draft, and edits draft without sending to PayPal', async ({
    page
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    const projectSlug = testInfo.project.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const runSuffix = `${projectSlug}-${Date.now()}`;
    const clientEmail = `maya.${runSuffix}@studiolin.example.com`;
    const invoiceNum = `INV-S05-${runSuffix.toUpperCase()}`;

    await page.goto('/');

    // 1. Navigate to Clients directory and create a new client
    await page.getByTestId('nav-clients').click();
    await expect(
      page.getByRole('heading', { name: 'Clients directory & profile management' })
    ).toBeVisible();

    await page.getByTestId('new-client-btn').click();
    await expect(page.getByTestId('client-form')).toBeVisible();

    // Verify client validation error on empty submit
    await page.getByTestId('save-client-btn').click();
    await expect(page.getByTestId('client-form-error')).toContainText(
      'Client full name and a valid email address are required'
    );

    // Fill valid client details and save
    await page.getByTestId('client-fullname-input').fill('Maya Lin');
    await page.getByTestId('client-company-input').fill('Studio Lin Architecture');
    await page.getByTestId('client-email-input').fill(clientEmail);
    await page.getByTestId('client-currency-select').selectOption('USD');
    await page.getByTestId('client-notes-input').fill('Prefers Net-14 itemized milestones');
    await page.getByTestId('save-client-btn').click();

    await expect(page.getByTestId('client-feedback-banner')).toContainText('Created client Maya Lin');
    await expect(page.getByTestId('client-detail-panel')).toBeVisible();
    await expect(page.getByTestId('detail-client-name')).toHaveText('Maya Lin');

    // Edit client profile and verify update
    await page.getByTestId('detail-edit-client-btn').click();
    await page.getByTestId('client-company-input').fill('Studio Lin Civic Works');
    await page.getByTestId('save-client-btn').click();
    await expect(page.getByTestId('client-feedback-banner')).toContainText(
      'Updated client profile for Maya Lin'
    );
    await expect(page.getByTestId('detail-client-meta')).toContainText('Studio Lin Civic Works');

    // 2. Start a conventional invoice draft for this client
    await page.getByTestId('draft-for-client-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();
    await expect(page.getByTestId('invoice-paper-preview')).toBeVisible();

    await page.getByTestId('invoice-number-input').fill(invoiceNum);
    await page.getByTestId('invoice-tax-input').fill('10');

    // Test invalid date ordering (due date before issue date) -> UI validation blocks submit cleanly
    await page.getByTestId('invoice-issue-date-input').fill('2026-11-20');
    await page.getByTestId('invoice-due-date-input').fill('2026-11-05');
    await page.getByTestId('save-invoice-draft-btn').click();
    await expect(page.getByTestId('invoice-form-error')).toContainText(
      'Due date must be on or after the issue date'
    );

    // Also verify direct API server rejection when bypassing UI validation
    const badServerRes = await page.request.post('/api/invoices', {
      data: {
        clientId: 'cli_demo_northstar_01',
        invoiceNumber: `${invoiceNum}-BAD`,
        currencyCode: 'USD',
        issueDate: '2026-11-20',
        dueDate: '2026-11-05',
        items: [{ description: 'Test', quantity: 1, unitPriceDecimal: '100.00' }]
      }
    });
    expect(badServerRes.status()).toBe(400);

    // Fix dates and configure 2 line items
    await page.getByTestId('invoice-issue-date-input').fill('2026-10-31');
    await page.getByTestId('invoice-due-date-input').fill('2026-11-14');

    await page.getByTestId('item-desc-0').fill('Architectural ledger audit');
    await page.getByTestId('item-qty-0').fill('2');
    await page.getByTestId('item-price-0').fill('600.00'); // $1,200.00

    await page.getByTestId('add-line-item-btn').click();
    await page.getByTestId('item-desc-1').fill('Design token specification');
    await page.getByTestId('item-qty-1').fill('1');
    await page.getByTestId('item-price-1').fill('300.00'); // $300.00

    await page.getByTestId('invoice-notes-input').fill('Stage 05 conventional draft');

    // Verify browser preview totals before saving ($1,500.00 subtotal + $150.00 tax = $1,650.00)
    await expect(page.getByTestId('preview-subtotal')).toHaveText('USD 1500.00');
    await expect(page.getByTestId('preview-tax')).toHaveText('USD 150.00');
    await expect(page.getByTestId('preview-total')).toHaveText('USD 1650.00');

    // Save local draft
    await page.getByTestId('save-invoice-draft-btn').click();
    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Created local draft ${invoiceNum} (USD 1650.00). Not sent to PayPal.`
    );

    // Verify persisted detail panel shows authoritative server values and DRAFT / NONE statuses
    await expect(page.getByTestId('invoice-detail-panel')).toBeVisible();
    await expect(page.getByTestId('detail-local-status')).toHaveText('DRAFT');
    await expect(page.getByTestId('detail-provider-status')).toHaveText('NONE');
    await expect(page.getByTestId('detail-invoice-subtotal')).toHaveText('USD 1500.00');
    await expect(page.getByTestId('detail-invoice-tax')).toHaveText('USD 150.00');
    await expect(page.getByTestId('detail-invoice-total')).toHaveText('USD 1650.00');

    // 3. Reload page to verify SQLite persistence across browser reload
    await page.reload();
    await page.getByTestId('nav-invoices').click();
    await expect(page.getByTestId(`invoice-row-${invoiceNum}`)).toBeVisible();

    // 4. Edit the persisted draft and verify server recalculation
    await page.getByTestId(`edit-invoice-${invoiceNum}`).click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();
    await page.getByTestId('item-qty-0').fill('3'); // 3 * $600 = $1,800 + $300 = $2,100 subtotal + 10% ($210) = $2,310.00
    await page.getByTestId('save-invoice-draft-btn').click();

    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Saved updated draft ${invoiceNum} (USD 2310.00). Not sent to PayPal.`
    );
    await expect(page.getByTestId('detail-invoice-total')).toHaveText('USD 2310.00');
    await expect(page.getByTestId('detail-local-status')).toHaveText('DRAFT');
    await expect(page.getByTestId('detail-provider-status')).toHaveText('NONE');

    // 5. Verify no horizontal overflow at current viewport (desktop 1280px or mobile 360px)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 6. Verify zero console or page errors
    expect(consoleErrors).toEqual([]);
  });

  test('renders explicit empty states and error alerts when clients or invoices are empty or fail to load', async ({
    page
  }) => {
    let mode: 'empty' | 'error' = 'empty';

    await page.route('**/api/clients', async (route) => {
      if (mode === 'empty') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ clients: [] })
        });
      } else {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Simulated clients directory failure.',
              requestId: 'req-test-err'
            }
          })
        });
      }
    });

    await page.route('**/api/invoices', async (route) => {
      if (mode === 'empty') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ invoices: [] })
        });
      } else {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Simulated invoices ledger failure.',
              requestId: 'req-test-err'
            }
          })
        });
      }
    });

    await page.goto('/');

    // 1. Verify empty states on both Invoices and Clients sections
    await page.getByTestId('nav-invoices').click();
    await expect(page.getByTestId('invoices-empty-state')).toBeVisible();
    await expect(page.getByTestId('invoices-empty-state')).toContainText(
      'No invoices found for this workspace'
    );

    await page.getByTestId('nav-clients').click();
    await expect(page.getByTestId('clients-empty-state')).toBeVisible();
    await expect(page.getByTestId('clients-empty-state')).toContainText('No clients saved yet');

    // 2. Switch to error mode and verify accessible error alerts
    mode = 'error';
    await page.getByTestId('refresh-clients-btn').click();
    await expect(page.getByTestId('clients-error-alert')).toBeVisible();
    await expect(page.getByTestId('clients-error-alert')).toContainText(
      'Simulated clients directory failure.'
    );

    await page.getByTestId('nav-invoices').click();
    await page.getByTestId('refresh-invoices-btn').click();
    await expect(page.getByTestId('invoices-error-alert')).toBeVisible();
    await expect(page.getByTestId('invoices-error-alert')).toContainText(
      'Simulated invoices ledger failure.'
    );
  });
});
