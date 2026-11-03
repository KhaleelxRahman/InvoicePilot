import type { Page } from '@playwright/test';

/**
 * Responsive navigation helper for Playwright tests.
 * On desktop, clicks the nav item directly.
 * On mobile viewports where the responsive off-canvas drawer is closed,
 * automatically opens the hamburger menu first if the target nav button is not yet visible.
 */
export async function navigateToSection(page: Page, navTestId: string): Promise<void> {
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

