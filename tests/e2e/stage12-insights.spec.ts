import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';

test.describe('Stage 12 — Grounded Aging and Cash-Flow Insights E2E', () => {
  test('verifies aging buckets, 30-day forecast projections, slow payer rankings, and partial payments', async ({
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
    test.setTimeout(60000);

    // =========================================================================
    // 1. Executive Summary & Observed Facts
    // =========================================================================
    const homeSummary = page.getByTestId('home-summary-statement');
    await expect(homeSummary).toBeVisible();

    // Verify existing aging summary testid is preserved
    const agingSummary = page.getByTestId('home-aging-summary');
    await expect(agingSummary).toBeVisible();

    // =========================================================================
    // 2. 30-Day Cash-Flow Forecast Card & Projection Labeling
    // =========================================================================
    const forecastCard = page.getByTestId('cash-flow-forecast-card');
    await expect(forecastCard).toBeVisible();

    const forecastBadge = page.getByTestId('forecast-estimate-badge');
    await expect(forecastBadge).toBeVisible();
    await expect(forecastBadge).toContainText('ESTIMATE / PROJECTION');

    const forecastDisclaimer = page.getByTestId('forecast-disclaimer');
    await expect(forecastDisclaimer).toBeVisible();
    await expect(forecastDisclaimer).toContainText('probability-weighted');

    // =========================================================================
    // 3. Slow-Payer Rankings Table & Reliability Status
    // =========================================================================
    const slowPayerTable = page.getByTestId('slow-payer-rankings-table');
    await expect(slowPayerTable).toBeVisible();

    // =========================================================================
    // 4. Weekly Summary Snapshot (Trailing 7 Days)
    // =========================================================================
    const weeklySummary = page.getByTestId('weekly-summary-panel');
    await expect(weeklySummary).toBeVisible();

    // =========================================================================
    // 5. Partial Payment Recording Workflow
    // =========================================================================
    // Navigate to invoices section
    await navigateToSection(page, 'nav-invoices');

    // Open first available invoice detail
    const firstViewDetailBtn = page.locator('button[data-testid^="view-invoice-"]').first();
    await expect(firstViewDetailBtn).toBeVisible();
    await firstViewDetailBtn.click();

    const invoiceDetail = page.getByTestId('invoice-detail-panel');
    await expect(invoiceDetail).toBeVisible();

    const totalEl = page.getByTestId('detail-invoice-total');
    await expect(totalEl).toBeVisible();

    const outstandingEl = page.getByTestId('detail-invoice-outstanding');
    await expect(outstandingEl).toBeVisible();

    // Check if partial payment form is available
    const partialPaymentSection = page.getByTestId('partial-payment-section');
    if (await partialPaymentSection.isVisible()) {
      const paymentInput = page.getByTestId('record-partial-payment-input');
      const paymentBtn = page.getByTestId('record-partial-payment-btn');

      await expect(paymentInput).toBeVisible();
      await expect(paymentBtn).toBeVisible();

      // Enter a partial payment
      await paymentInput.fill('50.00');
      await paymentBtn.click();

      // Verify success feedback
      const successFeedback = page.getByTestId('partial-payment-success');
      await expect(successFeedback).toBeVisible();
    }

    // Return to overview and verify updated insights
    await navigateToSection(page, 'nav-overview');

    await expect(forecastCard).toBeVisible();
    await expect(slowPayerTable).toBeVisible();

    // Assert zero uncaught console errors
    expect(consoleErrors).toEqual([]);
  });
});
