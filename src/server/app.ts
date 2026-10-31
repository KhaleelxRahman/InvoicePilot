import crypto from 'node:crypto';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { loadAppConfig, type AppConfig } from './config.js';
import { createPayPalAdapter, type PayPalAdapter } from './paypal/adapter.js';
import { openAndMigrateDatabase, STAGE04_SCHEMA_VERSION } from './db/schema.js';
import { DEMO_TENANT_USER_ID, InvoicePilotRepository } from './db/repository.js';

export function createApiApp(
  config: AppConfig = loadAppConfig(),
  paypalAdapter?: PayPalAdapter,
  repository?: InvoicePilotRepository
): Express {
  const app = express();
  const adapter =
    paypalAdapter ??
    createPayPalAdapter({
      mode: config.paypalMode,
      clientId: config.paypalClientId,
      clientSecret: config.paypalClientSecret,
      invoicerEmail: config.paypalInvoicerEmail,
      timeoutMs: config.paypalTimeoutMs
    });

  const repo =
    repository ??
    (() => {
      const db = openAndMigrateDatabase(config.databaseUrl);
      const r = new InvoicePilotRepository(db);
      if (!r.getUserById(DEMO_TENANT_USER_ID)) {
        r.resetAndSeedDemoTenant();
      }
      return r;
    })();

  app.locals.paypalAdapter = adapter;
  app.locals.repository = repo;

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  // Attach correlation request ID to every request
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Stage 1, 3 & 4: Health check route with explicit adapter & database persistence metadata
  app.get('/api/health', (_req: Request, res: Response) => {
    const demoTenantReady = Boolean(repo.getUserById(DEMO_TENANT_USER_ID));
    res.status(200).json({
      status: 'ok',
      service: 'invoicepilot',
      stage: 'stage-04-persistence-ownership',
      environment: config.appEnv,
      paypalMode: adapter.mode,
      isMock: adapter.isMock,
      modeLabel:
        adapter.mode === 'sandbox'
          ? 'PayPal Sandbox Mode (No Live Money)'
          : 'Isolated Mock Mode (Simulated Provider)',
      adapterStatusLabel: adapter.modeLabel,
      sandboxCredentialsConfigured:
        adapter.mode === 'sandbox'
          ? Boolean(config.paypalClientId && config.paypalClientSecret)
          : false,
      databaseEngine: 'sqlite-wal',
      schemaVersion: STAGE04_SCHEMA_VERSION,
      demoTenantReady,
      approvalGateEnforced: true,
      timestamp: new Date().toISOString()
    });
  });

  // Catch-all for unknown /api/* routes using the proposed API.md error shape
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested API endpoint does not exist in Stage 4.',
        requestId: String(res.locals.requestId ?? crypto.randomUUID())
      }
    });
  });

  // Safe error handler that never leaks stack traces or secrets
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        requestId: String(res.locals.requestId ?? crypto.randomUUID())
      }
    });
  });

  return app;
}
