import { createApp } from '../src/server/app.js';
import { loadAppConfig } from '../src/server/config.js';

// Flag Vercel serverless execution environment before loading config
process.env.VERCEL = process.env.VERCEL || '1';

const config = loadAppConfig();
const app = createApp(config);

export default app;

