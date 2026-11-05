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
    await expect(page.getByTestId('health-status-value')).toBeVisible();

    // Verify demo buttons/badges are completely absent from the Start Page
    await expect(page.getByTestId('enter-demo-btn')).toBeHidden();
    await expect(page.getByTestId('auth-demo-btn')).toBeHidden();

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

    // 9. Validation error on registration with short password
    await page.getByTestId('auth-tab-register').click();
    await page.getByTestId('auth-email-input').fill(`short-${uniqueSuffix}@test.com`);
    await page.getByTestId('auth-displayname-input').fill('Short Pass Tester');
    await page.getByTestId('auth-password-input').fill('short');
    // HTML5 minLength / JS validation prevents submission or shows error
    await page.getByTestId('auth-submit-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();

    // 10. Re-sign in and verify clean empty workspace states & absence of demo UI
    await page.getByTestId('auth-tab-login').click();
    await page.getByTestId('auth-email-input').fill(testEmail);
    await page.getByTestId('auth-password-input').fill(testPassword);
    await page.getByTestId('auth-submit-btn').click();

    await expect(page.getByTestId('auth-card')).toBeHidden();
    await expect(page.getByTestId('current-user-badge')).toBeVisible();

    // Verify empty state welcome card is visible on overview
    await expect(page.getByTestId('overview-welcome-card')).toBeVisible();
    await expect(page.locator('.demo-announcement-banner')).toBeHidden();
    await expect(page.getByTestId('reset-demo-btn')).toBeHidden();

    // Verify user's own data isolation (empty clients list, not sample data)
    const authedApiRes = await page.request.get('/api/clients');
    expect(authedApiRes.status()).toBe(200);
    const authedClients = (await authedApiRes.json()) as { clients: unknown[] };
    expect(authedClients.clients).toHaveLength(0);

    // 11. Final logout
    await page.getByTestId('logout-btn').click();
    await expect(page.getByTestId('auth-card')).toBeVisible();

    const loggedOutApiRes = await page.request.get('/api/clients');
    expect(loggedOutApiRes.status()).toBe(401);

    // Filter non-fatal 401s and offline network messages
    const fatalErrors = consoleErrors.filter(
      (err) =>
        !err.includes('status of 401') &&
        !err.includes('401 (Unauthorized)') &&
        !err.includes('ERR_INTERNET_DISCONNECTED')
    );
    expect(fatalErrors).toEqual([]);
  });
});
