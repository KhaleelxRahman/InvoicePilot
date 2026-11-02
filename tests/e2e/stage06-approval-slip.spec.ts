import { expect, test } from '@playwright/test';

test.describe('Stage 06 — Paper Approval Slip and Safe Action State Machine', () => {
  test('renders paper approval slip, edits draft, rejects/discards slip safely, approves and executes fresh slip, blocks duplicate/stale/unauthorized actions, and logs transitions in Activity', async ({
    page
  }, testInfo) => {
    test.setTimeout(60000);
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
    const shortId = Date.now().toString().slice(-6);
    const invoiceNum = `INV-S06-${projCode}-${shortId}`;

    await page.goto('/');

    // 1. Navigate to Invoices & drafts and create a fresh draft invoice
    await page.getByTestId('nav-invoices').click();
    await page.getByTestId('new-invoice-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();

    await page.getByTestId('invoice-client-select').selectOption('cli_demo_northstar_01');
    await page.getByTestId('invoice-number-input').fill(invoiceNum);
    await page.getByTestId('invoice-currency-select').selectOption('USD');
    await page.getByTestId('invoice-tax-input').fill('0');
    await page.getByTestId('invoice-issue-date-input').fill('2026-10-31');
    await page.getByTestId('invoice-due-date-input').fill('2026-11-14');

    await page.getByTestId('item-desc-0').fill('Stage 06 Approval Gate Verification');
    await page.getByTestId('item-qty-0').fill('2');
    await page.getByTestId('item-price-0').fill('150.00'); // $300.00

    await page.getByTestId('invoice-notes-input').fill('Requires explicit human approval before sending.');
    await page.getByTestId('save-invoice-draft-btn').click();

    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Created local draft ${invoiceNum} (USD 300.00). Not sent to PayPal.`
    );

    // 2. Click "Review approval slip" to propose the action (DRAFTED -> PENDING_APPROVAL)
    await page.getByTestId(`prepare-approval-${invoiceNum}`).click();
    const slipPanel = page.getByTestId('approval-slip-panel');
    await expect(slipPanel).toBeVisible();

    // Verify client, line items, currency, total, due date, warnings, and what will happen
    await expect(page.getByTestId('approval-slip-state')).toHaveText('PENDING_APPROVAL');
    await expect(page.getByTestId('slip-client-summary')).toContainText('Elena Vance');
    await expect(page.getByTestId('slip-client-summary')).toContainText(
      'elena.vance@northstar-demo.example.com'
    );
    await expect(page.getByTestId('slip-currency')).toHaveText('USD');
    await expect(page.getByTestId('slip-due-date')).toHaveText('2026-11-14');
    await expect(page.getByTestId('slip-items-table')).toContainText(
      'Stage 06 Approval Gate Verification'
    );
    await expect(page.getByTestId('slip-total')).toHaveText('USD 300.00');
    await expect(page.getByTestId('slip-warnings-list')).toBeVisible();
    await expect(page.getByTestId('slip-what-will-happen')).toContainText('Elena Vance');

    // 3. Test "Edit draft" from the approval slip -> modify unit price -> re-verify updated slip total
    await page.getByTestId('slip-edit-draft-btn').click();
    await expect(page.getByTestId('invoice-draft-form')).toBeVisible();
    await page.getByTestId('item-price-0').fill('175.00'); // 2 * $175.00 = $350.00
    await page.getByTestId('save-invoice-draft-btn').click();
    await expect(page.getByTestId('invoice-feedback-banner')).toContainText(
      `Saved updated draft ${invoiceNum} (USD 350.00). Not sent to PayPal.`
    );

    // Re-open approval slip and confirm updated total ($350.00)
    await page.getByTestId(`prepare-approval-${invoiceNum}`).click();
    await expect(page.getByTestId('approval-slip-panel')).toBeVisible();
    await expect(page.getByTestId('slip-total')).toHaveText('USD 350.00');
    const firstActionId = (await page.getByTestId('slip-action-id').textContent())?.trim() ?? '';
    expect(firstActionId).toMatch(/^act_/);

    // 4. Test Reject / Discard on the approval slip
    await page.getByTestId('slip-reject-btn').click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('REJECTED');
    await expect(page.getByTestId('slip-feedback-banner')).toContainText('REJECTED');
    await expect(page.getByTestId('slip-approve-btn')).toHaveCount(0);
    await expect(page.getByTestId('slip-execute-btn')).toHaveCount(0);

    // Verify via API that a rejected/discarded action cannot be approved or executed
    const execRejectedRes = await page.request.post(`/api/actions/${firstActionId}/execute`);
    expect(execRejectedRes.status()).toBe(400);

    // Close the rejected slip and request a fresh approval slip
    await page.getByTestId('slip-close-btn').click();
    await page.getByTestId(`prepare-approval-${invoiceNum}`).click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('PENDING_APPROVAL');
    const secondActionId = (await page.getByTestId('slip-action-id').textContent())?.trim() ?? '';
    expect(secondActionId).not.toBe(firstActionId);

    // Verify unauthorized/anonymous action request is rejected with 401
    const unauthApproveRes = await page.request.post(`/api/actions/${secondActionId}/approve`, {
      headers: { 'x-session-user-id': 'anonymous' }
    });
    expect(unauthApproveRes.status()).toBe(401);

    // 5. Approve the fresh approval slip (PENDING_APPROVAL -> APPROVED)
    await page.getByTestId('slip-approve-btn').click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('APPROVED');
    await expect(page.getByTestId('slip-execute-btn')).toBeVisible();

    // Verify duplicate approve request returns 409 DUPLICATE_EVENT
    const dupApproveRes = await page.request.post(`/api/actions/${secondActionId}/approve`);
    expect(dupApproveRes.status()).toBe(409);

    // 6. Execute the approved slip (APPROVED -> EXECUTING -> EXECUTED)
    await page.getByTestId('slip-execute-btn').click();
    await expect(page.getByTestId('approval-slip-state')).toHaveText('EXECUTED', {
      timeout: 25000
    });
    await expect(page.getByTestId('slip-feedback-banner')).toContainText('Executed approved send');

    // Verify duplicate execute request returns 409 DUPLICATE_EVENT
    const dupExecRes = await page.request.post(`/api/actions/${secondActionId}/execute`);
    expect(dupExecRes.status()).toBe(409);

    // 7. Navigate to Activity & audit log and verify transitions are recorded
    await page.getByTestId('nav-activity').click();
    const activityTable = page.getByTestId('activity-table');
    await expect(activityTable).toBeVisible();
    await expect(activityTable).toContainText('ACTION_PROPOSED_FOR_APPROVAL');
    await expect(activityTable).toContainText('ACTION_REJECTED');
    await expect(activityTable).toContainText('ACTION_APPROVED');
    await expect(activityTable).toContainText('ACTION_EXECUTING');
    await expect(activityTable).toContainText('ACTION_EXECUTED');

    expect(consoleErrors).toEqual([]);
  });
});
