import { expect, test } from '@playwright/test';

test.describe('Stage 01 — Responsive Shell, Design Tokens, and Health Endpoint', () => {
  test('renders responsive shell, verifies /api/health, switches themes, and navigates without console errors', async ({
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

    // 1. Direct API health check verification
    const healthResponse = await page.request.get('/api/health');
    expect(healthResponse.status()).toBe(200);
    const healthJson = (await healthResponse.json()) as {
      status: string;
      service: string;
      paypalMode: string;
    };
    expect(healthJson.status).toBe('ok');
    expect(healthJson.service).toBe('invoicepilot');
    expect(healthJson.paypalMode).toBe('sandbox');

    // 2. Load application shell
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'InvoicePilot', level: 1 })).toBeVisible();

    // Verify explicit Sandbox mode badge is visible
    const modeBadge = page.getByTestId('provider-mode-badge');
    await expect(modeBadge).toBeVisible();
    await expect(modeBadge).toContainText('Mode: PayPal Sandbox');

    // Verify health diagnostics loaded in UI
    await expect(page.getByTestId('health-status-value')).toContainText('invoicepilot (stage-');
    await expect(page.getByTestId('health-mode-value')).toContainText('PayPal Sandbox Mode (No Live Money)');

    // 3. Verify theme switching and exact design token values (UI_UX_DESIGN.md)
    await page.getByTestId('theme-btn-light').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const lightDeskToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--desk').trim()
    );
    const lightPrimaryToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    );
    expect(lightDeskToken).toBe('#EEF0F3');
    expect(lightPrimaryToken).toBe('#0E5A6B');

    await page.getByTestId('theme-btn-dark').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const darkDeskToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--desk').trim()
    );
    const darkPrimaryToken = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    );
    expect(darkDeskToken).toBe('#0F151C');
    expect(darkPrimaryToken).toBe('#5CC3D0');

    // 4. Verify navigation controls work and perform meaningful actions
    await page.getByTestId('nav-tokens').click();
    await expect(
      page.getByRole('heading', { name: 'Paper ledger & approval slip design tokens' })
    ).toBeVisible();
    await expect(page.getByRole('table', { name: 'UI design token inventory' })).toBeVisible();

    await page.getByTestId('nav-roadmap').click();
    await expect(
      page.getByRole('heading', { name: 'Implementation honesty & stage status' })
    ).toBeVisible();

    await page.getByTestId('nav-overview').click();
    await page.getByTestId('refresh-health-btn').click();
    await expect(page.getByTestId('health-status-value')).toContainText('invoicepilot (stage-');

    // 5. Verify no horizontal overflow at current viewport (desktop 1280px or mobile 360px)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 6. Verify zero console or page errors
    expect(consoleErrors).toEqual([]);
  });
});
