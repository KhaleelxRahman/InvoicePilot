import { expect, test } from '@playwright/test';
import { ensureWorkspaceLoaded } from './testHelpers';

test.describe('Phase 2 — Frontend Product Polish & UX Verification', () => {
  test('verifies mobile navigation drawer, backdrop, and responsive controls', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await ensureWorkspaceLoaded(page);

    const menuToggle = page.getByTestId('mobile-menu-toggle');
    await expect(menuToggle).toBeVisible();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    // Drawer should not be open initially
    const drawer = page.locator('.ledger-nav');
    await expect(drawer).not.toHaveClass(/is-open/);

    // Open drawer via toggle button
    await menuToggle.click();
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveClass(/is-open/);

    const backdrop = page.getByTestId('mobile-nav-backdrop');
    await expect(backdrop).toBeVisible();
    await expect(page.getByTestId('mobile-drawer-close')).toBeVisible();

    // Close via drawer close button
    await page.getByTestId('mobile-drawer-close').click();
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(menuToggle).toHaveAttribute('aria-expanded', 'false');

    // Open again and close via backdrop click
    await menuToggle.click();
    await expect(drawer).toHaveClass(/is-open/);
    await backdrop.click({ position: { x: 350, y: 300 } });
    await expect(drawer).not.toHaveClass(/is-open/);

    // Open again and navigate to a section
    await menuToggle.click();
    await expect(drawer).toHaveClass(/is-open/);
    await page.getByTestId('nav-clients').click();
    await expect(drawer).not.toHaveClass(/is-open/);
    await expect(page.locator('#section-clients-title')).toHaveText('Clients');
  });

  test('verifies interactive global search, keyboard shortcuts, and dropdown navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await ensureWorkspaceLoaded(page);

    const searchInput = page.getByTestId('header-search-input');
    await expect(searchInput).toBeVisible();

    // 1. Press '/' shortcut to focus search
    await page.keyboard.press('/');
    await expect(searchInput).toBeFocused();

    // 2. Type invoice query
    await searchInput.fill('INV');
    const dropdown = page.getByTestId('global-search-dropdown');
    await expect(dropdown).toBeVisible();

    // Matching invoice result should be listed
    const invoiceResult = dropdown.locator('[data-testid^="search-result-invoice-"]').first();
    await expect(invoiceResult).toBeVisible();

    // 3. Test Escape key closes dropdown
    await page.keyboard.press('Escape');
    await expect(dropdown).toBeHidden();

    // 4. Test client search
    await searchInput.focus();
    await searchInput.fill('Acme');
    await expect(dropdown).toBeVisible();

    // 5. Test nonexistent query empty state
    await searchInput.fill('xyznonexistentterm999');
    await expect(page.getByTestId('global-search-empty')).toBeVisible();
    await expect(page.getByTestId('global-search-empty')).toContainText('No invoices or clients matching');

    // 6. Test clear button
    const clearBtn = page.getByTestId('header-search-clear-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(searchInput).toHaveValue('');
    await expect(dropdown).toBeHidden();
  });

  test('verifies polished business copy, no double-plus glitches, and clean hierarchy', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await ensureWorkspaceLoaded(page);

    // 1. Verify Header Create Invoice button text has no double-plus
    const createBtn = page.getByTestId('header-create-invoice-btn');
    await expect(createBtn).toBeVisible();
    const btnText = (await createBtn.textContent()) || '';
    expect(btnText.trim()).toBe('Create invoice');
    expect(btnText).not.toContain('+ +');

    // 2. Verify Invoices page headings and table headers
    await page.getByTestId('nav-invoices').click();
    await expect(page.locator('#section-invoices-title')).toHaveText('Invoices');
    await expect(page.getByRole('columnheader', { name: 'Total Amount' })).toBeVisible();

    // 3. Verify AI Assistant page heading
    await page.getByTestId('nav-agent').click();
    await expect(page.locator('#section-agent-title')).toHaveText('AI Assistant');

    // 4. Verify Clients page heading
    await page.getByTestId('nav-clients').click();
    await expect(page.locator('#section-clients-title')).toHaveText('Clients');

    // 5. Verify Reminders page heading
    await page.getByTestId('nav-reminders').click();
    await expect(page.locator('#section-reminders-title')).toHaveText('Payment Reminders');

    // 6. Verify Activity page heading
    await page.getByTestId('nav-activity').click();
    await expect(page.locator('#section-activity-title')).toHaveText('Activity Log');

    // 7. Verify Notifications page heading
    await page.getByTestId('nav-notifications').click();
    await expect(page.locator('#section-notifications-title')).toHaveText('Notifications');

    // 8. Verify Settings page heading
    await page.getByTestId('nav-settings').click();
    await expect(page.locator('#section-settings-title')).toHaveText('Workspace Settings');

    // 9. Verify Developer Diagnostics access
    await page.getByTestId('nav-tokens').click();
    await expect(page.getByRole('heading', { name: 'Paper ledger & approval slip design tokens' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'UI design token inventory' })).toBeVisible();

    await page.getByTestId('nav-roadmap').click();
    await expect(page.getByRole('heading', { name: 'Implementation honesty & stage status' })).toBeVisible();
  });
});

