import { expect, test } from '@playwright/test';

test.describe('Professional Sign-In & First-Run Experience E2E', () => {
  test('verifies logged-out start page, invalid login error, registration, workspace entry, logout, returning sign-in, reload persistence, and demo exploration', async ({
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
    const testEmail = `freelancer-${uniqueSuffix}@consultancy.example.com`;
    const testDisplayName = `Studio North ${uniqueSuffix}`;
    const testPassword = 'SecurePassword2026!';

    // 1. Initial fresh load without session -> Must show Start Page (NOT automatically demo)
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'InvoicePilot', level: 1 })).toBeVisible();
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('provider-mode-badge')).toBeVisible();
    await expect(page.getByTestId('enter-demo-btn')).toBeVisible();
    await expect(page.getByTestId('health-status-value')).toBeVisible();

    // Verify workspace elements are NOT visible while logged out
    await expect(page.getByTestId('current-user-badge')).toBeHidden();
    await expect(page.locator('#main-workspace')).toBeHidden();

    // Direct API unauthenticated protection verification (while logged out)
    const unauthedRes = await page.request.get('/api/clients');
    expect(unauthedRes.status()).toBe(401);

    // 2. Attempt login with invalid credentials -> Expect error alert
    await page.getByTestId('auth-email-input').fill('nonexistent@example.com');
    await page.getByTestId('auth-password-input').fill('WrongPassword123');
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('auth-error-alert')).toBeVisible();
    await expect(page.getByTestId('auth-error-alert')).toContainText('Invalid email or password');
    // Ensure still on start page
    await expect(page.locator('#main-workspace')).toBeHidden();

    // 3. Register a fresh new account
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-displayname-input').fill(testDisplayName);
    await page.getByTestId('auth-password-input').fill(testPassword);
    await page.getByTestId('auth-submit-btn').click();

    // 4. Verify user enters the workspace
    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toBeVisible();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);
    await expect(page.getByTestId('logout-btn')).toBeVisible();
    // Real user should NOT have demo reset button
    await expect(page.getByTestId('reset-demo-btn')).toBeHidden();

    // 5. Test real Logout flow -> Ends session and returns to start page
    await page.getByTestId('logout-btn').click();

    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('current-user-badge')).toBeHidden();
    await expect(page.locator('#main-workspace')).toBeHidden();

    // 6. Test returning user Sign In with created credentials
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-password-input').fill(testPassword);
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);

    // 7. Verify session persistence on page reload
    await page.reload();
    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toContainText(testDisplayName);

    // 8. Log out again
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();

    // 9. Test explicit Demo workspace entry from Start Page
    await page.getByTestId('enter-demo-btn').click();

    // Verify enters demo workspace
    await expect(page.getByTestId('auth-card')).toBeHidden();
    const demoBadge = page.getByTestId('current-user-badge');
    await expect(demoBadge).toBeVisible();
    await expect(demoBadge).toContainText('Demo Workspace');
    await expect(page.getByTestId('reset-demo-btn')).toBeVisible();

    // 10. Demo session can access protected API, and logout clears access
    const demoApiRes = await page.request.get('/api/clients');
    expect(demoApiRes.status()).toBe(200);

    // Logout clears session cookie
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();

    const loggedOutApiRes = await page.request.get('/api/clients');
    expect(loggedOutApiRes.status()).toBe(401);

    // Filter non-fatal 401s
    const fatalErrors = consoleErrors.filter(
      (err) => !err.includes('status of 401') && !err.includes('401 (Unauthorized)')
    );
    expect(fatalErrors).toEqual([]);
  });
});
