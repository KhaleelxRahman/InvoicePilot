import type { Page } from '@playwright/test';

/**
 * Ensures the workspace is loaded for a test by entering the demo workspace if on the start page.
 */
export async function ensureWorkspaceLoaded(page: Page): Promise<void> {
  const userBadge = page.getByTestId('current-user-badge');
  if (await userBadge.isVisible()) {
    return;
  }

  // Allow up to 1.5s for session check to resolve if already authenticated
  try {
    await userBadge.waitFor({ state: 'visible', timeout: 1500 });
    return;
  } catch {
    // Session not authenticated, proceed to enter demo if button is present
  }

  const enterDemoBtn = page.getByTestId('enter-demo-btn');
  try {
    if (await enterDemoBtn.isVisible({ timeout: 1000 })) {
      await enterDemoBtn.click({ timeout: 3000 });
      await userBadge.waitFor({ state: 'visible', timeout: 5000 });
    }
  } catch {
    // If click raced with session check resolution, confirm user badge
    if (await userBadge.isVisible()) {
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

