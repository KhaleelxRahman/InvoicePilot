import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';

test.describe('Stage 10 — Core Product Pages E2E', () => {
  test('navigates and verifies Home (Page 12), Invoices (14 & 15), Clients (17 & 18), Activity (21), Notifications (22), and Settings (23)', async ({
    page
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    // =========================================================================
    // 1. Home (Page 12)
    // =========================================================================
    await navigateToSection(page, 'nav-overview');
    const homeStatement = page.getByTestId('home-summary-statement');
    await expect(homeStatement).toBeVisible();
    await expect(homeStatement).toContainText('You are owed');

    const attentionTable = page.getByTestId('home-needs-attention-table');
    await expect(attentionTable).toBeVisible();

    // Verify aging summary has been removed from Overview to simplify the screen
    await expect(page.getByTestId('home-aging-summary')).not.toBeAttached();

    // =========================================================================
    // 2. Invoices List & Detail Paper Document (Pages 14 & 15)
    // =========================================================================
    await navigateToSection(page, 'nav-invoices');
    await expect(page.getByTestId('invoice-search-input')).toBeVisible();
    await expect(page.getByTestId('invoice-status-filter')).toBeVisible();
    await expect(page.getByTestId('invoice-sort-select')).toBeVisible();
    await expect(page.getByTestId('export-invoices-csv-btn')).toBeVisible();

    // Verify CSV export click doesn't crash
    const [downloadCsv] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      page.getByTestId('export-invoices-csv-btn').click()
    ]);
    if (downloadCsv) {
      expect(downloadCsv.suggestedFilename()).toContain('.csv');
    }

    // View detail of first invoice
    const firstViewDetailBtn = page.locator('button[data-testid^="view-invoice-"]').first();
    await expect(firstViewDetailBtn).toBeVisible();
    await firstViewDetailBtn.click();

    // Verify Page 15: Document preview with timeline & duplicate button
    await expect(page.getByTestId('invoice-detail-panel')).toBeVisible();
    await expect(page.getByTestId('invoice-timeline')).toBeVisible();
    await expect(page.getByTestId('duplicate-invoice-btn')).toBeVisible();
    await expect(page.getByTestId('back-to-invoices-btn')).toBeVisible();

    // Verify operational completion workflow
    const markCompletedBtn = page.getByTestId('mark-completed-btn');
    if (await markCompletedBtn.isVisible()) {
      await markCompletedBtn.click();
      await expect(page.getByTestId('confirm-complete-dialog')).toBeVisible();
      await page.getByTestId('confirm-mark-completed-btn').click();
      await expect(page.getByTestId('complete-invoice-feedback')).toBeVisible();
      await expect(page.getByTestId('detail-operational-status')).toContainText('COMPLETED');
    }

    // Test duplicate invoice draft flow
    await page.getByTestId('duplicate-invoice-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();
    await expect(page.getByTestId('invoice-feedback-banner')).toContainText('Duplicated invoice');
    await page.getByTestId('cancel-invoice-form-btn').click();

    // =========================================================================
    // 3. Clients Directory & Client Profile (Pages 17 & 18)
    // =========================================================================
    await navigateToSection(page, 'nav-clients');
    await expect(page.getByTestId('client-search-input')).toBeVisible();
    await expect(page.getByTestId('clients-table')).toBeVisible();

    // View client profile
    const firstProfileBtn = page.locator('button[data-testid^="view-client-profile-btn-"]').first();
    await expect(firstProfileBtn).toBeVisible();
    await firstProfileBtn.click();

    // Verify Page 18: Profile record with financial metrics & reliability badge
    await expect(page.getByTestId('client-detail-panel')).toBeVisible();
    await expect(page.getByTestId('client-reliability-badge')).toBeVisible();
    await expect(page.getByTestId('client-metric-billed')).toBeVisible();
    await expect(page.getByTestId('client-metric-paid')).toBeVisible();
    await expect(page.getByTestId('client-metric-outstanding')).toBeVisible();
    await expect(page.getByTestId('client-draft-invoice-btn')).toBeVisible();
    await expect(page.getByTestId('back-to-clients-btn')).toBeVisible();

    await page.getByTestId('back-to-clients-btn').click();
    await expect(page.getByTestId('client-detail-panel')).toBeHidden();

    // =========================================================================
    // 4. Activity Log (Page 21)
    // =========================================================================
    await navigateToSection(page, 'nav-activity');
    await expect(page.getByTestId('activity-search-input')).toBeVisible();
    await expect(page.getByTestId('activity-result-filter')).toBeVisible();
    await expect(page.getByTestId('export-activity-csv-btn')).toBeVisible();

    // Test filter
    await page.getByTestId('activity-result-filter').selectOption('EXECUTED');
    await expect(page.getByTestId('activity-table')).toBeVisible();

    // =========================================================================
    // 5. Notifications (Page 22)
    // =========================================================================
    await navigateToSection(page, 'nav-notifications');
    await expect(page.getByTestId('notif-filter-all')).toBeVisible();
    await expect(page.getByTestId('notif-filter-unread')).toBeVisible();
    await expect(page.getByTestId('mark-all-read-btn')).toBeVisible();

    // If notifications exist, mark all as read
    const notifCards = page.locator('div[data-testid^="notification-card-"]');
    const cardCount = await notifCards.count();
    if (cardCount > 0) {
      await page.getByTestId('mark-all-read-btn').click();
      await page.getByTestId('notif-filter-unread').click();
      await expect(page.getByText('No unread notifications.')).toBeVisible();
    }

    // =========================================================================
    // 6. Settings (Page 23)
    // =========================================================================
    await navigateToSection(page, 'nav-settings');
    await expect(page.getByTestId('settings-tab-business')).toBeVisible();
    await expect(page.getByTestId('settings-tab-paypal')).toBeVisible();
    await expect(page.getByTestId('settings-tab-agent')).toBeVisible();
    await expect(page.getByTestId('settings-tab-appearance')).toBeVisible();
    await expect(page.getByTestId('settings-tab-privacy')).toBeVisible();

    // Tab 1: Business details update
    await page.getByTestId('settings-business-name-input').fill('Updated Advisory Studio LLC');
    await page.getByTestId('save-business-settings-btn').click();
    await expect(page.getByTestId('settings-feedback-banner')).toContainText(
      'Business settings saved successfully.'
    );

    // Tab 2: PayPal connection
    await page.getByTestId('settings-tab-paypal').click();
    await expect(page.getByTestId('settings-paypal-status')).toBeVisible();
    await page.getByTestId('settings-test-paypal-btn').click();
    await expect(page.getByTestId('settings-feedback-banner')).toContainText(
      'PayPal Sandbox connection tested successfully'
    );

    // Tab 3: Agent & safety limits
    await page.getByTestId('settings-tab-agent').click();
    await page.getByTestId('settings-max-amount-input').fill('25000');
    await page.getByTestId('save-agent-settings-btn').click();
    await expect(page.getByTestId('settings-feedback-banner')).toContainText(
      'Agent safety limits updated.'
    );

    // Tab 4: Appearance
    await page.getByTestId('settings-tab-appearance').click();
    await page.getByTestId('theme-dark-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('theme-light-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    // Tab 5: Data & Privacy
    await page.getByTestId('settings-tab-privacy').click();
    await expect(page.getByTestId('settings-export-json-btn')).toBeVisible();

    const [downloadJson] = await Promise.all([
      page.waitForEvent('download').catch(() => null),
      page.getByTestId('settings-export-json-btn').click()
    ]);
    if (downloadJson) {
      expect(downloadJson.suggestedFilename()).toContain('.json');
    }

    // Ensure no unexpected console errors occurred during the test run
    expect(consoleErrors).toEqual([]);
  });
});
