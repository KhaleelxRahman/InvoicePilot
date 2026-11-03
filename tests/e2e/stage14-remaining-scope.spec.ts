import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';

test.describe('Stage 14 — Remaining Pages, Controls, Webhook Viewer & Account Deletion', () => {
  test('verifies Help & FAQ, Legal & Policies, Invoice Preset Templates, Webhook Event Viewer, and Account Deletion', async ({
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
    // 1. Help & FAQ (Page 24)
    // =========================================================================
    await navigateToSection(page, 'nav-help');
    await expect(page.locator('#section-help-title')).toBeVisible();
    await expect(page.getByTestId('faq-search-input')).toBeVisible();

    // Verify FAQ accordion toggle
    const approvalFaq = page.getByTestId('faq-item-faq-approval');
    await expect(approvalFaq).toBeVisible();
    await approvalFaq.click();
    await expect(approvalFaq).toContainText('Human Approval Gate');

    // Filter FAQs via search box
    await page.getByTestId('faq-search-input').fill('minor units');
    const currencyFaq = page.getByTestId('faq-item-faq-currency');
    await expect(currencyFaq).toBeVisible();
    await currencyFaq.click();
    await expect(currencyFaq).toContainText('integer minor units');

    // Clear search
    await page.getByTestId('faq-search-input').fill('');

    // =========================================================================
    // 2. Legal & Policies (Page 25)
    // =========================================================================
    await navigateToSection(page, 'nav-policies');
    await expect(page.locator('#section-policies-title')).toBeVisible();

    // Terms of Service
    await page.getByTestId('policy-tab-terms').click();
    await expect(page.getByTestId('policy-content-terms')).toBeVisible();
    await expect(page.getByTestId('policy-content-terms')).toContainText('Terms of Service');

    // Privacy Policy
    await page.getByTestId('policy-tab-privacy').click();
    await expect(page.getByTestId('policy-content-privacy')).toBeVisible();
    await expect(page.getByTestId('policy-content-privacy')).toContainText('Privacy Policy');

    // Security & Sandbox Disclosure
    await page.getByTestId('policy-tab-security').click();
    await expect(page.getByTestId('policy-content-security')).toBeVisible();
    await expect(page.getByTestId('policy-content-security')).toContainText('PayPal Sandbox Isolation');

    // Acceptable Use Policy
    await page.getByTestId('policy-tab-aup').click();
    await expect(page.getByTestId('policy-content-aup')).toBeVisible();
    await expect(page.getByTestId('policy-content-aup')).toContainText('Acceptable Use Policy');

    // =========================================================================
    // 3. Invoice Templates & Preset Insertion in Draft Form (Page 16)
    // =========================================================================
    await navigateToSection(page, 'nav-invoices');
    await page.getByTestId('new-invoice-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();

    // Insert preset item from template dropdown
    const presetSelect = page.getByTestId('template-preset-select');
    await expect(presetSelect).toBeVisible();

    // Select the first template option
    const options = await presetSelect.locator('option').all();
    if (options.length > 1) {
      const firstVal = await options[1].getAttribute('value');
      if (firstVal) {
        await presetSelect.selectOption(firstVal);
        // Verify line item 1 description is populated
        const itemDesc0 = page.getByTestId('item-desc-0');
        await expect(itemDesc0).not.toHaveValue('');
      }
    }

    // Close invoice draft modal/form
    await page.getByTestId('cancel-invoice-form-btn').click();

    // =========================================================================
    // 4. Settings: Developer & Webhook Viewer, Data Export, Account Deletion
    // =========================================================================
    await navigateToSection(page, 'nav-settings');

    // Developer & Webhooks tab
    await page.getByTestId('settings-tab-developer').click();
    await expect(page.getByTestId('webhook-events-panel')).toBeVisible();
    await expect(page.getByTestId('dev-mode-indicator')).toBeVisible();
    await expect(page.getByTestId('refresh-webhooks-btn')).toBeVisible();

    // Privacy & Data tab
    await page.getByTestId('settings-tab-privacy').click();
    await expect(page.getByTestId('settings-export-json-btn')).toBeVisible();
    await expect(page.getByTestId('delete-account-input')).toBeVisible();
    await expect(page.getByTestId('delete-account-btn')).toBeVisible();

    // Trigger demo account reset via delete button with confirmation email
    await page.getByTestId('delete-account-input').fill('demo.freelancer@invoicepilot.local');
    await page.getByTestId('delete-account-btn').click();

    await expect(page.getByTestId('delete-account-feedback')).toBeVisible();
    await expect(page.getByTestId('delete-account-feedback')).toContainText('reset');

    // Assert zero uncaught browser console errors
    expect(consoleErrors).toEqual([]);
  });
});
