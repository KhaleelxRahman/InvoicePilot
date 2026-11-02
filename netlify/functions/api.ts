import serverless from 'serverless-http';
import { createApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';

const config = loadAppConfig();
const app = createApp(config);

// Strip /.netlify/functions/api prefix if forwarded without path rewrite
app.use((req, _res, next) => {
  if (req.url.startsWith('/.netlify/functions/api')) {
    req.url = req.url.replace('/.netlify/functions/api', '/api');
  }
  next();
});

export const handler = serverless(app);
