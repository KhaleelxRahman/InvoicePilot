import serverless from 'serverless-http';
import { createApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';

// Explicitly flag Netlify serverless execution environment
process.env.NETLIFY = 'true';

const config = loadAppConfig();
const app = createApp(config);

export const handler = serverless(app);
