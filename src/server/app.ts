import crypto from 'node:crypto';
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { loadAppConfig, type AppConfig } from './config.js';
import {
  createPayPalAdapter,
  type PayPalAdapter,
  type ProviderConfirmedStatus
} from './paypal/adapter.js';
import {
  formatMinorUnitsToDecimal,
  openAndMigrateDatabase,
  parseDecimalToMinorUnits,
  isPostgresDatabaseUrl,
  STAGE04_SCHEMA_VERSION,
  CURRENT_SCHEMA_VERSION
} from './db/schema.js';
import {
  DEMO_TENANT_USER_ID,
  DEMO_TENANT_EMAIL,
  InvoicePilotRepository,
  OwnershipOrValidationError,
  isValidIsoCalendarDate,
  hashPassword,
  verifyPassword,
  type ApprovalSlipPayload,
  type CreateInvoiceLineItemInput,
  type UserRecord,
  type ReminderTone,
  type ReminderApprovalState,
  type ReminderRecord
} from './db/repository.js';
import { GeminiInvoiceAgent } from './agent/geminiAgent.js';
import { AsyncInvoicePilotRepository } from './db/asyncRepository.js';
import { generateInvoicePdf } from './pdf/invoicePdfGenerator.js';

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    if (name) {
      list[name] = decodeURIComponent(parts.join('=').trim());
    }
  });
  return list;
}

function resolveSessionToken(req: Request): string | null {
  const headerToken = req.header('x-session-token')?.trim();
  if (headerToken) return headerToken;

  const authHeader = req.header('authorization')?.trim();
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const cookies = parseCookies(req.header('cookie'));
  if (cookies.invoicepilot_session) {
    return cookies.invoicepilot_session.trim();
  }

  return null;
}

function setSessionCookie(res: Response, token: string, config: AppConfig): void {
  const isSecure = config.appEnv === 'production';
  const cookieStr = `invoicepilot_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${isSecure ? '; Secure' : ''}; Max-Age=${7 * 86400}`;
  res.setHeader('Set-Cookie', cookieStr);
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    'invoicepilot_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
}

async function resolveOwnerUserId(req: Request, repo: any): Promise<string | null> {
  const token = resolveSessionToken(req);
  if (!token) {
    return null;
  }
  const sessionResult = await repo.getSessionByToken(token);
  if (!sessionResult) {
    return null;
  }
  return sessionResult.user.id;
}

function parseTaxRateBps(body: Record<string, unknown>): number | undefined {
  if (body.taxRateBps !== undefined && body.taxRateBps !== null && body.taxRateBps !== '') {
    const bps = Number(body.taxRateBps);
    if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10000) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'taxRateBps must be an integer between 0 and 10000 (0% to 100%).'
      );
    }
    return bps;
  }

  if (body.taxRatePercent !== undefined && body.taxRatePercent !== null && body.taxRatePercent !== '') {
    const rawStr = String(body.taxRatePercent).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(rawStr)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Tax rate percent must be a non-negative number with at most 2 decimal places.'
      );
    }
    const bps = Math.round(Number.parseFloat(rawStr) * 100);
    if (bps < 0 || bps > 10000) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Tax rate percent must be between 0% and 100%.'
      );
    }
    return bps;
  }

  return undefined;
}

function parseInvoiceItemsInput(
  rawItems: unknown,
  invoiceCurrencyCode: string
): CreateInvoiceLineItemInput[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new OwnershipOrValidationError(
      'VALIDATION_ERROR',
      'An invoice must include at least one line item.'
    );
  }

  const normalizedInvoiceCurrency = (invoiceCurrencyCode ?? 'USD').trim().toUpperCase();

  return rawItems.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Line item ${index + 1} must be a valid object.`
      );
    }
    const itemObj = raw as Record<string, unknown>;
    const description = typeof itemObj.description === 'string' ? itemObj.description : '';
    const quantity = Number(itemObj.quantity);
    const itemCurrency =
      typeof itemObj.currencyCode === 'string' && itemObj.currencyCode.trim()
        ? itemObj.currencyCode.trim().toUpperCase()
        : normalizedInvoiceCurrency;

    let unitAmountMinor: number;
    if (itemObj.unitAmountMinor !== undefined && itemObj.unitAmountMinor !== null && itemObj.unitAmountMinor !== '') {
      unitAmountMinor = Number(itemObj.unitAmountMinor);
    } else if (
      itemObj.unitPriceDecimal !== undefined &&
      itemObj.unitPriceDecimal !== null &&
      String(itemObj.unitPriceDecimal).trim() !== ''
    ) {
      try {
        unitAmountMinor = parseDecimalToMinorUnits(
          String(itemObj.unitPriceDecimal),
          normalizedInvoiceCurrency
        );
      } catch (err) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          err instanceof Error
            ? `Line item ${index + 1}: ${err.message}`
            : `Line item ${index + 1} has an invalid unit price.`
        );
      }
    } else {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Line item ${index + 1} requires unitAmountMinor or unitPriceDecimal.`
      );
    }

    return {
      description,
      quantity,
      unitAmountMinor,
      currencyCode: itemCurrency
    };
  });
}

export interface SharedRateLimitStore {
  consumeRateLimit?: (
    key: string,
    windowMs: number,
    nowMs?: number
  ) => { count: number; resetAt: number } | Promise<{ count: number; resetAt: number }>;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
  code?: string;
  scopePrefix?: string;
  store?: SharedRateLimitStore;
  keyGenerator?: (req: Request) => string;
}

export function createInMemoryRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message, code = 'RATE_LIMITED', scopePrefix = 'global', store } = options;
  const requests = new Map<string, { count: number; resetAt: number }>();

  // Prune expired records every 5 minutes
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now > record.resetAt) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (typeof (cleanupTimer as any).unref === 'function') {
    (cleanupTimer as any).unref();
  }

  function consumeFallbackInMemory(key: string, now: number): { count: number; resetAt: number } {
    let record = requests.get(key);
    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      requests.set(key, record);
    } else {
      record.count += 1;
    }
    return record;
  }

  function applyRateLimitDecision(
    record: { count: number; resetAt: number },
    now: number,
    res: Response,
    next: NextFunction
  ): void {
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      const requestId = String(res.locals?.requestId ?? crypto.randomUUID());
      res.status(429).json({
        error: {
          code,
          message,
          requestId
        }
      });
      return;
    }

    next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.ip || req.socket?.remoteAddress || 'unknown-client';
    const baseKey = options.keyGenerator ? options.keyGenerator(req) : rawIp;
    const scopedKey = `${scopePrefix}:${baseKey}`;
    const now = Date.now();

    if (store && typeof store.consumeRateLimit === 'function') {
      try {
        const resultOrPromise = store.consumeRateLimit(scopedKey, windowMs, now);
        if (resultOrPromise && typeof (resultOrPromise as Promise<any>).then === 'function') {
          (resultOrPromise as Promise<{ count: number; resetAt: number }>)
            .then((record) => {
              applyRateLimitDecision(record, now, res, next);
            })
            .catch(() => {
              // Fail-safe fallback to local in-memory bucket if DB table is unavailable
              const fallbackRecord = consumeFallbackInMemory(scopedKey, now);
              applyRateLimitDecision(fallbackRecord, now, res, next);
            });
          return;
        }
        applyRateLimitDecision(resultOrPromise as { count: number; resetAt: number }, now, res, next);
        return;
      } catch {
        // Fail-safe fallback to local in-memory bucket
        const fallbackRecord = consumeFallbackInMemory(scopedKey, now);
        applyRateLimitDecision(fallbackRecord, now, res, next);
        return;
      }
    }

    const record = consumeFallbackInMemory(scopedKey, now);
    applyRateLimitDecision(record, now, res, next);
  };
}

