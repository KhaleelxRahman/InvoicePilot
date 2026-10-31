import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiApp } from './app.js';
import { loadAppConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

async function startDevServer() {
  const config = loadAppConfig();
  const app = express();
  app.disable('x-powered-by');

  const apiApp = createApiApp(config);
  app.use(apiApp);

  const vite = await createViteServer({
    root: rootDir,
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);

  app.listen(config.port, () => {
    console.log(
      `[InvoicePilot] Stage 1 server listening on ${config.appBaseUrl} (PAYPAL_MODE=${config.paypalMode})`
    );
  });
}

startDevServer().catch((err) => {
  console.error('[InvoicePilot] Failed to start server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
