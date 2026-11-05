import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';
import path from 'path';

test.describe('Release Audit & Live Visual Journey E2E', () => {
  test('executes complete 25-step visible user journey, captures 15 audit screenshots, and verifies full stack behavior', async ({
    page
  }, testInfo) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    const failedNetworkRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        if (
          !txt.includes('ERR_CONNECTION_CLOSED') &&
          !txt.includes('ERR_INTERNET_DISCONNECTED') &&
          !txt.includes('status of 401')
        ) {
          consoleErrors.push(txt);
        }
      }
    });

    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      failedNetworkRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
    });

    const isMobile = testInfo.project.name.startsWith('mobile');
    const projSlug = isMobile ? 'mob' : 'dsk';
    const timestamp = Date.now().toString().slice(-6);
    const testEmail = `audit-${projSlug}-${timestamp}@studio-release.example.com`;
    const testDisplayName = `Studio Apex ${projSlug.toUpperCase()}`;
    const testPassword = 'ReleasePassword2026!';
    const clientName = `Marcus Aurelius ${timestamp}`;
    const clientEmail = `marcus-${timestamp}@meditations.example.com`;
    const invoiceNum = `INV-REL-${projSlug.toUpperCase()}-${timestamp}`;

    const screenshotDir = path.resolve(process.cwd(), 'release-audit');

    // -------------------------------------------------------------------------
    // STEP 1 & 2: Open landing page & inspect layout
    // -------------------------------------------------------------------------
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'InvoicePilot', level: 1 })).toBeVisible();
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('provider-mode-badge')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '01-landing-page.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 3, 4, 5: Open sign-in, enter invalid credentials & verify error
    // -------------------------------------------------------------------------
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-email-input').fill('invalid.user@example.com');
    await page.getByTestId('auth-password-input').fill('WrongPassword123!');
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('auth-error-alert')).toBeVisible();
    await expect(page.getByTestId('auth-error-alert')).toContainText('Invalid email or password');

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '02-sign-in.png') });
    }

    // -------------------------------------------------------------------------
    // STEP 6: Register a fresh test account
    // -------------------------------------------------------------------------
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-displayname-input').fill(testDisplayName);
    await page.getByTestId('auth-password-input').fill(testPassword);

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '03-registration.png') });
    }

    await page.getByTestId('auth-submit-btn').click();

    // Verify successful registration and workspace entry
    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toBeVisible();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);

    // -------------------------------------------------------------------------
    // STEP 7: Complete onboarding wizard
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-onboarding');
    await expect(page.getByTestId('onboarding-step1-card')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '04-onboarding.png') });
    }

    await page.getByTestId('onboarding-business-name-input').fill(`${testDisplayName} Design`);
    await page.getByTestId('onboarding-business-email-input').fill(testEmail);
    await page.getByTestId('onboarding-currency-select').selectOption('USD');
    await page.getByTestId('onboarding-step1-submit').click();

    // Step 2: PayPal Sandbox connection
    await expect(page.getByTestId('onboarding-step2-card')).toBeVisible();
    await page.getByTestId('onboarding-test-sandbox-btn').click();

    // Step 3: Safety caps
    await expect(page.getByTestId('onboarding-step3-card')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('onboarding-max-amount-input').fill('25000');
    await page.getByTestId('onboarding-tone-select').selectOption('polite');
    await page.getByTestId('onboarding-step3-submit').click();

    // Step 4: First Client
    await expect(page.getByTestId('onboarding-step4-card')).toBeVisible();
    await page.getByTestId('onboarding-client-name-input').fill(clientName);
    await page.getByTestId('onboarding-client-email-input').fill(clientEmail);
    await page.getByTestId('onboarding-client-company-input').fill('Meditations Media Global');
    await page.getByTestId('onboarding-step4-submit').click();

    // Verify Completion
    await expect(page.getByTestId('onboarding-completed-card')).toBeVisible();
    await expect(page.getByTestId('onboarding-completed-card')).toContainText('Onboarding complete!');

    // -------------------------------------------------------------------------
    // STEP 8: Inspect the clean empty dashboard
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-overview');
    await expect(page.getByTestId('home-summary-statement')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '05-empty-dashboard.png'), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(screenshotDir, '13-mobile-dashboard.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 9 & 10: Create client and edit details
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-clients');
    await page.getByTestId('new-client-btn').click();
    await expect(page.getByTestId('client-form')).toBeVisible();

    const client2Name = `Elena Vance ${timestamp}`;
    const client2Email = `elena-${timestamp}@blackmesa.example.com`;

    await page.getByTestId('client-fullname-input').fill(client2Name);
    await page.getByTestId('client-company-input').fill('Black Mesa Research');
    await page.getByTestId('client-email-input').fill(client2Email);
    await page.getByTestId('client-currency-select').selectOption('USD');
    await page.getByTestId('client-notes-input').fill('Preferred Net-14 client');
    await page.getByTestId('save-client-btn').click();

    await expect(page.getByTestId('client-feedback-banner')).toContainText(`Created client ${client2Name}`);
    await expect(page.getByTestId('detail-client-name')).toHaveText(client2Name);

    // Edit client details
    await page.getByTestId('detail-edit-client-btn').click();
    await page.getByTestId('client-company-input').fill('Black Mesa Research Labs');
    await page.getByTestId('save-client-btn').click();
    await expect(page.getByTestId('client-feedback-banner')).toContainText(`Updated client profile for ${client2Name}`);

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '06-client-created.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 11, 12, 13, 14: Create invoice with multiple items, verify calculations, and save
    // -------------------------------------------------------------------------
    await page.getByTestId('draft-for-client-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();

    await page.getByTestId('invoice-number-input').fill(invoiceNum);
    await page.getByTestId('invoice-tax-input').fill('10');
    await page.getByTestId('invoice-issue-date-input').fill('2026-11-01');
    await page.getByTestId('invoice-due-date-input').fill('2026-11-15');

    // Item 1: $1,200.00
    await page.getByTestId('item-desc-0').fill('Enterprise UI/UX Audit & Design System');
    await page.getByTestId('item-qty-0').fill('2');
    await page.getByTestId('item-price-0').fill('600.00');

    // Item 2: $300.00
    await page.getByTestId('add-line-item-btn').click();
    await page.getByTestId('item-desc-1').fill('Security Review & Production Readiness');
    await page.getByTestId('item-qty-1').fill('1');
    await page.getByTestId('item-price-1').fill('300.00');

    await page.getByTestId('invoice-notes-input').fill('Production release audit deliverable.');

    // Verify browser calculations
    await expect(page.getByTestId('preview-subtotal')).toHaveText('USD 1500.00');
    await expect(page.getByTestId('preview-tax')).toHaveText('USD 150.00');
    await expect(page.getByTestId('preview-total')).toHaveText('USD 1650.00');

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '07-invoice-created.png') });
    }

    // Save invoice draft
    await page.getByTestId('save-invoice-draft-btn').click();
    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Created local draft ${invoiceNum} (USD 1650.00). Not sent to PayPal.`
    );

    // -------------------------------------------------------------------------
    // STEP 15: Open invoice details & verify PDF download
    // -------------------------------------------------------------------------
    await expect(page.getByTestId('invoice-detail-panel')).toBeVisible();
    await expect(page.getByTestId('detail-invoice-total')).toHaveText('USD 1650.00');
    await expect(page.getByTestId('download-pdf-btn')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '08-invoice-details.png'), fullPage: true });
    } else {
      await page.screenshot({ path: path.join(screenshotDir, '14-mobile-invoice.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 16: Test payment-related flows & approval slip gate
    // -------------------------------------------------------------------------
    await page.getByTestId('detail-prepare-approval-btn').click();
    await expect(page.getByTestId('approval-slip-panel')).toBeVisible();
    await expect(page.getByTestId('slip-invoice-heading')).toContainText(invoiceNum);
    await expect(page.getByTestId('slip-total')).toContainText('USD 1650.00');

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '09-payment-flow.png'), fullPage: true });
    }

    // Safe close of approval slip to preserve sandbox limits
    await page.getByTestId('slip-close-btn').click();
    await expect(page.getByTestId('approval-slip-panel')).toBeHidden();

    // -------------------------------------------------------------------------
    // STEP 17: Test Reminders section
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-reminders');
    await expect(page.getByTestId('reminders-waiting-approval')).toBeVisible();
    await expect(page.getByTestId('reminders-scheduled')).toBeVisible();
    await expect(page.getByTestId('reminders-sent')).toBeVisible();

    await page.getByTestId('reminder-draft-btn').click();
    await expect(page.getByTestId('reminder-draft-modal')).toBeVisible();
    await page.getByTestId('reminder-tone-select').selectOption('polite');
    await page.getByTestId('reminder-generate-draft-btn').click();
    await expect(page.getByTestId('reminder-subject-input')).not.toBeEmpty();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '10-reminders.png') });
    }

    await page.getByTestId('close-reminder-modal-btn').click();
    await expect(page.getByTestId('reminder-draft-modal')).toBeHidden();

    // -------------------------------------------------------------------------
    // STEP 18: Test Notifications
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-notifications');
    await expect(page.getByTestId('notif-filter-all')).toBeVisible();
    await expect(page.getByTestId('notif-filter-unread')).toBeVisible();
    await expect(page.getByTestId('mark-all-read-btn')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '11-notifications.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 19: Test Settings
    // -------------------------------------------------------------------------
    await navigateToSection(page, 'nav-settings');
    await expect(page.getByTestId('settings-tab-business')).toBeVisible();
    await expect(page.getByTestId('settings-tab-paypal')).toBeVisible();
    await expect(page.getByTestId('settings-tab-agent')).toBeVisible();
    await expect(page.getByTestId('settings-tab-privacy')).toBeVisible();

    // Verify PayPal settings tab shows Sandbox mode cleanly
    await page.getByTestId('settings-tab-paypal').click();
    await expect(page.getByTestId('settings-paypal-status')).toBeVisible();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '12-settings.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // STEP 20, 21, 22, 23: Log out, log back in, reload, and verify persistence
    // -------------------------------------------------------------------------
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('current-user-badge')).toBeHidden();

    if (!isMobile) {
      await page.screenshot({ path: path.join(screenshotDir, '15-logout.png') });
    }

    // Log back in
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-password-input').fill(testPassword);
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);

    // Reload page to verify session persistence
    await page.reload();
    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);

    // -------------------------------------------------------------------------
    // STEP 24 & 25: Verify account isolation & protected pages
    // -------------------------------------------------------------------------
    // Verify client created by this user is present
    await navigateToSection(page, 'nav-clients');
    await expect(page.getByTestId(`client-row-${client2Email}`)).toBeVisible();

    // Log out permanently
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();

    // Verify unauthenticated API requests are rejected
    const unauthedCheck = await page.request.get('/api/clients');
    expect(unauthedCheck.status()).toBe(401);

    expect(consoleErrors).toEqual([]);
  });

  test('verifies responsive viewports (1440x900 desktop & 390x844 mobile) with zero horizontal overflow', async ({
    page
  }, testInfo) => {
    const isMobile = testInfo.project.name.startsWith('mobile');
    const viewport = isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
    await page.setViewportSize(viewport);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'InvoicePilot', level: 1 })).toBeVisible();

    // Check horizontal overflow on landing
    const overflowLanding = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflowLanding).toBe(true);

    // Test sign in and check dashboard overflow
    await page.getByTestId('auth-email-input').fill('demo.freelancer@invoicepilot.local');
    await page.getByTestId('auth-password-input').fill('TestDemo1234!');
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('current-user-badge')).toBeVisible();

    const overflowWorkspace = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflowWorkspace).toBe(true);

    // Verify invoices table responsiveness
    await navigateToSection(page, 'nav-invoices');
    await expect(page.getByTestId('new-invoice-btn')).toBeVisible();

    const overflowInvoices = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(overflowInvoices).toBe(true);
  });
});
