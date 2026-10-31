import { resolveSandboxProofEnv, runSandboxVerification } from './sandboxProof.js';

async function main() {
  console.log('=== InvoicePilot Stage 02: PayPal Sandbox Verification Runner ===');
  const env = resolveSandboxProofEnv();
  console.log(`Target Base URL : ${env.baseUrl}`);
  console.log(`Configured Mode : ${env.paypalMode}`);
  console.log(`Credentials Set : ${env.clientId.length > 0 && env.clientSecret.length > 0}`);
  console.log('-----------------------------------------------------------------');

  const report = await runSandboxVerification(env);
  console.log(JSON.stringify(report, null, 2));

  const allPassed =
    report.steps.oauthToken.status === 'PASSED' &&
    report.steps.createDraft.status === 'PASSED' &&
    report.steps.retrieveDraft.status === 'PASSED' &&
    report.steps.sendInvoice.status === 'PASSED' &&
    report.steps.retrievePostSend.status === 'PASSED';

  if (!allPassed) {
    console.error(
      '\n[Stage 02 Result] PayPal Sandbox live verification did NOT complete all steps. See report above for exact blocker/failure.'
    );
    process.exitCode = 1;
    return;
  }

  console.log('\n[Stage 02 Result] All PayPal Sandbox verification steps PASSED.');
}

main().catch((err) => {
  console.error(
    '[Stage 02 Fatal Error]',
    err instanceof Error ? err.message : 'Unexpected error'
  );
  process.exitCode = 1;
});