export function createApiApp(
  config: AppConfig = loadAppConfig(),
  paypalAdapter?: PayPalAdapter,
  repository?: InvoicePilotRepository,
  geminiAgent?: GeminiInvoiceAgent
): Express {
  const app = express();

  // Normalize Netlify Functions URL prefix if invoked via /.netlify/functions/api
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
      const remainder = req.url.slice('/.netlify/functions/api'.length);
      req.url = remainder.startsWith('/') ? `/api${remainder}` : `/api/${remainder}`;
      if (req.url === '/api/' || req.url === '/api') {
        req.url = '/api';
      }
    }
    next();
  });

  const adapter =
    paypalAdapter ??
    createPayPalAdapter({
      mode: config.paypalMode,
      clientId: config.paypalClientId,
      clientSecret: config.paypalClientSecret,
      invoicerEmail: config.paypalInvoicerEmail,
      timeoutMs: config.paypalTimeoutMs
    });

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.NETLIFY === 'true' ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );

  const isDbConfigured = Boolean(
    repository ||
    (config.databaseUrl && (isPostgresDatabaseUrl(config.databaseUrl) || !isServerless))
  );

  let repo: any;

  if (repository) {
    repo = repository;
  } else if (isDbConfigured) {
    const db = openAndMigrateDatabase(config.databaseUrl);
    if (isPostgresDatabaseUrl(config.databaseUrl) && config.databaseUrl !== ':memory-postgres:') {
      repo = new AsyncInvoicePilotRepository(db);
    } else {
      repo = new InvoicePilotRepository(db);
      if (config.appEnv !== 'production' && !isServerless) {
        const existing = repo.getUserByEmail(DEMO_TENANT_EMAIL);
        if (!existing || !existing.passwordHash) {
          repo.resetAndSeedDemoTenant();
        }
      }
    }
  } else {
    // Unconfigured repository placeholder for serverless environments awaiting Supabase DATABASE_URL
    repo = new Proxy({} as InvoicePilotRepository, {
      get(_target, prop) {
        if (prop === 'getUserById') return () => null;
        return () => {
          throw new Error(
            'Database unconfigured: Supabase PostgreSQL connection string (DATABASE_URL) is required in production.'
          );
        };
      }
    });
  }

  const agent =
    geminiAgent ??
    new GeminiInvoiceAgent(repo, {
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
      timeoutMs: config.geminiTimeoutMs,
      maxRetries: config.geminiMaxRetries,
      totalBudgetMs: config.geminiTotalBudgetMs,
      thinkingLevel: config.geminiThinkingLevel,
      providerMode: adapter.mode
    });

  app.locals.paypalAdapter = adapter;
  app.locals.repository = repo;
  app.locals.geminiAgent = agent;
  app.locals.databaseConfigured = isDbConfigured;

  if (config.appEnv === 'production' || isServerless) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');

  // HTTP Security Headers & Content Security Policy
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (config.appEnv === 'production') {
      res.setHeader('X-Frame-Options', 'DENY');
    }
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const frameAncestors = config.appEnv === 'production' ? "'none'" : "*";
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api-m.sandbox.paypal.com https://api.sandbox.paypal.com https://generativelanguage.googleapis.com; frame-ancestors ${frameAncestors};`
    );
    if (config.appEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // CORS & Preflight handling
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.header('origin');
    if (origin) {
      const vercelUrlOrigin = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')}`
        : '';
      const vercelProdOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')}`
        : '';
      const allowedOrigins = [
        config.appBaseUrl.replace(/\/$/, ''),
        'https://invoicepilot-beryl.vercel.app',
        'https://inquisitive-biscochitos-83e042.netlify.app',
        vercelUrlOrigin,
        vercelProdOrigin,
        ...(config.appEnv !== 'production'
          ? [
              'http://localhost:3000',
              'http://localhost:5173',
              'http://127.0.0.1:3000',
              'http://127.0.0.1:5173'
            ]
          : [])
      ].filter(Boolean);

      let isAllowed = false;
      try {
        const parsed = new URL(origin);
        const originNormalized = `${parsed.protocol}//${parsed.host}`;
        const isCloudRunOrGoogle =
          parsed.hostname.endsWith('.run.app') ||
          parsed.hostname.endsWith('.google.com') ||
          parsed.hostname.endsWith('.web.app') ||
          parsed.hostname.endsWith('.firebaseapp.com');
        isAllowed = allowedOrigins.includes(originNormalized) || isCloudRunOrGoogle;
      } catch {
        isAllowed = false;
      }

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-session-token, x-session-user-id, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo'
        );
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (req.method === 'OPTIONS') {
        res.status(isAllowed ? 204 : 403).end();
        return;
      }
    }
    next();
  });

  // Rate Limiters (shared database-backed when database is configured, with fail-safe in-memory fallback)
  const defaultRateLimitMax = config.appEnv === 'test' ? 100 : 20;
  const sharedRateLimitStore = isDbConfigured ? repo : undefined;

  const loginLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_LOGIN_MAX ?? defaultRateLimitMax),
    message: 'Too many login attempts. Please wait a minute before trying again.',
    scopePrefix: 'login',
    store: sharedRateLimitStore
  });

  const registerLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_REGISTER_MAX ?? defaultRateLimitMax),
    message: 'Too many registration requests. Please wait a minute.',
    scopePrefix: 'register',
    store: sharedRateLimitStore
  });

  const agentChatLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AGENT_MAX ?? (config.appEnv === 'test' ? 100 : 30)),
    message: 'AI assistant rate limit exceeded. Please wait a moment.',
    scopePrefix: 'agent-chat',
    store: sharedRateLimitStore
  });

  const agentPrepareLimiter = createInMemoryRateLimiter({
    windowMs: 60 * 1000,
    max: Number(process.env.RATE_LIMIT_AGENT_MAX ?? (config.appEnv === 'test' ? 100 : 30)),
    message: 'AI assistant rate limit exceeded. Please wait a moment.',
    scopePrefix: 'agent-prepare',
    store: sharedRateLimitStore
  });

  app.use(express.json({ limit: '256kb' }));

  // Attach correlation request ID to every request
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = crypto.randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // Intercept requests to database-dependent endpoints when database is unconfigured (e.g. in serverless prior to Supabase setup)
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/health/') {
      return next();
    }
    if (!app.locals.databaseConfigured) {
      res.status(503).json({
        error: 'DATABASE_CONFIGURATION_REQUIRED',
        message:
          'Supabase PostgreSQL database connection (DATABASE_URL) is required for persistent production operations. No database credentials are configured in production environment variables.',
        databaseConfigured: false,
        documentation: 'docs/DATABASE.md'
      });
      return;
    }
    next();
  });

  // Stage 1, 3, 4, 5, 6, 7, 8 & 9: Health check route with explicit adapter, database, Gemini & Auth metadata
  app.get('/api/health', async (req: Request, res: Response, next: NextFunction) => {
    const dbConfigured = Boolean(app.locals.databaseConfigured);
    res.status(200).json({
      status: dbConfigured ? 'ok' : 'degraded',
      service: 'invoicepilot',
      stage: 'stage-09-auth-onboarding',
      environment: config.appEnv,
      authProvider: config.authProvider,
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
      webhookConfigured: Boolean(config.paypalWebhookId),
      geminiConfigured: agent.isConfigured,
      geminiModel: config.geminiModel,
      databaseEngine: dbConfigured
        ? isPostgresDatabaseUrl(config.databaseUrl)
          ? 'postgresql-supabase'
          : 'sqlite-wal'
        : 'unconfigured-supabase',
      databaseConfigured: dbConfigured,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      approvalGateEnforced: true,
      message: dbConfigured
        ? undefined
        : 'Supabase PostgreSQL database connection (DATABASE_URL) is required in production but has not been configured in environment variables.',
      timestamp: new Date().toISOString()
    });
  });

  // Require valid owner session for all protected /api/clients and /api/invoices routes
  async function requireOwner(req: Request, res: Response): Promise<string | null> {
    const explicitHeader = req.header('x-session-user-id');
    if (explicitHeader !== undefined) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access workspace records.',
          requestId: String(res.locals.requestId ?? crypto.randomUUID())
        }
      });
      return null;
    }

    const rawToken = resolveSessionToken(req);
    if (rawToken) {
      const sessionResult = await repo.getSessionByToken(rawToken);
      if (!sessionResult) {
        res.status(401).json({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Your session has expired or is invalid. Please log in again.',
            requestId: String(res.locals.requestId ?? crypto.randomUUID())
          }
        });
        return null;
      }
      return sessionResult.user.id;
    }

    const ownerId = await resolveOwnerUserId(req, repo);
    if (!ownerId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to access workspace records.',
          requestId: String(res.locals.requestId ?? crypto.randomUUID())
        }
      });
      return null;
    }
    return ownerId;
  }

  // ============================================================================
  // Stage 09: Authentication & Demo Session Management (/api/auth/*, /api/demo/reset)
  // ============================================================================
  app.post('/api/auth/register', registerLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';
      const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'A valid email address is required.');
      }
      if (!password || password.length < 8) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Password must be at least 8 characters long.'
        );
      }
      if (!displayName) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Display name is required.');
      }

      const existingUser = await repo.getUserByEmail(email);
      if (existingUser) {
        throw new OwnershipOrValidationError(
          'DUPLICATE_EVENT',
          `A user with email "${email}" already exists.`
        );
      }

      const passwordHash = hashPassword(password);
      const user = await repo.createUser({
        email,
        displayName,
        authProvider: 'session',
        passwordHash,
        isDemo: false
      });

      const { session, rawToken } = await repo.createSession(user.id);
      setSessionCookie(res, rawToken, config);

      const onboarding = await repo.getOnboardingProgress(user.id);

      await repo.appendActivityLog(user.id, {
        actorType: 'user',
        action: 'USER_REGISTERED',
        entityType: 'user',
        entityId: user.id,
        result: 'EXECUTED',
        detail: { email: user.email, displayName: user.displayName },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(201).json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          authProvider: user.authProvider,
          isDemo: user.isDemo,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        sessionToken: rawToken,
        expiresAt: session.expiresAt,
        onboarding
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body.password === 'string' ? body.password : '';

      if (!email || !password) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Email and password are required.');
      }

      const userWithHash = await repo.getUserByEmail(email);
      if (
        !userWithHash ||
        !userWithHash.passwordHash ||
        !verifyPassword(password, userWithHash.passwordHash)
      ) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password credentials.',
            requestId: String(res.locals.requestId ?? crypto.randomUUID())
          }
        });
        return;
      }

      const { session, rawToken } = await repo.createSession(userWithHash.id);
      setSessionCookie(res, rawToken, config);

      const onboarding = await repo.getOnboardingProgress(userWithHash.id);

      await repo.appendActivityLog(userWithHash.id, {
        actorType: 'user',
        action: 'USER_LOGGED_IN',
        entityType: 'user',
        entityId: userWithHash.id,
        result: 'EXECUTED',
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({
        ok: true,
        user: {
          id: userWithHash.id,
          email: userWithHash.email,
          displayName: userWithHash.displayName,
          authProvider: userWithHash.authProvider,
          isDemo: userWithHash.isDemo,
          createdAt: userWithHash.createdAt,
          updatedAt: userWithHash.updatedAt
        },
        sessionToken: rawToken,
        expiresAt: session.expiresAt,
        onboarding
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = resolveSessionToken(req);
      if (!rawToken) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required.',
            requestId: String(res.locals.requestId ?? crypto.randomUUID())
          }
        });
        return;
      }

      const sessionResult = await repo.getSessionByToken(rawToken);
      if (!sessionResult) {
        res.status(401).json({
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired or is invalid.',
            requestId: String(res.locals.requestId ?? crypto.randomUUID())
          }
        });
        return;
      }

      const user = sessionResult.user;
      const expiresAt = sessionResult.session.expiresAt;
      const settings = await repo.getSettings(user.id);
      const onboarding = await repo.getOnboardingProgress(user.id);

      res.status(200).json({
        user,
        isDemo: user.isDemo,
        expiresAt,
        settings,
        onboarding
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = resolveSessionToken(req);
      if (token) {
        await repo.deleteSession(token);
      }
      clearSessionCookie(res);
      res.status(200).json({ ok: true, message: 'Logged out successfully.' });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 09: Onboarding Workflow (/api/onboarding/*)
  // ============================================================================
  app.get('/api/onboarding', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const onboarding = await repo.getOnboardingProgress(ownerId);
      const settings = await repo.getSettings(ownerId);
      const clients = await repo.listClientsForOwner(ownerId);
      res.status(200).json({
        onboarding,
        settings,
        clientCount: clients.length,
        clientsCount: clients.length
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/business-details', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : '';
      const businessEmail = typeof body.businessEmail === 'string' ? body.businessEmail.trim().toLowerCase() : '';
      const defaultCurrency =
        typeof body.defaultCurrency === 'string' && body.defaultCurrency.trim()
          ? body.defaultCurrency.trim().toUpperCase()
          : 'USD';

      if (!businessName) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Business name is required.');
      }
      if (!businessEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'A valid business email address is required.');
      }

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        currentStep: 2,
        businessName,
        businessEmail,
        defaultCurrency
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'ONBOARDING_BUSINESS_DETAILS_SAVED',
        entityType: 'settings',
        entityId: ownerId,
        result: 'EXECUTED',
        detail: { businessName, businessEmail, defaultCurrency },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ onboarding });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/test-sandbox', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const testResult = await adapter.verifyOAuthToken();
      const sandboxTested = testResult.ok;

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        currentStep: 3,
        sandboxTested
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'ONBOARDING_SANDBOX_TESTED',
        entityType: 'settings',
        entityId: ownerId,
        result: sandboxTested ? 'EXECUTED' : 'FAILED',
        detail: {
          mode: adapter.mode,
          isMock: adapter.isMock,
          ok: testResult.ok
        },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({
        onboarding,
        sandboxResult: testResult,
        mode: adapter.mode,
        isMock: adapter.isMock,
        modeLabel: adapter.modeLabel
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;

      let maxInvoiceAmountMinor: number | undefined;
      if (
        body.maxInvoiceAmountMinor !== undefined &&
        body.maxInvoiceAmountMinor !== null &&
        body.maxInvoiceAmountMinor !== ''
      ) {
        const parsed = Number(body.maxInvoiceAmountMinor);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            'maxInvoiceAmountMinor must be a positive integer.'
          );
        }
        maxInvoiceAmountMinor = parsed;
      }

      let defaultReminderTone: 'polite' | 'firm' | 'final' | undefined;
      if (typeof body.defaultReminderTone === 'string') {
        const tone = body.defaultReminderTone.trim().toLowerCase();
        if (tone !== 'polite' && tone !== 'firm' && tone !== 'final') {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            'defaultReminderTone must be "polite", "firm", or "final".'
          );
        }
        defaultReminderTone = tone;
      }

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        currentStep: 4,
        maxInvoiceAmountMinor,
        defaultReminderTone
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'ONBOARDING_PREFERENCES_SAVED',
        entityType: 'settings',
        entityId: ownerId,
        result: 'EXECUTED',
        detail: { maxInvoiceAmountMinor, defaultReminderTone },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ onboarding });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/first-client', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;

      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      const companyName =
        typeof body.companyName === 'string' ? body.companyName.trim() : undefined;
      const defaultCurrency =
        typeof body.defaultCurrency === 'string' && body.defaultCurrency.trim()
          ? body.defaultCurrency.trim().toUpperCase()
          : 'USD';

      if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Client full name and a valid email address are required.'
        );
      }

      const client = await repo.createClient(ownerId, {
        fullName,
        email,
        companyName,
        defaultCurrency
      });

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        currentStep: 5,
        completed: true,
        firstClientId: client.id
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'ONBOARDING_COMPLETED',
        entityType: 'onboarding',
        entityId: ownerId,
        result: 'EXECUTED',
        detail: { firstClientId: client.id, clientName: client.fullName },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(201).json({ client, onboarding });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/skip', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        skipped: true,
        completed: true
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'ONBOARDING_SKIPPED',
        entityType: 'onboarding',
        entityId: ownerId,
        result: 'INFO',
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({
        ok: true,
        message: 'Onboarding skipped. You can configure settings and clients anytime.',
        onboarding
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/complete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        completed: true
      });

      res.status(200).json({ ok: true, onboarding });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/onboarding/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const onboarding = await repo.updateOnboardingProgress(ownerId, {
        currentStep: 1,
        completed: false,
        skipped: false
      });

      res.status(200).json({ ok: true, onboarding });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 10: Settings, Notifications & Data Export
  // ============================================================================
  app.get('/api/settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const settings = await repo.getSettings(ownerId);
      const onboarding = await repo.getOnboardingProgress(ownerId);
      res.status(200).json({
        settings,
        onboarding,
        providerMode: adapter.mode,
        isMock: adapter.isMock,
        modeLabel: adapter.modeLabel
      });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/settings', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;

      const patch: {
        businessName?: string;
        businessEmail?: string;
        defaultCurrency?: string;
        maxInvoiceAmountMinor?: number;
        defaultPaymentTermsDays?: number;
      } = {};

      if (typeof body.businessName === 'string') patch.businessName = body.businessName.trim();
      if (typeof body.businessEmail === 'string') patch.businessEmail = body.businessEmail.trim().toLowerCase();
      if (typeof body.defaultCurrency === 'string') patch.defaultCurrency = body.defaultCurrency.trim().toUpperCase();
      if (typeof body.maxInvoiceAmountMinor === 'number') patch.maxInvoiceAmountMinor = body.maxInvoiceAmountMinor;
      if (typeof body.defaultPaymentTermsDays === 'number') patch.defaultPaymentTermsDays = body.defaultPaymentTermsDays;

      const updated = await repo.updateSettings(ownerId, patch);

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'SETTINGS_UPDATED',
        entityType: 'settings',
        entityId: ownerId,
        result: 'EXECUTED',
        detail: patch,
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ ok: true, settings: updated });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/notifications', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const notifications = await repo.listNotificationsForOwner(ownerId);
      res.status(200).json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/notifications/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      await repo.markAllNotificationsAsRead(ownerId);
      res.status(200).json({ ok: true, message: 'All notifications marked as read.' });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/notifications/:id/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const notifId = String(req.params.id ?? '');
      await repo.markNotificationAsRead(ownerId, notifId);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/export', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const user = await repo.getUserById(ownerId);
      const settings = await repo.getSettings(ownerId);
      const onboarding = await repo.getOnboardingProgress(ownerId);
      const clients = await repo.listClientsForOwner(ownerId);
      const invoices = await repo.listInvoicesForOwner(ownerId);
      const activity = await repo.listActivityForOwner(ownerId);
      const notifications = await repo.listNotificationsForOwner(ownerId);

      const exportBundle = {
        exportedAt: new Date().toISOString(),
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              authProvider: user.authProvider,
              isDemo: user.isDemo,
              createdAt: user.createdAt
            }
          : null,
        settings,
        onboarding,
        clients,
        invoices,
        activity,
        notifications
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoicepilot-export-${ownerId}-${Date.now()}.json"`
      );
      res.status(200).json(exportBundle);
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 05: Clients CRUD (/api/clients, /api/clients/:id)
  // ============================================================================
  app.get('/api/clients', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const clients = await repo.listClientsForOwner(ownerId);
      res.status(200).json({ clients });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/clients', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const client = await repo.createClient(ownerId, {
        fullName: typeof body.fullName === 'string' ? body.fullName : '',
        companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
        email: typeof body.email === 'string' ? body.email : '',
        defaultCurrency: typeof body.defaultCurrency === 'string' ? body.defaultCurrency : 'USD',
        notes: typeof body.notes === 'string' ? body.notes : undefined
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'CLIENT_CREATED',
        entityType: 'client',
        entityId: client.id,
        result: 'EXECUTED',
        detail: { fullName: client.fullName, email: client.email },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(201).json({ client });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const clientId = String(req.params.id ?? '');
      const client = await repo.getClientForOwner(ownerId, clientId);
      const invoices = await repo.listInvoicesForClient(ownerId, clientId);
      res.status(200).json({ client, invoices });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const clientId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const client = await repo.updateClientForOwner(ownerId, clientId, {
        fullName: typeof body.fullName === 'string' ? body.fullName : undefined,
        companyName: typeof body.companyName === 'string' ? body.companyName : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        defaultCurrency: typeof body.defaultCurrency === 'string' ? body.defaultCurrency : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'CLIENT_UPDATED',
        entityType: 'client',
        entityId: client.id,
        result: 'EXECUTED',
        detail: { fullName: client.fullName, email: client.email },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ client });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/clients/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const clientId = String(req.params.id ?? '');
      await repo.deleteClientForOwner(ownerId, clientId);

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'CLIENT_DELETED',
        entityType: 'client',
        entityId: clientId,
        result: 'EXECUTED',
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ deleted: true, clientId });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 05: Conventional Invoices Draft Workflow (/api/invoices, /api/invoices/:id)
  // Server recalculates all totals; draft creation/editing never sends to PayPal.
  // ============================================================================
  app.get('/api/invoices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const clientIdFilter =
        typeof req.query.clientId === 'string' && req.query.clientId.trim()
          ? req.query.clientId.trim()
          : null;
      const invoices = clientIdFilter
        ? await repo.listInvoicesForClient(ownerId, clientIdFilter)
        : await repo.listInvoicesForOwner(ownerId);
      res.status(200).json({ invoices });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/invoices', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const currencyCode =
        typeof body.currencyCode === 'string' && body.currencyCode.trim()
          ? body.currencyCode.trim().toUpperCase()
          : 'USD';

      const taxRateBps = parseTaxRateBps(body) ?? 0;
      const items = parseInvoiceItemsInput(body.items, currencyCode);

      const invoice = await repo.createInvoiceDraft(ownerId, {
        clientId: typeof body.clientId === 'string' ? body.clientId : '',
        invoiceNumber: typeof body.invoiceNumber === 'string' ? body.invoiceNumber : '',
        currencyCode,
        taxRateBps,
        issueDate: typeof body.issueDate === 'string' ? body.issueDate : '',
        dueDate: typeof body.dueDate === 'string' ? body.dueDate : '',
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        providerMode: adapter.mode,
        items
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'INVOICE_DRAFT_CREATED',
        entityType: 'invoice',
        entityId: invoice.id,
        result: 'EXECUTED',
        detail: {
          invoiceNumber: invoice.invoiceNumber,
          currencyCode: invoice.currencyCode,
          totalMinor: invoice.totalMinor,
          localStatus: invoice.localStatus,
          providerStatus: invoice.providerStatus
        },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(201).json({ invoice });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId = String(req.params.id ?? '');
      const invoice = await repo.getInvoiceForOwner(ownerId, invoiceId);
      const client = await repo.getClientForOwner(ownerId, invoice.clientId);
      res.status(200).json({ invoice, client });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/invoices/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId = String(req.params.id ?? '');
      const invoice = await repo.getInvoiceForOwner(ownerId, invoiceId);
      const client = await repo.getClientForOwner(ownerId, invoice.clientId);
      const settings = typeof repo.getSettingsForOwner === 'function'
        ? await repo.getSettingsForOwner(ownerId)
        : null;

      const pdfBuffer = generateInvoicePdf({ invoice, client, settings });
      const safeInvoiceNum = (invoice.invoiceNumber || invoice.id).replace(/[^a-zA-Z0-9_-]/g, '_');

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Invoice-${safeInvoiceNum}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/invoices/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId = String(req.params.id ?? '');
      const existing = await repo.getInvoiceForOwner(ownerId, invoiceId);
      const body = (req.body ?? {}) as Record<string, unknown>;

      const nextCurrency =
        typeof body.currencyCode === 'string' && body.currencyCode.trim()
          ? body.currencyCode.trim().toUpperCase()
          : existing.currencyCode;

      const taxRateBps = parseTaxRateBps(body);
      const items =
        body.items !== undefined ? parseInvoiceItemsInput(body.items, nextCurrency) : undefined;

      const invoice = await repo.updateInvoiceDraftForOwner(ownerId, invoiceId, {
        clientId: typeof body.clientId === 'string' ? body.clientId : undefined,
        invoiceNumber: typeof body.invoiceNumber === 'string' ? body.invoiceNumber : undefined,
        currencyCode: typeof body.currencyCode === 'string' ? nextCurrency : undefined,
        taxRateBps,
        issueDate: typeof body.issueDate === 'string' ? body.issueDate : undefined,
        dueDate: typeof body.dueDate === 'string' ? body.dueDate : undefined,
        notes: typeof body.notes === 'string' ? body.notes : undefined,
        items
      });

      await repo.appendActivityLog(ownerId, {
        actorType: 'user',
        action: 'INVOICE_DRAFT_UPDATED',
        entityType: 'invoice',
        entityId: invoice.id,
        result: 'EXECUTED',
        detail: {
          invoiceNumber: invoice.invoiceNumber,
          currencyCode: invoice.currencyCode,
          totalMinor: invoice.totalMinor
        },
        correlationId: String(res.locals.requestId ?? '')
      });

      res.status(200).json({ invoice });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 06: Approval Slip & Server-Enforced Action State Machine
  // (`DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED`)
  // ============================================================================
  function safeParseSlipPayload(payloadJson: string): ApprovalSlipPayload | null {
    try {
      return JSON.parse(payloadJson) as ApprovalSlipPayload;
    } catch {
      return null;
    }
  }

  app.get('/api/actions', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId =
        typeof req.query.invoiceId === 'string' && req.query.invoiceId.trim()
          ? req.query.invoiceId.trim()
          : undefined;
      const rawActions = (await repo.listPendingActionsForOwner(ownerId, invoiceId)) as any[];
      const actions = rawActions.map((a: any) => ({
        ...a,
        slip: safeParseSlipPayload(a.payloadJson)
      }));
      res.status(200).json({ actions });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/actions/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const actionId = String(req.params.id ?? '');
      const action = await repo.getPendingActionForOwner(ownerId, actionId);
      const invoice = await repo.getInvoiceForOwner(ownerId, action.targetInvoiceId);
      const client = await repo.getClientForOwner(ownerId, invoice.clientId);
      const slip =
        safeParseSlipPayload(action.payloadJson) ??
        await repo.buildApprovalSlipPayload(ownerId, invoice.id, adapter.mode).slip;
      res.status(200).json({ action, slip, invoice, client });
    } catch (err) {
      next(err);
    }
  });

  async function handleCreateApprovalRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const invoiceId =
        typeof req.params.id === 'string' && req.params.id.trim()
          ? req.params.id.trim()
          : typeof body.invoiceId === 'string'
            ? body.invoiceId.trim()
            : '';

      if (!invoiceId) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'invoiceId is required to generate an approval slip.'
        );
      }

      const expiresAt =
        typeof body.expiresAt === 'string' && body.expiresAt.trim()
          ? body.expiresAt.trim()
          : undefined;

      const { action, slip } = await repo.requestInvoiceSendApproval(ownerId, invoiceId, {
        providerMode: adapter.mode,
        expiresAt,
        correlationId: String(res.locals.requestId ?? '')
      });

      const invoice = await repo.getInvoiceForOwner(ownerId, invoiceId);
      if (typeof repo.createNotification === 'function') {
        const totalStr = formatMinorUnitsToDecimal(invoice.totalMinor, invoice.currencyCode);
        await repo.createNotification(ownerId, {
          title: 'Approval slip ready',
          body: `Approval slip prepared for invoice ${invoice.invoiceNumber} (${totalStr} ${invoice.currencyCode}). Review and approve before dispatch.`
        });
      }
      res.status(201).json({ action, slip, invoice });
    } catch (err) {
      next(err);
    }
  }

  app.post('/api/actions', handleCreateApprovalRequest);
  app.post('/api/invoices/:id/approval-request', handleCreateApprovalRequest);

  app.post('/api/actions/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const actionId = String(req.params.id ?? '');
      const action = await repo.approvePendingAction(
        ownerId,
        actionId,
        String(res.locals.requestId ?? '')
      );
      const invoice = await repo.getInvoiceForOwner(ownerId, action.targetInvoiceId);
      const slip =
        safeParseSlipPayload(action.payloadJson) ??
        await repo.buildApprovalSlipPayload(ownerId, invoice.id, adapter.mode).slip;
      res.status(200).json({ action, slip, invoice });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/actions/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const actionId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason =
        typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim()
          : 'Discarded by user during approval review.';
      const action = await repo.rejectPendingAction(
        ownerId,
        actionId,
        reason,
        String(res.locals.requestId ?? '')
      );
      const invoice = await repo.getInvoiceForOwner(ownerId, action.targetInvoiceId);
      const slip = safeParseSlipPayload(action.payloadJson);
      res.status(200).json({ action, slip, invoice });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 06 & Stage 08: Server-Enforced Execution, Timeout Reconciliation & Status Sync
  // ============================================================================
  async function executeApprovedAction(
    ownerId: string,
    actionId: string,
    requestId: string,
    res: Response
  ): Promise<void> {
    const { action, invoice, client } = await repo.beginActionExecution(
      ownerId,
      actionId,
      requestId
    );

    let providerInvoiceId = invoice.providerInvoiceId;

    // Step 1: If a providerInvoiceId already exists (e.g., from an earlier execution that timed out),
    // reconcile against the provider first to prevent duplicate drafts or duplicate sends.
    if (providerInvoiceId) {
      const preReconcile = await adapter.retrieveInvoice(providerInvoiceId);
      if (preReconcile.ok) {
        const currentStatus = preReconcile.data.providerStatus;
        if (
          currentStatus === 'SENT' ||
          currentStatus === 'UNPAID' ||
          currentStatus === 'PAID' ||
          currentStatus === 'MARKED_AS_PAID'
        ) {
          const completed = await repo.completeActionExecutionSuccess(
            ownerId,
            action.id,
            {
              providerMode: adapter.mode,
              isMock: adapter.isMock,
              providerInvoiceId,
              providerStatus: currentStatus,
              recipientViewUrl: preReconcile.data.recipientViewUrl,
              invoicerViewUrl: preReconcile.data.invoicerViewUrl
            },
            requestId
          );

          await repo.appendActivityLog(ownerId, {
            actorType: 'system',
            action: 'PROVIDER_TIMEOUT_RECONCILED',
            entityType: 'invoice',
            entityId: invoice.id,
            result: 'EXECUTED',
            detail: {
              actionId: action.id,
              providerInvoiceId,
              providerStatus: currentStatus,
              stage: 'pre_send_reconcile'
            },
            correlationId: requestId
          });

          res.status(200).json({
            action: completed.action,
            invoice: completed.invoice,
            providerResult: {
              mode: adapter.mode,
              isMock: adapter.isMock,
              modeLabel: adapter.modeLabel,
              providerInvoiceId,
              providerStatus: currentStatus,
              recipientViewUrl: preReconcile.data.recipientViewUrl,
              invoicerViewUrl: preReconcile.data.invoicerViewUrl,
              reconciledAfterTimeout: true
            }
          });
          return;
        }
      }
    }

    // Step 2: Create provider draft only if we do not already have a reconciled DRAFT providerInvoiceId
    if (!providerInvoiceId) {
      const adapterItems = invoice.items.map((it: any) => ({
        name: it.description.slice(0, 120),
        description: it.description,
        quantity: String(it.quantity),
        unitAmountValue: formatMinorUnitsToDecimal(it.unitAmountMinor, invoice.currencyCode),
        currencyCode: invoice.currencyCode
      }));

      if (invoice.taxMinor > 0) {
        adapterItems.push({
          name: `Tax (${(invoice.taxRateBps / 100).toFixed(2)}%)`,
          description: 'Calculated invoice tax',
          quantity: '1',
          unitAmountValue: formatMinorUnitsToDecimal(invoice.taxMinor, invoice.currencyCode),
          currencyCode: invoice.currencyCode
        });
      }

      const nameParts = client.fullName.trim().split(/\s+/);
      const givenName = nameParts[0] || 'Client';
      const surname = nameParts.slice(1).join(' ') || 'Recipient';

      const draftResult = await adapter.createDraftInvoice({
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currencyCode: invoice.currencyCode,
        recipientEmail: client.email,
        recipientGivenName: givenName,
        recipientSurname: surname,
        note: invoice.notes,
        items: adapterItems,
        idempotencyKey: `${action.idempotencyKey}-create`
      });

      if (!draftResult.ok) {
        const failureMessage =
          draftResult.error.code === 'CREDENTIALS_MISSING'
            ? `Action unavailable in current mode (${draftResult.mode}): ${draftResult.error.message}`
            : draftResult.error.message;
        const failedAction = await repo.completeActionExecutionFailure(
          ownerId,
          action.id,
          failureMessage,
          {
            errorCode: draftResult.error.code,
            providerMode: draftResult.mode,
            isMock: draftResult.isMock,
            reconcileRequired: draftResult.error.reconcileRequired
          },
          requestId
        );
        const status =
          draftResult.error.code === 'CREDENTIALS_MISSING'
            ? 503
            : draftResult.error.code === 'TIMEOUT_RECONCILE_REQUIRED'
              ? 504
              : 502;
        res.status(status).json({
          error: {
            code: draftResult.error.code,
            message: failureMessage,
            mode: draftResult.mode,
            isMock: draftResult.isMock,
            modeLabel: draftResult.modeLabel,
            reconcileRequired: draftResult.error.reconcileRequired,
            requestId
          },
          action: failedAction,
          invoice: await repo.getInvoiceForOwner(ownerId, invoice.id)
        });
        return;
      }

      providerInvoiceId = draftResult.data.providerInvoiceId;

      // Immediately persist the draft providerInvoiceId before calling sendInvoice
      // so any subsequent network timeout on send can be safely reconciled.
      await repo.recordProviderInvoiceSync(ownerId, invoice.id, {
        providerMode: adapter.mode,
        providerInvoiceId,
        providerStatus: draftResult.data.providerStatus
      });
    }

    // Step 3: Send the invoice via the configured PayPal adapter
    const sendResult = await adapter.sendInvoice({
      providerInvoiceId,
      idempotencyKey: `${action.idempotencyKey}-send`
    });

    if (!sendResult.ok) {
      // If the send call timed out or requires reconciliation, query the provider state immediately
      // before reporting failure — if the provider actually sent the invoice, complete as EXECUTED!
      if (
        sendResult.error.code === 'TIMEOUT_RECONCILE_REQUIRED' ||
        sendResult.error.reconcileRequired
      ) {
        const reconcileRes = await adapter.retrieveInvoice(providerInvoiceId);
        if (
          reconcileRes.ok &&
          (reconcileRes.data.providerStatus === 'SENT' ||
            reconcileRes.data.providerStatus === 'UNPAID' ||
            reconcileRes.data.providerStatus === 'PAID' ||
            reconcileRes.data.providerStatus === 'MARKED_AS_PAID')
        ) {
          const completed = await repo.completeActionExecutionSuccess(
            ownerId,
            action.id,
            {
              providerMode: adapter.mode,
              isMock: adapter.isMock,
              providerInvoiceId,
              providerStatus: reconcileRes.data.providerStatus,
              recipientViewUrl: reconcileRes.data.recipientViewUrl,
              invoicerViewUrl: reconcileRes.data.invoicerViewUrl
            },
            requestId
          );

          await repo.appendActivityLog(ownerId, {
            actorType: 'system',
            action: 'PROVIDER_TIMEOUT_RECONCILED',
            entityType: 'invoice',
            entityId: invoice.id,
            result: 'EXECUTED',
            detail: {
              actionId: action.id,
              providerInvoiceId,
              providerStatus: reconcileRes.data.providerStatus,
              stage: 'post_send_timeout_reconcile'
            },
            correlationId: requestId
          });

          res.status(200).json({
            action: completed.action,
            invoice: completed.invoice,
            providerResult: {
              mode: adapter.mode,
              isMock: adapter.isMock,
              modeLabel: adapter.modeLabel,
              providerInvoiceId,
              providerStatus: reconcileRes.data.providerStatus,
              recipientViewUrl: reconcileRes.data.recipientViewUrl,
              invoicerViewUrl: reconcileRes.data.invoicerViewUrl,
              reconciledAfterTimeout: true
            }
          });
          return;
        }
      }

      const failedAction = await repo.completeActionExecutionFailure(
        ownerId,
        action.id,
        sendResult.error.message,
        {
          errorCode: sendResult.error.code,
          providerInvoiceId,
          providerMode: sendResult.mode,
          isMock: sendResult.isMock,
          reconcileRequired: sendResult.error.reconcileRequired
        },
        requestId
      );
      const httpStatus =
        sendResult.error.code === 'TIMEOUT_RECONCILE_REQUIRED' ? 504 : 502;
      res.status(httpStatus).json({
        error: {
          code: sendResult.error.code,
          message: sendResult.error.message,
          mode: sendResult.mode,
          isMock: sendResult.isMock,
          modeLabel: sendResult.modeLabel,
          providerInvoiceId,
          reconcileRequired: sendResult.error.reconcileRequired,
          requestId
        },
        action: failedAction,
        invoice: await repo.getInvoiceForOwner(ownerId, invoice.id)
      });
      return;
    }

    const retrieveResult = await adapter.retrieveInvoice(providerInvoiceId);
    const finalSnapshot = retrieveResult.ok ? retrieveResult.data : sendResult.data;

    const completed = await repo.completeActionExecutionSuccess(
      ownerId,
      action.id,
      {
        providerMode: adapter.mode,
        isMock: adapter.isMock,
        providerInvoiceId,
        providerStatus: finalSnapshot.providerStatus,
        recipientViewUrl: finalSnapshot.recipientViewUrl,
        invoicerViewUrl: finalSnapshot.invoicerViewUrl
      },
      requestId
    );

    if (typeof repo.createNotification === 'function') {
      const modeLabel = adapter.mode === 'sandbox' ? 'PayPal Sandbox' : 'PayPal Mock';
      const totalStr = formatMinorUnitsToDecimal(completed.invoice.totalMinor, completed.invoice.currencyCode);
      await repo.createNotification(ownerId, {
        title: `Invoice sent via ${modeLabel}`,
        body: `Invoice ${completed.invoice.invoiceNumber} (${totalStr} ${completed.invoice.currencyCode}) was dispatched to ${client.email}.`
      });
    }

    res.status(200).json({
      action: completed.action,
      invoice: completed.invoice,
      providerResult: {
        mode: adapter.mode,
        isMock: adapter.isMock,
        modeLabel: adapter.modeLabel,
        providerInvoiceId,
        providerStatus: finalSnapshot.providerStatus,
        recipientViewUrl: finalSnapshot.recipientViewUrl,
        invoicerViewUrl: finalSnapshot.invoicerViewUrl
      }
    });
  }

  app.post('/api/actions/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const actionId = String(req.params.id ?? '');
      const requestId = String(res.locals.requestId ?? crypto.randomUUID());
      await executeApprovedAction(ownerId, actionId, requestId, res);
    } catch (err) {
      next(err);
    }
  });

  // Stage 08: Invoice-scoped send endpoint that strictly enforces an APPROVED pending action
  app.post('/api/invoices/:id/paypal/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId = String(req.params.id ?? '').trim();
      const requestId = String(res.locals.requestId ?? crypto.randomUUID());

      // Verify ownership of the invoice first
      await repo.getInvoiceForOwner(ownerId, invoiceId);

      const body = (req.body ?? {}) as Record<string, unknown>;
      const requestedActionId =
        typeof body.actionId === 'string' && body.actionId.trim()
          ? body.actionId.trim()
          : undefined;

      let targetActionId = requestedActionId;
      if (targetActionId) {
        const action = await repo.getPendingActionForOwner(ownerId, targetActionId);
        if (action.targetInvoiceId !== invoiceId) {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            `Action "${targetActionId}" does not belong to invoice "${invoiceId}".`
          );
        }
      } else {
        const actions = (await repo.listPendingActionsForOwner(ownerId, invoiceId)) as any[];
        const approved = actions.find((a: any) => a.state === 'APPROVED');
        if (!approved) {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            'Explicit human approval on the Approval Slip is required before sending an invoice to PayPal.'
          );
        }
        targetActionId = approved.id;
      }

      if (!targetActionId) {
        throw new OwnershipOrValidationError('VALIDATION_ERROR', 'No approved action found to execute.');
      }
      await executeApprovedAction(ownerId, targetActionId, requestId, res);
    } catch (err) {
      next(err);
    }
  });

  // Stage 08: Retrieve / Refresh provider status against PayPal (`GET /v2/invoicing/invoices/{id}`)
  app.post('/api/invoices/:id/paypal/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const invoiceId = String(req.params.id ?? '').trim();
      const requestId = String(res.locals.requestId ?? crypto.randomUUID());

      const invoice = await repo.getInvoiceForOwner(ownerId, invoiceId);
      if (!invoice.providerInvoiceId) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Cannot refresh PayPal status because this invoice has not been created on PayPal yet.'
        );
      }

      const retrieveResult = await adapter.retrieveInvoice(invoice.providerInvoiceId);
      if (!retrieveResult.ok) {
        await repo.appendActivityLog(ownerId, {
          actorType: 'user',
          action: 'INVOICE_PROVIDER_REFRESH_FAILED',
          entityType: 'invoice',
          entityId: invoice.id,
          result: 'FAILED',
          detail: {
            providerInvoiceId: invoice.providerInvoiceId,
            errorCode: retrieveResult.error.code,
            message: retrieveResult.error.message,
            providerMode: retrieveResult.mode,
            isMock: retrieveResult.isMock
          },
          correlationId: requestId
        });

        const status =
          retrieveResult.error.code === 'CREDENTIALS_MISSING'
            ? 503
            : retrieveResult.error.code === 'TIMEOUT_RECONCILE_REQUIRED'
              ? 504
              : 502;
        res.status(status).json({
          error: {
            code: retrieveResult.error.code,
            message: retrieveResult.error.message,
            mode: retrieveResult.mode,
            isMock: retrieveResult.isMock,
            modeLabel: retrieveResult.modeLabel,
            requestId
          },
          invoice
        });
        return;
      }

      const updatedInvoice = await repo.refreshInvoiceProviderStatus(
        ownerId,
        invoice.id,
        {
          providerMode: retrieveResult.mode,
          isMock: retrieveResult.isMock,
          providerInvoiceId: retrieveResult.data.providerInvoiceId,
          providerStatus: retrieveResult.data.providerStatus,
          recipientViewUrl: retrieveResult.data.recipientViewUrl,
          invoicerViewUrl: retrieveResult.data.invoicerViewUrl
        },
        requestId
      );

      res.status(200).json({
        invoice: updatedInvoice,
        providerSnapshot: retrieveResult.data,
        mode: retrieveResult.mode,
        isMock: retrieveResult.isMock,
        modeLabel: retrieveResult.modeLabel
      });
    } catch (err) {
      next(err);
    }
  });

  // Stage 12: Record Partial or Full Payment against an invoice
  app.post('/api/invoices/:id/partial-payment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const invoiceId = String(req.params.id);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const amountMinor = Number(body.amountMinor);

      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'amountMinor must be a positive integer in minor currency units.'
        );
      }

      const updated = await repo.recordPartialPayment(ownerId, invoiceId, amountMinor);
      res.status(200).json({ ok: true, invoice: updated });
    } catch (err) {
      next(err);
    }
  });

  // Mark Invoice as Completed (Operational completion workflow)
  const handleMarkInvoiceCompleted = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const invoiceId = String(req.params.id ?? '').trim();
      const updated = await repo.markInvoiceCompleted(ownerId, invoiceId);

      if (typeof repo.createNotification === 'function') {
        await repo.createNotification(ownerId, {
          title: 'Invoice marked completed',
          body: `Invoice ${updated.invoiceNumber} has been marked as operationally completed.`
        });
      }

      res.status(200).json({ ok: true, invoice: updated });
    } catch (err) {
      next(err);
    }
  };

  app.post('/api/invoices/:id/complete', handleMarkInvoiceCompleted);
  app.post('/api/invoices/:id/mark-completed', handleMarkInvoiceCompleted);

  // Stage 08: PayPal Webhook Signature Verification & Idempotent Deduplication
  app.post('/api/webhooks/paypal', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = String(res.locals.requestId ?? crypto.randomUUID());
      const body = (req.body ?? {}) as Record<string, unknown>;
      const eventId = typeof body.id === 'string' ? body.id.trim() : '';
      const eventType = typeof body.event_type === 'string' ? body.event_type.trim() : '';
      const resource =
        body.resource && typeof body.resource === 'object'
          ? (body.resource as Record<string, unknown>)
          : null;

      if (!eventId || !eventType || !resource) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Webhook payload must include id, event_type, and resource.'
        );
      }

      // Extract invoice ID from either `resource.invoice.id` or `resource.id`
      const nestedInvoice =
        resource.invoice && typeof resource.invoice === 'object'
          ? (resource.invoice as Record<string, unknown>)
          : null;
      const resourceId =
        typeof nestedInvoice?.id === 'string' && nestedInvoice.id.trim()
          ? nestedInvoice.id.trim()
          : typeof resource.id === 'string' && resource.id.trim()
            ? resource.id.trim()
            : undefined;

      const transmissionId = String(req.header('paypal-transmission-id') ?? '').trim();
      const transmissionTime = String(req.header('paypal-transmission-time') ?? '').trim();
      const transmissionSig = String(req.header('paypal-transmission-sig') ?? '').trim();
      const certUrl = String(req.header('paypal-cert-url') ?? '').trim();
      const authAlgo = String(req.header('paypal-auth-algo') ?? '').trim();
      const webhookId = (config.paypalWebhookId ?? '').trim();

      const verifyFn = adapter.verifyWebhookSignature?.bind(adapter);
      const verifyResult = verifyFn
        ? await verifyFn({
            authAlgo,
            certUrl,
            transmissionId,
            transmissionSig,
            transmissionTime,
            webhookId,
            webhookEvent: body
          })
        : null;

      const isSignatureVerified =
        verifyResult !== null &&
        verifyResult.ok &&
        verifyResult.data.verificationStatus === 'SUCCESS';

      if (!isSignatureVerified) {
        // Record rejected webhook event without modifying any invoice state
        await repo.recordWebhookEvent({
          providerEventId: `${eventId}:rejected:${requestId}`,
          eventType,
          relatedProviderInvoiceId: resourceId,
          verificationStatus: 'REJECTED',
          processingStatus: 'IGNORED',
          payload: body
        });

        res.status(400).json({
          error: {
            code: 'WEBHOOK_SIGNATURE_INVALID',
            message:
              'PayPal webhook signature verification failed or required verification headers/webhookId are missing. Unverified webhook bodies are never trusted.',
            requestId
          }
        });
        return;
      }

      const recorded = await repo.recordWebhookEvent({
        providerEventId: eventId,
        eventType,
        relatedProviderInvoiceId: resourceId,
        verificationStatus: 'VERIFIED',
        processingStatus: 'PROCESSED',
        payload: body
      });

      if (recorded.deduplicated) {
        res.status(200).json({
          received: true,
          deduplicated: true,
          webhookEventId: eventId
        });
        return;
      }

      let updatedInvoiceId: string | undefined;
      if (resourceId) {
        const matched = await repo.findInvoiceByProviderInvoiceId(resourceId);
        if (matched) {
          const rawResourceStatus =
            typeof nestedInvoice?.status === 'string'
              ? nestedInvoice.status
              : typeof resource.status === 'string'
                ? resource.status
                : '';

          let mappedStatus: ProviderConfirmedStatus = 'UNKNOWN';
          const upperStatus = rawResourceStatus.trim().toUpperCase();
          if (
            upperStatus === 'DRAFT' ||
            upperStatus === 'SENT' ||
            upperStatus === 'UNPAID' ||
            upperStatus === 'PAID' ||
            upperStatus === 'MARKED_AS_PAID' ||
            upperStatus === 'CANCELLED' ||
            upperStatus === 'REFUNDED'
          ) {
            mappedStatus = upperStatus as ProviderConfirmedStatus;
          } else if (eventType === 'INVOICING.INVOICE.PAID') {
            mappedStatus = 'PAID';
          } else if (eventType === 'INVOICING.INVOICE.CANCELLED') {
            mappedStatus = 'CANCELLED';
          } else if (eventType === 'INVOICING.INVOICE.REFUNDED') {
            mappedStatus = 'REFUNDED';
          } else if (eventType === 'INVOICING.INVOICE.SENT') {
            mappedStatus = 'SENT';
          }

          if (mappedStatus !== 'UNKNOWN') {
            const refreshed = await repo.refreshInvoiceProviderStatus(
              matched.ownerUserId,
              matched.id,
              {
                providerMode: adapter.mode,
                isMock: adapter.isMock,
                providerInvoiceId: resourceId,
                providerStatus: mappedStatus,
                recipientViewUrl: matched.providerRecipientViewUrl,
                invoicerViewUrl: matched.providerInvoicerViewUrl
              },
              requestId
            );
            updatedInvoiceId = refreshed.id;

            await repo.appendActivityLog(matched.ownerUserId, {
              actorType: 'provider',
              action: 'WEBHOOK_EVENT_PROCESSED',
              entityType: 'invoice',
              entityId: matched.id,
              result: 'EXECUTED',
              detail: {
                webhookEventId: eventId,
                eventType,
                providerInvoiceId: resourceId,
                providerStatus: mappedStatus
              },
              correlationId: requestId
            });
          }
        }
      }

      res.status(200).json({
        received: true,
        deduplicated: false,
        webhookEventId: eventId,
        updatedInvoiceId
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/activity', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const activities = await repo.listActivityForOwner(ownerId);
      res.status(200).json({ activities });
    } catch (err) {
      next(err);
    }
  });

  // ============================================================================
  // Stage 07: Constrained Gemini Structured Agent (/api/agent/prepare-invoice & /api/agent/chat)
  // ============================================================================
  const handleAgentTurn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const prompt = typeof body.prompt === 'string' ? body.prompt : '';
      const idempotencyKey =
        typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
          ? body.idempotencyKey.trim()
          : req.header('x-idempotency-key')?.trim() || undefined;
      const requestId = String(res.locals.requestId ?? crypto.randomUUID());

      const outcome = await agent.processPrompt(ownerId, {
        prompt,
        idempotencyKey,
        correlationId: requestId
      });

      res.status(200).json(outcome);
    } catch (err) {
      next(err);
    }
  };

  app.post('/api/agent/prepare-invoice', agentPrepareLimiter, async (req: Request, res: Response, next: NextFunction) => {
    void handleAgentTurn(req, res, next);
  });

  app.post('/api/agent/chat', agentChatLimiter, async (req: Request, res: Response, next: NextFunction) => {
    void handleAgentTurn(req, res, next);
  });

  // ============================================================================
  // Stage 11: Reminders & Client Tone Workflow
  // ============================================================================

  app.post('/api/invoices/:id/reminders/draft', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ownerId = await requireOwner(req, res);
        if (!ownerId) return;
        const invoiceId = String(req.params.id ?? '');
        const invoice = await repo.getInvoiceForOwner(ownerId, invoiceId);

        if (invoice.providerStatus === 'PAID' || invoice.providerStatus === 'MARKED_AS_PAID') {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            'Cannot draft a reminder for an already paid invoice.'
          );
        }
        if (
          invoice.localStatus === 'CANCELLED' ||
          invoice.providerStatus === 'CANCELLED' ||
          invoice.providerStatus === 'REFUNDED'
        ) {
          throw new OwnershipOrValidationError(
            'VALIDATION_ERROR',
            'Cannot draft a reminder for a cancelled or refunded invoice.'
          );
        }

        const client = await repo.getClientForOwner(ownerId, invoice.clientId);
        const body = (req.body ?? {}) as Record<string, unknown>;

        // Calculate days overdue
        const today = new Date().toISOString().slice(0, 10);
        const dueMs = new Date(invoice.dueDate).getTime();
        const nowMs = new Date(today).getTime();
        const daysOverdue = Math.max(0, Math.floor((nowMs - dueMs) / 86400000));

        // Determine client payment history & tone
        const requestedTone =
          typeof body.tone === 'string' &&
          ['polite', 'firm', 'final'].includes(body.tone.toLowerCase())
            ? (body.tone.toLowerCase() as ReminderTone)
            : undefined;

        let selectedTone: ReminderTone = 'polite';
        if (requestedTone) {
          selectedTone = requestedTone;
        } else {
          const clientInvoices = await repo.listInvoicesForClient(ownerId, client.id);
          const overdueCount = clientInvoices.filter(
            (inv: any) =>
              inv.dueDate < today &&
              inv.localStatus !== 'DRAFT' &&
              inv.providerStatus !== 'PAID' &&
              inv.providerStatus !== 'MARKED_AS_PAID'
          ).length;

          if (daysOverdue >= 30) {
            selectedTone = 'final';
          } else if (overdueCount >= 2 || daysOverdue > 7) {
            selectedTone = 'firm';
          } else {
            selectedTone = 'polite';
          }
        }

        const user = await repo.getUserById(ownerId);
        const onboarding = await repo.getOnboardingProgress(ownerId);
        const businessName =
          onboarding?.businessName || user?.displayName || 'InvoicePilot Workspace';
        const amountFormatted = `${formatMinorUnitsToDecimal(
          invoice.totalMinor,
          invoice.currencyCode
        )} ${invoice.currencyCode}`;

        const scheduledFor =
          typeof body.scheduledFor === 'string' && body.scheduledFor.trim()
            ? body.scheduledFor.trim()
            : undefined;

        const wording = await agent.draftReminderWording({
          clientName: client.fullName,
          businessName,
          invoiceNumber: invoice.invoiceNumber,
          amountFormatted,
          dueDate: invoice.dueDate,
          daysOverdue,
          tone: selectedTone,
          userNotes: typeof body.notes === 'string' ? body.notes : undefined
        });

        const reminder = await repo.createReminder(ownerId, {
          invoiceId: invoice.id,
          tone: selectedTone,
          subject: wording.subject,
          body: wording.body,
          scheduledFor
        });

        await repo.appendActivityLog(ownerId, {
          actorType: 'user',
          action: 'REMINDER_DRAFTED',
          entityType: 'reminder',
          entityId: reminder.id,
          result: 'PROPOSED',
          detail: {
            reminderId: reminder.id,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            tone: selectedTone,
            usedFallback: wording.usedFallback
          },
          correlationId: String(res.locals.requestId ?? '')
        });

        await repo.createNotification(ownerId, {
          title: 'Reminder drafted',
          body: `Reminder drafted for invoice ${invoice.invoiceNumber} (${selectedTone} tone).`
        });

        res.status(201).json({
          ok: true,
          reminder,
          tone: selectedTone,
          wording,
          invoice,
          client
        });
      } catch (err) {
        next(err);
      }
    }
  );

  app.get('/api/reminders', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const status =
        typeof req.query.status === 'string'
          ? (req.query.status as ReminderApprovalState)
          : undefined;
      const invoiceId = typeof req.query.invoiceId === 'string' ? req.query.invoiceId : undefined;
      const reminders = await repo.listRemindersForOwner(ownerId, { status, invoiceId });
      res.status(200).json({ reminders });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/reminders/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const reminderId = String(req.params.id ?? '');
      const reminder = await repo.getReminderById(ownerId, reminderId);
      if (!reminder) {
        throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
      }
      const invoice = await repo.getInvoiceForOwner(ownerId, reminder.invoiceId);
      const client = await repo.getClientForOwner(ownerId, invoice.clientId);
      res.status(200).json({ reminder, invoice, client });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/reminders/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const reminderId = String(req.params.id ?? '');
      const reminder = await repo.getReminderById(ownerId, reminderId);
      if (!reminder) {
        throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
      }
      if (reminder.approvalState === 'SENT') {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Cannot edit a reminder that has already been sent.'
        );
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const tone =
        typeof body.tone === 'string' &&
        ['polite', 'firm', 'final'].includes(body.tone.toLowerCase())
          ? (body.tone.toLowerCase() as ReminderTone)
          : undefined;
      const subject = typeof body.subject === 'string' ? body.subject : undefined;
      const reminderBody = typeof body.body === 'string' ? body.body : undefined;
      const scheduledFor =
        body.scheduledFor !== undefined
          ? typeof body.scheduledFor === 'string'
            ? body.scheduledFor
            : null
          : undefined;

      const updated = await repo.updateReminder(ownerId, reminderId, {
        tone,
        subject,
        body: reminderBody,
        scheduledFor
      });
      res.status(200).json({ reminder: updated });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/reminders/:id/request-approval', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ownerId = await requireOwner(req, res);
        if (!ownerId) return;
        const reminderId = String(req.params.id ?? '');
        const updated = await repo.requestReminderSendApproval(ownerId, reminderId);
        res.status(200).json({ reminder: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/reminders/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const reminderId = String(req.params.id ?? '');
      const updated = await repo.approveReminder(ownerId, reminderId);
      res.status(200).json({ reminder: updated });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/reminders/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;
      const reminderId = String(req.params.id ?? '');
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' ? body.reason : undefined;
      const updated = await repo.rejectReminder(ownerId, reminderId, reason);
      res.status(200).json({ reminder: updated });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/reminders/:id/send', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ownerId = await requireOwner(req, res);
        if (!ownerId) return;
        const reminderId = String(req.params.id ?? '');
        const reminder = await repo.getReminderById(ownerId, reminderId);
        if (!reminder) {
          throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
        }
        const invoice = await repo.getInvoiceForOwner(ownerId, reminder.invoiceId);
        const client = await repo.getClientForOwner(ownerId, invoice.clientId);

        const sendFn = async (r: ReminderRecord): Promise<string> => {
          if (adapter.sendInvoiceReminder && invoice.providerInvoiceId) {
            const result = await adapter.sendInvoiceReminder({
              providerInvoiceId: invoice.providerInvoiceId,
              subject: r.subject,
              note: r.body,
              sendToRecipient: true
            });
            if (result.ok) {
              return result.data.deliveryEvidence;
            }
            throw new Error(`PayPal reminder delivery failed: ${result.error.message}`);
          }
          return `DELIVERY_CONFIRMED:RECIPIENT=${client.email}:TIME=${new Date().toISOString()}:MODE=${adapter.mode}`;
        };

        const { reminder: updatedReminder, evidence } = await repo.sendReminder(
          ownerId,
          reminderId,
          sendFn
        );
        res.status(200).json({ ok: true, reminder: updatedReminder, evidence });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/reminders/process-scheduled', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ownerId = await requireOwner(req, res);
        if (!ownerId) return;
        // Never trust a client-supplied timestamp for scheduled financial actions.
        const currentTimeIso = new Date().toISOString();

        const results = await repo.processDueScheduledReminders(
          currentTimeIso,
          async (reminder: any) => {
            const invoice = await repo.getInvoiceForOwner(reminder.ownerUserId, reminder.invoiceId);
            const client = await repo.getClientForOwner(reminder.ownerUserId, invoice.clientId);
            if (adapter.sendInvoiceReminder && invoice.providerInvoiceId) {
              const result = await adapter.sendInvoiceReminder({
                providerInvoiceId: invoice.providerInvoiceId,
                subject: reminder.subject,
                note: reminder.body,
                sendToRecipient: true
              });
              if (result.ok) {
                return result.data.deliveryEvidence;
              }
              throw new Error(`PayPal reminder delivery failed: ${result.error.message}`);
            }
            return `SCHEDULED_DELIVERY_CONFIRMED:RECIPIENT=${client.email}:TIME=${currentTimeIso}:MODE=${adapter.mode}`;
          },
          ownerId
        );

        res.status(200).json({ ok: true, currentTimeIso, results });
      } catch (err) {
        next(err);
      }
    }
  );

  // Stage 12: Grounded Aging, Cash Flow, and Financial Insights
  app.get('/api/insights', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const asOfDate =
        typeof req.query.asOfDate === 'string' && req.query.asOfDate.trim()
          ? req.query.asOfDate.trim()
          : undefined;

      if (asOfDate && !isValidIsoCalendarDate(asOfDate)) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'asOfDate must be a valid ISO calendar date (YYYY-MM-DD).'
        );
      }

      const insights = await repo.getGroundedInsights(ownerId, asOfDate);
      res.status(200).json({ ok: true, insights });
    } catch (err) {
      next(err);
    }
  });

  // Stage 14: Permanent Account & Associated Records Deletion
  app.post('/api/account/delete', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const user = await repo.getUserById(ownerId);
      if (!user) {
        throw new OwnershipOrValidationError('NOT_FOUND', 'User profile not found.');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const confirmEmail = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim() : '';

      if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          'Please enter your exact account email to confirm permanent deletion.'
        );
      }

      const result = await repo.deleteUserAccount(ownerId);
      clearSessionCookie(res);

      res.status(200).json({
        ok: true,
        message: result.isDemo
          ? 'Demo workspace reset to clean initial state.'
          : 'Your account and all associated workspace records have been permanently deleted.'
      });
    } catch (err) {
      next(err);
    }
  });

  // Stage 14: Webhook Event History Viewer
  app.get('/api/webhooks/paypal/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
      const events = await repo.listWebhookEvents(ownerId, limit);
      res.status(200).json({ ok: true, events });
    } catch (err) {
      next(err);
    }
  });

  // Stage 14: Invoice Line Item Templates & Presets
  app.get('/api/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const templates = await repo.listTemplatesForOwner(ownerId);
      res.status(200).json({
        ok: true,
        templates: templates.map((t: any) => ({
          ...t,
          name: t.title,
          unitPriceMinor: t.unitAmountMinor
        }))
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      const body = (req.body ?? {}) as Record<string, unknown>;
      const title = String(body.title ?? body.name ?? '');
      const unitAmountMinor = Number(body.unitAmountMinor ?? body.unitPriceMinor ?? 0);
      const template = await repo.createTemplate(ownerId, {
        title,
        description: String(body.description ?? ''),
        unitAmountMinor,
        currencyCode: String(body.currencyCode ?? 'USD')
      });

      res.status(201).json({
        ok: true,
        template: {
          ...template,
          name: template.title,
          unitPriceMinor: template.unitAmountMinor
        }
      });
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/templates/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ownerId = await requireOwner(req, res);
      if (!ownerId) return;

      await repo.deleteTemplate(ownerId, String(req.params.id));
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // Catch-all for unknown /api and /api/* routes using the proposed API.md error shape
  app.all(['/api', '/api/*'], (_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'The requested API endpoint does not exist.',
        requestId: String(res.locals.requestId ?? crypto.randomUUID())
      }
    });
  });

  // Domain & fallback error handler that never leaks stack traces or secrets
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const requestId = String(res.locals.requestId ?? crypto.randomUUID());
    if (err instanceof OwnershipOrValidationError) {
      const statusMap: Record<OwnershipOrValidationError['code'], number> = {
        VALIDATION_ERROR: 400,
        FORBIDDEN_OWNER_MISMATCH: 403,
        NOT_FOUND: 404,
        DUPLICATE_EVENT: 409,
        INVALID_STATE_TRANSITION: 400,
        INVOICE_ALREADY_COMPLETED: 409
      };
      res.status(statusMap[err.code] ?? 400).json({
        error: {
          code: err.code,
          message: err.message,
          requestId
        }
      });
      return;
    }

    console.error(`[API Error ${requestId}]:`, err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred. Please try again.',
        requestId
      }
    });
  });

  return app;
}

export const createApp = createApiApp;
