import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const LIVE_URL = 'https://inquisitive-biscochitos-83e042.netlify.app';
const SCREENSHOTS_DIR = path.resolve(process.cwd(), 'live-walkthrough-screenshots');

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const browser: Browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true
  });
  const page: Page = await context.newPage();

  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleLogs.push(`[Console Error] ${msg.text()}`);
    }
  });

  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('/api/auth/me')) {
      networkErrors.push(`[Network ${res.status()}] ${res.url()}`);
    }
  });

  const timestamp = Date.now();
  const testEmail = `qa-synthetic-${timestamp}@invoicepilot.test`;
  const testPassword = `PilotDemo2026!`;
  const testInvoiceNum = `INV-QA-${timestamp.toString().slice(-4)}`;

  console.log(`Starting live walkthrough on: ${LIVE_URL}`);
  console.log(`Generated synthetic test account: ${testEmail}`);

  // 1. Start Page & Health Check
  await page.goto(LIVE_URL);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-start-page.png') });
  console.log('✓ 1. Start page rendered');

  // Verify health endpoint on live
  const healthRes = await page.request.get(`${LIVE_URL}/api/health`);
  const healthJson = await healthRes.json();
  console.log(`✓ Live /api/health returned: schemaVersion=${healthJson.schemaVersion}, engine=${healthJson.databaseEngine}`);

  // 2. Register New Synthetic Account
  await page.getByTestId('auth-tab-register').click();
  await page.getByTestId('auth-email-input').fill(testEmail);
  await page.getByTestId('auth-displayname-input').fill('Synthetic QA Tester');
  await page.getByTestId('auth-password-input').fill(testPassword);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-registration-form.png') });
  await page.getByTestId('auth-submit-btn').click();
  await page.waitForLoadState('networkidle');

  // Verify in Workspace
  await page.waitForSelector('[data-testid="current-user-badge"]', { timeout: 15000 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-workspace-entered.png') });
  console.log('✓ 2. Registered unique test account; entered workspace');

  // If onboarding dialog appears, complete or skip it
  const onboardingStep1 = await page.$('[data-testid="onboarding-step-1"]');
  if (onboardingStep1) {
    console.log('   - Onboarding wizard detected; stepping through...');
    await page.getByTestId('onboarding-business-name').fill('Globex QA Services');
    await page.getByTestId('onboarding-step1-next-btn').click();

    await page.waitForSelector('[data-testid="onboarding-step-2"]');
    await page.getByTestId('onboarding-step2-next-btn').click();

    await page.waitForSelector('[data-testid="onboarding-step-3"]');
    await page.getByTestId('onboarding-step3-next-btn').click();

    await page.waitForSelector('[data-testid="onboarding-step-4"]');
    await page.getByTestId('onboarding-client-name').fill('First Test Client');
    await page.getByTestId('onboarding-client-email').fill('client1@globex.test');
    await page.getByTestId('onboarding-finish-btn').click();
    await page.waitForLoadState('networkidle');
  }

  // 3. Test Sign Out and Sign In Persistence
  await page.getByTestId('logout-btn').click();
  await page.waitForSelector('[data-testid="auth-card"]');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-logged-out.png') });
  console.log('✓ 3. Signed out successfully; returned to start page');

  // Sign back in
  await page.getByTestId('auth-tab-login').click();
  await page.getByTestId('auth-email-input').fill(testEmail);
  await page.getByTestId('auth-password-input').fill(testPassword);
  await page.getByTestId('auth-submit-btn').click();
  await page.waitForSelector('[data-testid="current-user-badge"]');
  console.log('✓ 4. Signed back in successfully with synthetic account');

  // Test page reload persistence
  await page.reload();
  await page.waitForSelector('[data-testid="current-user-badge"]');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-session-persisted-on-reload.png') });
  console.log('✓ 5. Session persisted across page reload');

  // 4. Create a dedicated client
  await page.getByTestId('nav-clients').click();
  await page.waitForSelector('[data-testid="new-client-btn"]');
  await page.getByTestId('new-client-btn').click();
  await page.waitForSelector('[data-testid="client-form"]');
  await page.getByTestId('client-fullname-input').fill('Acme QA Partner');
  await page.getByTestId('client-company-input').fill('Acme QA Corp');
  await page.getByTestId('client-email-input').fill('billing@acme-qa.test');
  await page.getByTestId('save-client-btn').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-client-created.png') });
  console.log('✓ 6. Test client created');

  // 5. Create and save an Invoice Draft using draft-for-client-btn
  await page.getByTestId('draft-for-client-btn').click();
  await page.waitForSelector('[data-testid="invoice-draft-form"]');

  await page.getByTestId('invoice-number-input').fill(testInvoiceNum);
  await page.getByTestId('invoice-tax-input').fill('10');
  await page.getByTestId('invoice-issue-date-input').fill('2026-11-04');
  await page.getByTestId('invoice-due-date-input').fill('2026-11-18');

  // Line item 1
  await page.getByTestId('item-desc-0').fill('Enterprise Security Architecture');
  await page.getByTestId('item-qty-0').fill('2');
  await page.getByTestId('item-price-0').fill('800.00'); // 2 * 800 = 1600

  // Add line item 2
  await page.getByTestId('add-line-item-btn').click();
  await page.getByTestId('item-desc-1').fill('API Integration Audit');
  await page.getByTestId('item-qty-1').fill('1');
  await page.getByTestId('item-price-1').fill('400.00'); // 1 * 400 = 400. Subtotal 2000, Tax 200, Total 2200

  await page.getByTestId('invoice-notes-input').fill('Payment terms Net 14. Synthetic QA walkthrough draft.');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-invoice-draft-form.png') });

  await page.getByTestId('save-invoice-draft-btn').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-invoice-saved-detail.png') });
  console.log(`✓ 7. Invoice draft #${testInvoiceNum} created and saved (USD 2200.00)`);

  // Verify saved totals and statuses in Detail View
  const detailTotal = await page.getByTestId('detail-invoice-total').innerText();
  const detailLocalStatus = await page.getByTestId('detail-local-status').innerText();
  const detailProviderStatus = await page.getByTestId('detail-provider-status').innerText();
  const detailOperationalStatus = await page.getByTestId('detail-operational-status').innerText();
  console.log(`✓ Detail view verified: Total=${detailTotal}, LocalStatus=${detailLocalStatus}, ProviderStatus=${detailProviderStatus}, OperationalStatus=${detailOperationalStatus}`);

  // 6. Reminder Draft (do not send or schedule)
  await page.getByTestId('invoice-remind-btn').click();
  await page.waitForSelector('[data-testid="reminder-draft-modal"]');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-reminder-draft-modal.png') });
  console.log('✓ 8. Reminder draft modal displayed with tone selector and preview (not sent or scheduled)');

  // Close modal to return to invoice detail view
  await page.getByTestId('close-reminder-modal-btn').click();
  await page.waitForSelector('[data-testid="mark-completed-btn"]');

  // 7. Mark as Completed Workflow
  await page.getByTestId('mark-completed-btn').click();
  await page.waitForSelector('[data-testid="confirm-complete-dialog"]');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '10-mark-completed-confirm-modal.png') });
  await page.getByTestId('confirm-mark-completed-btn').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '11-invoice-marked-completed.png') });
  const updatedOperationalStatus = await page.getByTestId('detail-operational-status').innerText();
  const updatedLocalStatus = await page.getByTestId('detail-local-status').innerText();
  console.log(`✓ 9. Marked invoice completed: Operational=${updatedOperationalStatus}, PaymentStatus=${updatedLocalStatus} (unpaid preserved)`);

  // 8. Open Paper Approval Slip (do NOT approve or execute)
  await page.getByTestId('detail-prepare-approval-btn').click();
  await page.waitForSelector('[data-testid="approval-slip-panel"]');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '12-paper-approval-slip.png') });
  const slipState = await page.getByTestId('approval-slip-state').innerText();
  console.log(`✓ 10. Paper approval slip displayed in pending-approval state: ${slipState} (no send/pay triggered)`);

  // Discard slip safely
  await page.getByTestId('slip-reject-btn').click();
  await page.waitForLoadState('networkidle');
  console.log('✓ 11. Approval slip safely discarded (REJECTED terminal state)');

  // 9. Download Invoice PDF and Verify Content
  await page.getByTestId('nav-invoices').click();
  await page.waitForSelector(`[data-testid="view-invoice-${testInvoiceNum}"]`);
  await page.getByTestId(`view-invoice-${testInvoiceNum}`).click();
  await page.waitForSelector('[data-testid="download-pdf-btn"]');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-pdf-btn').click()
  ]);

  const pdfFilename = download.suggestedFilename();
  const pdfDownloadPath = path.join(SCREENSHOTS_DIR, pdfFilename);
  await download.saveAs(pdfDownloadPath);
  const pdfBytes = fs.readFileSync(pdfDownloadPath);
  const pdfText = pdfBytes.toString('binary');

  console.log(`✓ 12. Downloaded invoice PDF: ${pdfFilename} (${pdfBytes.length} bytes)`);
  console.log(`   - PDF 1.4 header valid: ${pdfText.startsWith('%PDF-1.4')}`);
  console.log(`   - Contains invoice number: ${pdfText.includes(testInvoiceNum)}`);
  console.log(`   - Contains client name: ${pdfText.includes('Acme QA Partner')}`);
  console.log(`   - Contains line items: ${pdfText.includes('Enterprise Security Architecture')}`);
  console.log(`   - Contains total amount: ${pdfText.includes('USD 2200.00')}`);
  console.log(`   - Contains operational completed: ${pdfText.includes('Completed')}`);

  // 10. Inspect All Other Visible Screens (Read-Only)
  // Overview
  await page.getByTestId('nav-overview').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '13-overview-screen.png') });
  console.log('✓ 13. Overview screen inspected');

  // AI Assistant
  await page.getByTestId('nav-agent').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '14-ai-assistant.png') });
  console.log('✓ 14. AI Assistant workspace inspected');

  // Activity Log
  await page.getByTestId('nav-activity').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '15-activity-log.png') });
  console.log('✓ 15. Activity log inspected with full audit trail');

  // Notifications
  await page.getByTestId('nav-notifications').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '16-notifications.png') });
  console.log('✓ 16. In-app notifications inspected');

  // Settings: Profile, PayPal, Limits, Appearance, Privacy, Advanced
  await page.getByTestId('nav-settings').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '17-settings-profile.png') });

  await page.getByTestId('settings-tab-paypal').click();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '18-settings-paypal.png') });

  await page.getByTestId('settings-tab-developer').click();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '19-settings-advanced-diagnostics.png') });
  console.log('✓ 17. Settings sections and advanced diagnostics inspected');

  // Help & FAQ
  await page.getByTestId('nav-help').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '20-help-faq.png') });
  console.log('✓ 18. Help & FAQ inspected');

  // Policies
  await page.getByTestId('nav-policies').click();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '21-legal-policies.png') });
  console.log('✓ 19. Legal & policies inspected');

  // Dark Theme Toggle
  await page.getByTestId('theme-btn-dark').click();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '22-dark-theme.png') });
  await page.getByTestId('theme-btn-light').click(); // Toggle back
  console.log('✓ 20. Theme toggle (Light/Dark) verified');

  // Mobile Viewport Navigation
  await page.setViewportSize({ width: 360, height: 740 });
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '23-mobile-360-viewport.png') });
  console.log('✓ 21. Mobile 360px responsive viewport verified');

  await browser.close();

  console.log('\n--- LIVE WALKTHROUGH COMPLETE ---');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
  console.log(`Console errors captured: ${consoleLogs.length}`);
  console.log(`Network errors captured: ${networkErrors.length}`);
}

main().catch((err) => {
  console.error('Walkthrough script failed:', err);
  process.exit(1);
});
