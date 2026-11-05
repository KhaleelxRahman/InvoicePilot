import type { Page } from '@playwright/test';

/**
 * Ensures the workspace is loaded for a test by entering the demo workspace if on the start page.
 */
export async function ensureWorkspaceLoaded(page: Page): Promise<void> {
  const userBadge = page.getByTestId('current-user-badge');
  if (await userBadge.isVisible().catch(() => false)) {
    return;
  }

  // Allow up to 1.5s for session check to resolve if already authenticated
  try {
    await userBadge.waitFor({ state: 'visible', timeout: 1500 });
    return;
  } catch {
    // Session not authenticated, proceed to sign in via real auth form
  }

  const authCard = page.getByTestId('auth-card');
  try {
    if (await authCard.isVisible({ timeout: 1500 })) {
      const loginTab = page.getByTestId('auth-tab-login');
      if (await loginTab.isVisible().catch(() => false)) {
        await loginTab.click();
      }
      await page.getByTestId('auth-email-input').fill('demo.freelancer@invoicepilot.local');
      await page.getByTestId('auth-password-input').fill('TestDemo1234!');
      await page.getByTestId('auth-submit-btn').click();
      await userBadge.waitFor({ state: 'visible', timeout: 8000 });
    }
  } catch {
    if (await userBadge.isVisible().catch(() => false)) {
      return;
    }
  }
}

/**
 * Responsive navigation helper for Playwright tests.
 * On desktop, clicks the nav item directly.
 * On mobile viewports where the responsive off-canvas drawer is closed,
 * automatically opens the hamburger menu first if the target nav button is not yet visible.
 */
export async function navigateToSection(page: Page, navTestId: string): Promise<void> {
  await ensureWorkspaceLoaded(page);
  const toggle = page.getByTestId('mobile-menu-toggle');
  if (await toggle.isVisible()) {
    const isExpanded = await toggle.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await toggle.click();
      await page.locator('.ledger-nav.is-open').waitFor({ state: 'visible', timeout: 3000 });
    }
  }
  await page.getByTestId(navTestId).click();
}

