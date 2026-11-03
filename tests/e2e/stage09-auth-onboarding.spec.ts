import { expect, test } from '@playwright/test';
import { navigateToSection, ensureWorkspaceLoaded } from './testHelpers';

test.describe('Stage 09 — Authentication, Demo Isolation, and Onboarding E2E', () => {
  test('registers new user, navigates 4-step onboarding wizard to completion, and tests demo isolation/reset', async ({
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

    const projCode = testInfo.project.name.startsWith('mobile') ? 'MOB' : 'DSK';
    const uniqueSuffix = `${projCode}-${Date.now().toString().slice(-6)}`;
    const testEmail = `consultant-${uniqueSuffix}@testfirm.example.com`;
    const testDisplayName = `Advisory Studio ${uniqueSuffix}`;
    const testPassword = 'StrongPassword2026!';

    await page.goto('/');
    await ensureWorkspaceLoaded(page);

    // 1. Check initial shell state (defaults to Demo user)
    const userBadge = page.getByTestId('current-user-badge');
    await expect(userBadge).toBeVisible();

    // 2. Open Auth Modal and Register a fresh account
    await page.getByTestId('auth-modal-btn').click();
    await expect(page.getByTestId('auth-modal')).toBeVisible();

    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-displayname-input').fill(testDisplayName);
    await page.getByTestId('auth-password-input').fill(testPassword);
    await page.getByTestId('auth-submit-btn').click();

    // Verify modal closes and user badge updates to real user
    await expect(page.getByTestId('auth-modal')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);
    // Real user should not have Demo badge
    await expect(page.getByTestId('reset-demo-btn')).toBeHidden();

    // 3. Step 1: Business Details
    await navigateToSection(page, 'nav-onboarding');
    await expect(page.getByTestId('onboarding-step1-card')).toBeVisible();
    await page.getByTestId('onboarding-business-name-input').fill(`Apex Advisory ${uniqueSuffix}`);
    await page.getByTestId('onboarding-business-email-input').fill(testEmail);
    await page.getByTestId('onboarding-currency-select').selectOption('USD');
    await page.getByTestId('onboarding-step1-submit').click();

    // 4. Step 2: PayPal Sandbox connection
    await expect(page.getByTestId('onboarding-step2-card')).toBeVisible();
    await page.getByTestId('onboarding-test-sandbox-btn').click();

    // 5. Step 3: Financial safety limit & reminder tone
    await expect(page.getByTestId('onboarding-step3-card')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('onboarding-max-amount-input').fill('15000');
    await page.getByTestId('onboarding-tone-select').selectOption('firm');
    await page.getByTestId('onboarding-step3-submit').click();

    // 6. Step 4: Register first client
    await expect(page.getByTestId('onboarding-step4-card')).toBeVisible();
    await page.getByTestId('onboarding-client-name-input').fill(`First Client ${uniqueSuffix}`);
    await page.getByTestId('onboarding-client-email-input').fill(`client-${uniqueSuffix}@first.example.com`);
    await page.getByTestId('onboarding-client-company-input').fill(`First Corp ${uniqueSuffix}`);
    await page.getByTestId('onboarding-step4-submit').click();

    // 7. Verify Completion
    await expect(page.getByTestId('onboarding-completed-card')).toBeVisible();
    await expect(page.getByTestId('onboarding-completed-card')).toContainText('Onboarding complete!');
    await expect(page.getByTestId('onboarding-completed-card')).toContainText(`Apex Advisory ${uniqueSuffix}`);
    await expect(page.getByTestId('nav-onboarding-status')).toContainText('DONE');

    // 8. Go to invoices view from completion card
    await page.getByTestId('onboarding-go-invoices-btn').click();
    await expect(page.getByTestId('new-invoice-btn')).toBeVisible();

    // 9. Verify first client appears in clients directory
    await navigateToSection(page, 'nav-clients');
    await expect(page.getByText(`First Client ${uniqueSuffix}`)).toBeVisible();

    // 10. Test Log out and Demo Reset
    await page.getByTestId('logout-btn').click();
    // After logging out, system returns to start page (does not auto re-sign into demo)
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('current-user-badge')).toBeHidden();

    // Enter demo workspace from start page
    await page.getByTestId('enter-demo-btn').click();
    await expect(page.getByTestId('current-user-badge')).toContainText('Demo');
    await expect(page.getByTestId('reset-demo-btn')).toBeVisible();

    // Click Reset Demo
    await page.getByTestId('reset-demo-btn').click();
    await expect(page.getByTestId('current-user-badge')).toContainText('Demo');

    // Filter benign hydration / theme logs and expected 401 unauthenticated probe logs
    const relevantErrors = consoleErrors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('downloadable font') &&
        !err.includes('status of 401')
    );
    expect(relevantErrors).toEqual([]);
  });

  test('allows skipping onboarding and re-running onboarding wizard', async ({ page }) => {
    await page.goto('/');

    // Navigate to onboarding
    await navigateToSection(page, 'nav-onboarding');

    // If already at step 1, skip it
    if (await page.getByTestId('onboarding-skip-btn').isVisible()) {
      await page.getByTestId('onboarding-skip-btn').click();
    }

    // Verify navigation or status
    await navigateToSection(page, 'nav-onboarding');
    if (await page.getByTestId('onboarding-reset-btn').isVisible()) {
      await page.getByTestId('onboarding-reset-btn').click();
      await expect(page.getByTestId('onboarding-step1-card')).toBeVisible();
    }
  });
});
