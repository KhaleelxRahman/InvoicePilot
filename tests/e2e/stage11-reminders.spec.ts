import { expect, test } from '@playwright/test';
import { navigateToSection } from './testHelpers';

test.describe('Stage 11 — Reminder Drafts, Client Tone & Observable Scheduling E2E', () => {
  test('verifies reminder drafting, client tone selection, approval workflow, scheduling, and delivery evidence', async ({
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

    // =========================================================================
    // 1. Navigation & Page 19 Layout
    // =========================================================================
    await navigateToSection(page, 'nav-reminders');

    // Verify Page 19 3 queues / tabs
    const tabWaiting = page.getByTestId('reminders-waiting-approval');
    const tabScheduled = page.getByTestId('reminders-scheduled');
    const tabSent = page.getByTestId('reminders-sent');

    await expect(tabWaiting).toBeVisible();
    await expect(tabScheduled).toBeVisible();
    await expect(tabSent).toBeVisible();

    // Verify Action buttons in header
    await expect(page.getByTestId('reminder-draft-btn')).toBeVisible();
    await expect(page.getByTestId('process-scheduled-reminders-btn')).toBeVisible();

    // =========================================================================
    // 2. Draft Reminder via Modal
    // =========================================================================
    await page.getByTestId('reminder-draft-btn').click();
    const modal = page.getByTestId('reminder-draft-modal');
    await expect(modal).toBeVisible();

    // Check tone selector
    const toneSelect = page.getByTestId('reminder-tone-select');
    await expect(toneSelect).toBeVisible();
    await toneSelect.selectOption('firm');

    // Click generate wording
    const genBtn = page.getByTestId('reminder-generate-draft-btn');
    await expect(genBtn).toBeVisible();
    await genBtn.click();

    // Verify generated subject and body
    const subjectInput = page.getByTestId('reminder-subject-input');
    const bodyInput = page.getByTestId('reminder-body-input');
    await expect(subjectInput).toBeVisible();
    await expect(bodyInput).toBeVisible();
    await expect(subjectInput).toHaveValue(/Overdue Notice/);

    // Close modal
    await page.getByTestId('close-reminder-modal-btn').click();
    await expect(modal).not.toBeVisible();

    // =========================================================================
    // 3. Waiting for Approval Queue & Send Execution
    // =========================================================================
    await tabWaiting.click();
    const waitingTable = page.getByTestId('reminders-waiting-table');
    await expect(waitingTable).toBeVisible();

    // Send now
    const sendNowBtn = page.locator('button[data-testid="reminder-send-now-btn"]').first();
    await expect(sendNowBtn).toBeVisible();
    await sendNowBtn.click();

    // Verify feedback banner
    await expect(page.getByTestId('reminders-feedback-banner')).toContainText(
      'Reminder sent successfully'
    );

    // =========================================================================
    // 4. Sent Queue & Observable Delivery Evidence
    // =========================================================================
    await tabSent.click();
    const sentTable = page.getByTestId('reminders-sent-table');
    await expect(sentTable).toBeVisible();
    const evidenceCode = page.locator('[data-testid="reminder-evidence"]').first();
    await expect(evidenceCode).toBeVisible();
    await expect(evidenceCode).toContainText(/CONFIRMED/);

    // =========================================================================
    // 5. Invoice Detail "Draft reminder" Action (Page 15 Integration)
    // =========================================================================
    await navigateToSection(page, 'nav-invoices');
    const viewInvBtn = page.locator('button[data-testid^="view-invoice-"]').first();
    await viewInvBtn.click();

    const invoiceRemindBtn = page.getByTestId('invoice-remind-btn');
    await expect(invoiceRemindBtn).toBeVisible();
    await invoiceRemindBtn.click();

    // Modal re-opens bound to selected invoice
    await expect(page.getByTestId('reminder-draft-modal')).toBeVisible();
    await page.getByTestId('close-reminder-modal-btn').click();

    // =========================================================================
    // 6. Observable Scheduler Execution
    // =========================================================================
    await navigateToSection(page, 'nav-reminders');
    await page.getByTestId('process-scheduled-reminders-btn').click();
    const schedResult = page.getByTestId('scheduler-execution-result');
    await expect(schedResult).toBeVisible();
    await expect(schedResult).toContainText('Scheduler executed');

    // =========================================================================
    // 7. Verify zero browser console errors
    // =========================================================================
    expect(consoleErrors).toEqual([]);
  });
});
