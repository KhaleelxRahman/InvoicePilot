import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApiApp } from './app.js';
import { loadAppConfig } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../client');

const config = loadAppConfig();
const app = express();
app.disable('x-powered-by');

const apiApp = createApiApp(config);
app.use(apiApp);

app.use(express.static(clientDistDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistDir, 'index.html'));
});

app.listen(config.port, () => {
  console.log(
    `[InvoicePilot] Production server listening on ${config.appBaseUrl} (PAYPAL_MODE=${config.paypalMode})`
  );
});
