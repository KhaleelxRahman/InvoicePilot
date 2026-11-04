import crypto from 'node:crypto';
import type { IAsyncSqlDatabase } from './types.js';
import { getCurrencyExponent, formatMinorUnitsToDecimal } from './schema.js';
import type { PayPalMode } from '../config.js';
import type { ProviderConfirmedStatus } from '../paypal/adapter.js';
import {
  buildGroundedFinancialInsights,
  type GroundedFinancialInsights
} from '../insights/cashFlowInsights.js';
import {
  DEMO_TENANT_USER_ID,
  DEMO_TENANT_EMAIL,
  OwnershipOrValidationError,
  isValidIsoCalendarDate,
  type UserRecord,
  type SessionRecord,
  type OnboardingRecord,
  type SettingsRecord,
  type ClientRecord,
  type InvoiceLineItemRecord,
  type InvoiceRecord,
  type PendingActionRecord,
  type PendingActionState,
  type ApprovalSlipPayload,
  type ActivityRecord,
  type WebhookEventDetailRecord,
  type NotificationRecord,
  type ReminderTone,
  type ReminderApprovalState,
  type ReminderRecord,
  type CreateInvoiceInput,
  type InvoiceTemplateRecord,
  type CreateTemplateInput
} from './repository.js';

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateSupportedCurrency(currencyCode: string): string {
  const normalized = (currencyCode ?? '').trim().toUpperCase();
  getCurrencyExponent(normalized);
  return normalized;
}

/**
 * Production-ready asynchronous PostgreSQL repository.
 * Every query and transaction explicitly awaits pg.Pool execution.
 * Zero use of Atomics.wait or SharedArrayBuffer.
 */
export class AsyncInvoicePilotRepository {
  public readonly isAsync = true;

  public constructor(private readonly db: IAsyncSqlDatabase) {}

  public async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (typeof (this.db as any).withTransaction === 'function') {
      return await (this.db as any).withTransaction(fn);
    }
    await this.db.exec('BEGIN;');
    try {
      const result = await fn();
      await this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        await this.db.exec('ROLLBACK;');
      } catch {}
      throw err;
    }
  }

  // ============================================================================
  // Auth & Sessions
  // ============================================================================

  public async createUser(input: {
    id?: string;
    email: string;
    displayName: string;
    authProvider?: string;
    passwordHash?: string;
    isDemo?: boolean;
  }): Promise<UserRecord> {
    const now = new Date().toISOString();
    const id = input.id ?? `usr_${crypto.randomUUID()}`;
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const authProvider = input.authProvider ?? 'session';
    const isDemoInt = input.isDemo ? 1 : 0;

    return await this.withTransaction(async () => {
      await this.db
        .prepare(
          `INSERT INTO users (id, email, display_name, auth_provider, password_hash, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          email,
          displayName,
          authProvider,
          input.passwordHash ?? null,
          isDemoInt,
          now,
          now
        );

      await this.db
        .prepare(
          `INSERT INTO settings (user_id, business_name, business_email, default_currency, max_invoice_amount_minor, default_payment_terms_days, created_at, updated_at)
           VALUES (?, ?, ?, 'USD', 1000000, 14, ?, ?)`
        )
        .run(id, displayName, email, now, now);

      return {
        id,
        email,
        displayName,
        authProvider,
        isDemo: Boolean(input.isDemo),
        createdAt: now,
        updatedAt: now
      };
    });
  }

  public async getUserById(userId: string): Promise<UserRecord | null> {
    const row = (await this.db
      .prepare(
        `SELECT id, email, display_name, auth_provider, is_demo, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(userId)) as any;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      authProvider: row.auth_provider,
      isDemo: row.is_demo === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async getUserByEmail(
    email: string
  ): Promise<(UserRecord & { passwordHash?: string | null }) | null> {
    const row = (await this.db
      .prepare(
        `SELECT id, email, display_name, auth_provider, password_hash, is_demo, created_at, updated_at
         FROM users WHERE email = ?`
      )
      .get(email.trim().toLowerCase())) as any;

    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      authProvider: row.auth_provider,
      passwordHash: row.password_hash,
      isDemo: row.is_demo === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async createSession(
    userId: string,
    expiresInSeconds: number = 7 * 86400
  ): Promise<{ session: SessionRecord; rawToken: string }> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const sessionId = `ses_${crypto.randomUUID()}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
    const createdAt = now.toISOString();

    await this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(sessionId, userId, tokenHash, expiresAt, createdAt);

    return {
      session: {
        id: sessionId,
        userId,
        tokenHash,
        expiresAt,
        createdAt
      },
      rawToken
    };
  }

  public async getSessionByToken(
    rawToken: string
  ): Promise<{ session: SessionRecord; user: UserRecord } | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const nowIso = new Date().toISOString();

    const row = (await this.db
      .prepare(
        `SELECT s.id AS s_id, s.user_id, s.token_hash, s.expires_at, s.created_at AS s_created_at,
                u.id AS u_id, u.email, u.display_name, u.auth_provider, u.is_demo, u.created_at AS u_created_at, u.updated_at AS u_updated_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash)) as any;

    if (!row) return null;

    if (row.expires_at <= nowIso) {
      await this.db.prepare('DELETE FROM sessions WHERE id = ?').run(row.s_id);
      return null;
    }

    return {
      session: {
        id: row.s_id,
        userId: row.user_id,
        tokenHash: row.token_hash,
        expiresAt: row.expires_at,
        createdAt: row.s_created_at
      },
      user: {
        id: row.u_id,
        email: row.email,
        displayName: row.display_name,
        authProvider: row.auth_provider,
        isDemo: row.is_demo === 1,
        createdAt: row.u_created_at,
        updatedAt: row.u_updated_at
      }
    };
  }

  public async deleteSession(rawToken: string): Promise<boolean> {
    if (!rawToken) return false;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const res = await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return Number(res.changes) > 0;
  }

  public async deleteUserAccount(
    userId: string
  ): Promise<{ deleted: boolean; isDemo: boolean }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new OwnershipOrValidationError('NOT_FOUND', `User "${userId}" not found.`);
    }

    if (user.isDemo) {
      await this.resetAndSeedDemoTenant();
      return { deleted: true, isDemo: true };
    }

    await this.withTransaction(async () => {
      await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM activity_log WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM notifications WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM reminders WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM pending_actions WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM invoice_items WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM invoices WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM invoice_templates WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM onboarding_progress WHERE user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM chat_threads WHERE user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM clients WHERE owner_user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM paypal_connections WHERE user_id = ?').run(userId);
      await this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    return { deleted: true, isDemo: false };
  }

  // ============================================================================
  // Settings & Onboarding
  // ============================================================================

  public async getSettings(ownerUserId: string): Promise<SettingsRecord | null> {
    const row = (await this.db
      .prepare(
        `SELECT user_id, business_name, business_email, default_currency,
                max_invoice_amount_minor, default_payment_terms_days, created_at, updated_at
         FROM settings WHERE user_id = ?`
      )
      .get(ownerUserId)) as any;

    if (!row) return null;
    return {
      userId: row.user_id,
      businessName: row.business_name,
      businessEmail: row.business_email,
      defaultCurrency: row.default_currency,
      maxInvoiceAmountMinor: row.max_invoice_amount_minor,
      defaultPaymentTermsDays: row.default_payment_terms_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async updateSettings(
    ownerUserId: string,
    patch: Partial<{
      businessName: string;
      businessEmail: string;
      defaultCurrency: string;
      maxInvoiceAmountMinor: number;
      defaultPaymentTermsDays: number;
    }>
  ): Promise<SettingsRecord> {
    const existing = await this.getSettings(ownerUserId);
    if (!existing) {
      throw new OwnershipOrValidationError(
        'NOT_FOUND',
        `Settings for user "${ownerUserId}" do not exist.`
      );
    }

    const businessName = patch.businessName?.trim() || existing.businessName;
    const businessEmail = patch.businessEmail
      ? patch.businessEmail.trim().toLowerCase()
      : existing.businessEmail;
    const defaultCurrency = patch.defaultCurrency
      ? validateSupportedCurrency(patch.defaultCurrency)
      : existing.defaultCurrency;
    const maxInvoiceAmountMinor =
      patch.maxInvoiceAmountMinor !== undefined
        ? patch.maxInvoiceAmountMinor
        : existing.maxInvoiceAmountMinor;
    const defaultPaymentTermsDays =
      patch.defaultPaymentTermsDays !== undefined
        ? patch.defaultPaymentTermsDays
        : existing.defaultPaymentTermsDays;

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE settings
         SET business_name = ?, business_email = ?, default_currency = ?,
             max_invoice_amount_minor = ?, default_payment_terms_days = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(
        businessName,
        businessEmail,
        defaultCurrency,
        maxInvoiceAmountMinor,
        defaultPaymentTermsDays,
        now,
        ownerUserId
      );

    return {
      userId: ownerUserId,
      businessName,
      businessEmail,
      defaultCurrency,
      maxInvoiceAmountMinor,
      defaultPaymentTermsDays,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  public async getOnboardingProgress(userId: string): Promise<OnboardingRecord> {
    const row = (await this.db
      .prepare(
        `SELECT user_id, current_step, completed, skipped, business_name, business_email,
                default_currency, max_invoice_amount_minor, default_reminder_tone, sandbox_tested,
                first_client_id, updated_at
         FROM onboarding_progress WHERE user_id = ?`
      )
      .get(userId)) as any;

    if (!row) {
      const now = new Date().toISOString();
      const initial: OnboardingRecord = {
        userId,
        currentStep: 1,
        completed: false,
        skipped: false,
        defaultCurrency: 'USD',
        maxInvoiceAmountMinor: 1000000,
        defaultReminderTone: 'polite',
        sandboxTested: false,
        updatedAt: now
      };
      await this.db
        .prepare(
          `INSERT INTO onboarding_progress (user_id, current_step, completed, skipped, default_currency, max_invoice_amount_minor, default_reminder_tone, sandbox_tested, updated_at)
           VALUES (?, 1, 0, 0, 'USD', 1000000, 'polite', 0, ?)`
        )
        .run(userId, now);
      return initial;
    }

    return {
      userId: row.user_id,
      currentStep: row.current_step,
      completed: row.completed === 1,
      skipped: row.skipped === 1,
      businessName: row.business_name ?? undefined,
      businessEmail: row.business_email ?? undefined,
      defaultCurrency: row.default_currency,
      maxInvoiceAmountMinor: row.max_invoice_amount_minor,
      defaultReminderTone: row.default_reminder_tone,
      sandboxTested: row.sandbox_tested === 1,
      firstClientId: row.first_client_id ?? undefined,
      updatedAt: row.updated_at
    };
  }

  public async updateOnboardingProgress(
    userId: string,
    patch: Partial<OnboardingRecord>
  ): Promise<OnboardingRecord> {
    const existing = await this.getOnboardingProgress(userId);
    const now = new Date().toISOString();

    const currentStep = patch.currentStep ?? existing.currentStep;
    const completed = patch.completed !== undefined ? patch.completed : existing.completed;
    const skipped = patch.skipped !== undefined ? patch.skipped : existing.skipped;
    const businessName = patch.businessName ?? existing.businessName;
    const businessEmail = patch.businessEmail ?? existing.businessEmail;
    const defaultCurrency = patch.defaultCurrency ?? existing.defaultCurrency;
    const maxInvoiceAmountMinor = patch.maxInvoiceAmountMinor ?? existing.maxInvoiceAmountMinor;
    const defaultReminderTone = patch.defaultReminderTone ?? existing.defaultReminderTone;
    const sandboxTested =
      patch.sandboxTested !== undefined ? patch.sandboxTested : existing.sandboxTested;
    const firstClientId = patch.firstClientId ?? existing.firstClientId;

    await this.db
      .prepare(
        `UPDATE onboarding_progress
         SET current_step = ?, completed = ?, skipped = ?, business_name = ?, business_email = ?,
             default_currency = ?, max_invoice_amount_minor = ?, default_reminder_tone = ?,
             sandbox_tested = ?, first_client_id = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(
        currentStep,
        completed ? 1 : 0,
        skipped ? 1 : 0,
        businessName ?? null,
        businessEmail ?? null,
        defaultCurrency,
        maxInvoiceAmountMinor,
        defaultReminderTone,
        sandboxTested ? 1 : 0,
        firstClientId ?? null,
        now,
        userId
      );

    return {
      userId,
      currentStep,
      completed,
      skipped,
      businessName,
      businessEmail,
      defaultCurrency,
      maxInvoiceAmountMinor,
      defaultReminderTone,
      sandboxTested,
      firstClientId,
      updatedAt: now
    };
  }

  // ============================================================================
  // Clients
  // ============================================================================

  public async createClient(
    ownerUserId: string,
    input: {
      id?: string;
      fullName: string;
      companyName?: string;
      email: string;
      defaultCurrency?: string;
      notes?: string;
    }
  ): Promise<ClientRecord> {
    const currency = validateSupportedCurrency(input.defaultCurrency ?? 'USD');
    const fullName = (input.fullName ?? '').trim();
    const email = (input.email ?? '').trim().toLowerCase();

    if (!fullName || !isValidEmailAddress(email)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and a valid email address are required.'
      );
    }

    const duplicate = await this.db
      .prepare('SELECT id FROM clients WHERE owner_user_id = ? AND email = ?')
      .get(ownerUserId, email);

    if (duplicate) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `A client with email "${email}" already exists in this workspace.`
      );
    }

    const now = new Date().toISOString();
    const id = input.id ?? `cli_${crypto.randomUUID()}`;
    const companyName = input.companyName?.trim() || undefined;
    const notes = input.notes?.trim() || undefined;

    await this.db
      .prepare(
        `INSERT INTO clients (id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, ownerUserId, fullName, companyName ?? null, email, currency, notes ?? null, now, now);

    return {
      id,
      ownerUserId,
      fullName,
      companyName,
      email,
      defaultCurrency: currency,
      notes,
      createdAt: now,
      updatedAt: now
    };
  }

  public async listClientsForOwner(ownerUserId: string): Promise<ClientRecord[]> {
    const rows = (await this.db
      .prepare(
        `SELECT id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at
         FROM clients WHERE owner_user_id = ? ORDER BY created_at DESC`
      )
      .all(ownerUserId)) as any[];

    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      fullName: r.full_name,
      companyName: r.company_name ?? undefined,
      email: r.email,
      defaultCurrency: r.default_currency,
      notes: r.notes ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async getClientForOwner(ownerUserId: string, clientId: string): Promise<ClientRecord> {
    const row = (await this.db
      .prepare(
        `SELECT id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at
         FROM clients WHERE id = ?`
      )
      .get(clientId)) as any;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Client "${clientId}" not found.`);
    }

    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'You do not have permission to access this client.'
      );
    }

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      fullName: row.full_name,
      companyName: row.company_name ?? undefined,
      email: row.email,
      defaultCurrency: row.default_currency,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async updateClientForOwner(
    ownerUserId: string,
    clientId: string,
    patch: {
      fullName?: string;
      companyName?: string;
      email?: string;
      defaultCurrency?: string;
      notes?: string;
    }
  ): Promise<ClientRecord> {
    const existing = await this.getClientForOwner(ownerUserId, clientId);
    const fullName = patch.fullName !== undefined ? patch.fullName.trim() : existing.fullName;
    const email = patch.email !== undefined ? patch.email.trim().toLowerCase() : existing.email;

    if (!fullName || !isValidEmailAddress(email)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and a valid email address are required.'
      );
    }

    const currency = patch.defaultCurrency
      ? validateSupportedCurrency(patch.defaultCurrency)
      : existing.defaultCurrency;
    const companyName =
      patch.companyName !== undefined ? patch.companyName.trim() || undefined : existing.companyName;
    const notes = patch.notes !== undefined ? patch.notes.trim() || undefined : existing.notes;
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE clients
         SET full_name = ?, company_name = ?, email = ?, default_currency = ?, notes = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(fullName, companyName ?? null, email, currency, notes ?? null, now, clientId, ownerUserId);

    return {
      id: clientId,
      ownerUserId,
      fullName,
      companyName,
      email,
      defaultCurrency: currency,
      notes,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  public async deleteClientForOwner(ownerUserId: string, clientId: string): Promise<void> {
    await this.getClientForOwner(ownerUserId, clientId);
    const invoices = (await this.db
      .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE client_id = ?')
      .get(clientId)) as any;

    if (invoices && invoices.cnt > 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Cannot delete client with existing invoices (${invoices.cnt}).`
      );
    }

    await this.db
      .prepare('DELETE FROM clients WHERE id = ? AND owner_user_id = ?')
      .run(clientId, ownerUserId);
  }

  // ============================================================================
  // Invoices & Items
  // ============================================================================

  public async createInvoiceDraft(
    ownerUserId: string,
    input: CreateInvoiceInput & { id?: string }
  ): Promise<InvoiceRecord> {
    const client = await this.getClientForOwner(ownerUserId, input.clientId);
    const currency = validateSupportedCurrency(input.currencyCode ?? client.defaultCurrency);
    const invoiceNumber = (input.invoiceNumber ?? '').trim();

    if (!invoiceNumber) {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Invoice number is required.');
    }

    if (!isValidIsoCalendarDate(input.issueDate)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Issue date must be a valid calendar date in YYYY-MM-DD format.'
      );
    }

    if (!isValidIsoCalendarDate(input.dueDate)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Due date must be a valid calendar date in YYYY-MM-DD format.'
      );
    }

    if (input.dueDate < input.issueDate) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice due date cannot precede the issue date.'
      );
    }

    if (!input.items || input.items.length === 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'An invoice draft must contain at least one line item.'
      );
    }

    let subtotalMinor = 0;
    const validatedItems: InvoiceLineItemRecord[] = input.items.map((item, idx) => {
      const desc = (item.description ?? '').trim();
      if (!desc) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} description is required.`
        );
      }
      const qty = item.quantity;
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} quantity must be a positive number.`
        );
      }
      const unit = item.unitAmountMinor;
      if (!Number.isSafeInteger(unit) || unit < 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} unitAmountMinor must be a non-negative integer.`
        );
      }
      const lineMinor = Math.round(qty * unit);
      subtotalMinor += lineMinor;
      const nowStr = new Date().toISOString();
      return {
        id: `item_${crypto.randomUUID()}`,
        invoiceId: '',
        ownerUserId,
        position: idx + 1,
        description: desc,
        quantity: qty,
        unitAmountMinor: unit,
        currencyCode: currency,
        lineTotalMinor: lineMinor,
        createdAt: nowStr
      };
    });

    const taxBps = input.taxRateBps ?? 0;
    const taxMinor = Math.round((subtotalMinor * taxBps) / 10000);
    const totalMinor = subtotalMinor + taxMinor;

    const settings = await this.getSettings(ownerUserId);
    const maxLimit = settings?.maxInvoiceAmountMinor ?? 1000000;
    if (totalMinor > maxLimit) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Invoice total exceeds workspace limit of ${maxLimit} minor units.`
      );
    }

    const now = new Date().toISOString();
    const invoiceId = input.id ?? `inv_${crypto.randomUUID()}`;
    const providerMode: PayPalMode = input.providerMode ?? 'sandbox';

    return await this.withTransaction(async () => {
      await this.db
        .prepare(
          `INSERT INTO invoices (id, owner_user_id, client_id, invoice_number, currency_code, tax_rate_bps,
                                subtotal_minor, tax_minor, total_minor, paid_amount_minor, local_status,
                                provider_status, provider_mode, issue_date, due_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'DRAFT', 'NONE', ?, ?, ?, ?, ?, ?)`
        )
        .run(
          invoiceId,
          ownerUserId,
          client.id,
          invoiceNumber,
          currency,
          taxBps,
          subtotalMinor,
          taxMinor,
          totalMinor,
          providerMode,
          input.issueDate,
          input.dueDate,
          input.notes?.trim() || null,
          now,
          now
        );

      for (const item of validatedItems) {
        item.invoiceId = invoiceId;
        await this.db
          .prepare(
            `INSERT INTO invoice_items (id, invoice_id, owner_user_id, position, description, quantity, unit_amount_minor, line_total_minor, currency_code, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            item.id,
            invoiceId,
            ownerUserId,
            item.position,
            item.description,
            item.quantity,
            item.unitAmountMinor,
            item.lineTotalMinor,
            item.currencyCode,
            now
          );
      }

      return {
        id: invoiceId,
        ownerUserId,
        clientId: client.id,
        invoiceNumber,
        currencyCode: currency,
        subtotalMinor,
        taxRateBps: taxBps,
        taxMinor,
        totalMinor,
        paidAmountMinor: 0,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        notes: input.notes?.trim() || undefined,
        localStatus: 'DRAFT',
        providerMode,
        providerStatus: 'NONE',
        items: validatedItems,
        createdAt: now,
        updatedAt: now
      };
    });
  }

  private static completionColumnsMigrated = false;

  private async ensureCompletionColumns(): Promise<void> {
    if (AsyncInvoicePilotRepository.completionColumnsMigrated) return;
    try {
      await this.db.exec(`
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1));
        ALTER TABLE invoices ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
      `);
      AsyncInvoicePilotRepository.completionColumnsMigrated = true;
    } catch {
      // Columns may already exist
    }
  }

  public async getInvoiceForOwner(ownerUserId: string, invoiceId: string): Promise<InvoiceRecord> {
    await this.ensureCompletionColumns();
    const row = (await this.db
      .prepare(
        `SELECT id, owner_user_id, client_id, invoice_number, currency_code, tax_rate_bps,
                subtotal_minor, tax_minor, total_minor, paid_amount_minor,
                is_completed, completed_at, local_status,
                provider_status, provider_invoice_id, provider_recipient_view_url, provider_invoicer_view_url,
                last_provider_sync_at, provider_mode, issue_date, due_date, notes, created_at, updated_at
         FROM invoices WHERE id = ?`
      )
      .get(invoiceId)) as any;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Invoice "${invoiceId}" not found.`);
    }

    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'You do not have permission to access this invoice.'
      );
    }

    const itemRows = (await this.db
      .prepare(
        `SELECT id, invoice_id, owner_user_id, position, description, quantity, unit_amount_minor, line_total_minor, currency_code, created_at
         FROM invoice_items WHERE invoice_id = ? AND owner_user_id = ? ORDER BY position ASC`
      )
      .all(invoiceId, ownerUserId)) as any[];

    const items: InvoiceLineItemRecord[] = itemRows.map((i) => ({
      id: i.id,
      invoiceId: i.invoice_id,
      ownerUserId: i.owner_user_id,
      position: Number(i.position ?? 0),
      description: i.description,
      quantity: Number(i.quantity ?? 1),
      unitAmountMinor: Number(i.unit_amount_minor ?? 0),
      currencyCode: i.currency_code,
      lineTotalMinor: Number(i.line_total_minor ?? 0),
      createdAt: i.created_at
    }));

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      clientId: row.client_id,
      invoiceNumber: row.invoice_number,
      currencyCode: row.currency_code,
      subtotalMinor: Number(row.subtotal_minor ?? 0),
      taxRateBps: Number(row.tax_rate_bps ?? 0),
      taxMinor: Number(row.tax_minor ?? 0),
      totalMinor: Number(row.total_minor ?? 0),
      paidAmountMinor: Number(row.paid_amount_minor ?? 0),
      isCompleted: Boolean(row.is_completed),
      completedAt: row.completed_at ?? undefined,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      notes: row.notes ?? undefined,
      localStatus: row.local_status,
      providerMode: row.provider_mode,
      providerInvoiceId: row.provider_invoice_id ?? undefined,
      providerStatus: row.provider_status ?? 'NONE',
      providerRecipientViewUrl: row.provider_recipient_view_url ?? undefined,
      providerInvoicerViewUrl: row.provider_invoicer_view_url ?? undefined,
      lastProviderSyncAt: row.last_provider_sync_at ?? undefined,
      items,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async listInvoicesForOwner(ownerUserId: string): Promise<InvoiceRecord[]> {
    const ids = (await this.db
      .prepare('SELECT id FROM invoices WHERE owner_user_id = ? ORDER BY created_at DESC')
      .all(ownerUserId)) as Array<{ id: string }>;

    const results: InvoiceRecord[] = [];
    for (const { id } of ids) {
      results.push(await this.getInvoiceForOwner(ownerUserId, id));
    }
    return results;
  }

  public async listInvoicesForClient(
    ownerUserId: string,
    clientId: string
  ): Promise<InvoiceRecord[]> {
    await this.getClientForOwner(ownerUserId, clientId);
    const ids = (await this.db
      .prepare('SELECT id FROM invoices WHERE owner_user_id = ? AND client_id = ? ORDER BY created_at DESC')
      .all(ownerUserId, clientId)) as Array<{ id: string }>;

    const results: InvoiceRecord[] = [];
    for (const { id } of ids) {
      results.push(await this.getInvoiceForOwner(ownerUserId, id));
    }
    return results;
  }

  public async updateInvoiceDraftForOwner(
    ownerUserId: string,
    invoiceId: string,
    patch: Partial<CreateInvoiceInput>
  ): Promise<InvoiceRecord> {
    const existing = await this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (existing.localStatus !== 'DRAFT') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Only DRAFT invoices can be edited. Current status: ${existing.localStatus}`
      );
    }

    const clientId = patch.clientId ?? existing.clientId;
    await this.getClientForOwner(ownerUserId, clientId);
    const currency = patch.currencyCode
      ? validateSupportedCurrency(patch.currencyCode)
      : existing.currencyCode;
    const invoiceNumber = patch.invoiceNumber?.trim() || existing.invoiceNumber;
    const issueDate = patch.issueDate || existing.issueDate;
    const dueDate = patch.dueDate || existing.dueDate;
    const taxBps = patch.taxRateBps !== undefined ? patch.taxRateBps : existing.taxRateBps;
    const notes = patch.notes !== undefined ? patch.notes.trim() || null : existing.notes ?? null;
    const now = new Date().toISOString();

    return await this.withTransaction(async () => {
      let subtotalMinor = existing.subtotalMinor;
      let taxMinor = existing.taxMinor;
      let totalMinor = existing.totalMinor;

      if (patch.items && patch.items.length > 0) {
        await this.db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
        subtotalMinor = 0;
        let pos = 1;
        for (const item of patch.items) {
          const lineMinor = Math.round(item.quantity * item.unitAmountMinor);
          subtotalMinor += lineMinor;
          await this.db
            .prepare(
              `INSERT INTO invoice_items (id, invoice_id, owner_user_id, position, description, quantity, unit_amount_minor, line_total_minor, currency_code, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              `item_${crypto.randomUUID()}`,
              invoiceId,
              ownerUserId,
              pos++,
              item.description.trim(),
              item.quantity,
              item.unitAmountMinor,
              lineMinor,
              currency,
              now
            );
        }
        taxMinor = Math.round((subtotalMinor * taxBps) / 10000);
        totalMinor = subtotalMinor + taxMinor;
      }

      await this.db
        .prepare(
          `UPDATE invoices
           SET client_id = ?, invoice_number = ?, currency_code = ?, tax_rate_bps = ?,
               subtotal_minor = ?, tax_minor = ?, total_minor = ?, issue_date = ?,
               due_date = ?, notes = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(
          clientId,
          invoiceNumber,
          currency,
          taxBps,
          subtotalMinor,
          taxMinor,
          totalMinor,
          issueDate,
          dueDate,
          notes,
          now,
          invoiceId,
          ownerUserId
        );

      return await this.getInvoiceForOwner(ownerUserId, invoiceId);
    });
  }

  public async recordProviderInvoiceSync(
    ownerUserId: string,
    invoiceId: string,
    sync: {
      providerInvoiceId: string;
      providerStatus: ProviderConfirmedStatus;
      recipientViewUrl?: string;
      invoicerViewUrl?: string;
    }
  ): Promise<InvoiceRecord> {
    await this.getInvoiceForOwner(ownerUserId, invoiceId);
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE invoices
         SET provider_invoice_id = ?, provider_status = ?, provider_recipient_view_url = ?, provider_invoicer_view_url = ?,
             last_provider_sync_at = ?, local_status = 'SENT', updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(
        sync.providerInvoiceId,
        sync.providerStatus,
        sync.recipientViewUrl ?? null,
        sync.invoicerViewUrl ?? null,
        now,
        now,
        invoiceId,
        ownerUserId
      );

    return await this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public async findInvoiceByProviderInvoiceId(providerInvoiceId: string): Promise<InvoiceRecord | null> {
    const row = (await this.db
      .prepare('SELECT id, owner_user_id FROM invoices WHERE provider_invoice_id = ?')
      .get(providerInvoiceId)) as any;

    if (!row) return null;
    return await this.getInvoiceForOwner(row.owner_user_id, row.id);
  }

  public async markInvoiceCompleted(ownerUserId: string, invoiceId: string): Promise<InvoiceRecord> {
    const invoice = await this.getInvoiceForOwner(ownerUserId, invoiceId);

    if (invoice.localStatus === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'INVALID_STATE_TRANSITION',
        'Cancelled invoices cannot be marked as completed.'
      );
    }

    if (invoice.isCompleted) {
      throw new OwnershipOrValidationError(
        'INVOICE_ALREADY_COMPLETED',
        'Invoice is already marked as completed.'
      );
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        'UPDATE invoices SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?'
      )
      .run(now, now, invoiceId, ownerUserId);

    await this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: 'INVOICE_MARKED_COMPLETED',
      entityType: 'invoice',
      entityId: invoiceId,
      result: 'EXECUTED',
      detail: {
        invoiceNumber: invoice.invoiceNumber,
        isCompleted: true,
        completedAt: now,
        localStatus: invoice.localStatus,
        providerStatus: invoice.providerStatus,
        totalMinor: invoice.totalMinor,
        currencyCode: invoice.currencyCode
      }
    });

    return await this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public async refreshInvoiceProviderStatus(
    ownerUserId: string,
    invoiceId: string,
    status: ProviderConfirmedStatus
  ): Promise<InvoiceRecord> {
    const existing = await this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (!existing.providerInvoiceId) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot refresh status on an unsent invoice without providerInvoiceId.'
      );
    }

    const now = new Date().toISOString();
    let localStatus = existing.localStatus;
    if (status === 'PAID') localStatus = 'SENT';
    if (status === 'CANCELLED') localStatus = 'CANCELLED';

    await this.db
      .prepare(
        `UPDATE invoices SET provider_status = ?, local_status = ?, last_provider_sync_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(status, localStatus, now, now, invoiceId, ownerUserId);

    return await this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public async recordPartialPayment(
    ownerUserId: string,
    invoiceId: string,
    amountMinor: number
  ): Promise<InvoiceRecord> {
    const invoice = await this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (amountMinor <= 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Payment amount must be greater than zero.'
      );
    }

    const newPaid = invoice.paidAmountMinor + amountMinor;
    if (newPaid > invoice.totalMinor) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Payment exceeds remaining balance. Max payable: ${invoice.totalMinor - invoice.paidAmountMinor}.`
      );
    }

    const isFullyPaid = newPaid >= invoice.totalMinor;
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE invoices
         SET paid_amount_minor = ?, provider_status = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(
        newPaid,
        isFullyPaid ? 'PAID' : invoice.providerStatus,
        now,
        invoiceId,
        ownerUserId
      );

    if (isFullyPaid) {
      await this.createNotification(ownerUserId, {
        title: 'Invoice paid in full',
        body: `Invoice ${invoice.invoiceNumber} has been fully settled (${formatMinorUnitsToDecimal(invoice.totalMinor, invoice.currencyCode)} ${invoice.currencyCode}).`
      });
    } else {
      await this.createNotification(ownerUserId, {
        title: 'Payment recorded',
        body: `Payment of ${formatMinorUnitsToDecimal(amountMinor, invoice.currencyCode)} ${invoice.currencyCode} recorded for ${invoice.invoiceNumber}. Remaining balance: ${formatMinorUnitsToDecimal(invoice.totalMinor - newPaid, invoice.currencyCode)} ${invoice.currencyCode}.`
      });
    }

    return await this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  // ============================================================================
  // Approval Slip & Actions State Machine
  // ============================================================================

  public async buildApprovalSlipPayload(
    ownerUserId: string,
    invoiceId: string,
    providerMode: PayPalMode = 'sandbox'
  ): Promise<{ slip: ApprovalSlipPayload; canonicalHash: string }> {
    const invoice = await this.getInvoiceForOwner(ownerUserId, invoiceId);
    const client = await this.getClientForOwner(ownerUserId, invoice.clientId);
    const settings = await this.getSettings(ownerUserId);

    const warnings: string[] = [];
    if (providerMode === 'mock') {
      warnings.push('Isolated Mock Mode active: execution will NOT contact PayPal.');
    } else {
      warnings.push('PayPal Sandbox Mode active: execution will create a Sandbox invoice.');
    }

    if (settings && invoice.totalMinor >= Math.round(settings.maxInvoiceAmountMinor * 0.8)) {
      warnings.push('High-value invoice: total is at or above 80% of configured cap.');
    }

    const whatWillHappen = `Approving and executing this slip authorizes the server to create and transmit invoice ${invoice.invoiceNumber} to ${client.fullName} (${client.email}).`;

    const slip: ApprovalSlipPayload = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: client.id,
      clientFullName: client.fullName,
      clientCompanyName: client.companyName,
      clientEmail: client.email,
      currencyCode: invoice.currencyCode,
      subtotalMinor: invoice.subtotalMinor,
      taxRateBps: invoice.taxRateBps,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      providerMode,
      items: invoice.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitAmountMinor: it.unitAmountMinor,
        lineTotalMinor: it.lineTotalMinor,
        currencyCode: it.currencyCode
      })),
      warnings,
      whatWillHappen
    };

    const canonicalHash = crypto.createHash('sha256').update(JSON.stringify(slip)).digest('hex');
    return { slip, canonicalHash };
  }

  public async requestInvoiceSendApproval(
    ownerUserId: string,
    invoiceId: string,
    options?: { requestedBy?: 'user' | 'agent'; idempotencyKey?: string }
  ): Promise<{ action: PendingActionRecord; slip: ApprovalSlipPayload }> {
    const invoice = await this.getInvoiceForOwner(ownerUserId, invoiceId);
    const { slip, canonicalHash } = await this.buildApprovalSlipPayload(
      ownerUserId,
      invoiceId,
      invoice.providerMode
    );
    const now = new Date();
    const actionId = `act_${crypto.randomUUID()}`;
    const expiresAt = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    const payloadJson = JSON.stringify(slip);

    await this.db
      .prepare(
        `INSERT INTO pending_actions (id, owner_user_id, action_type, target_invoice_id,
                                     state, payload_json, payload_hash, idempotency_key, expires_at, created_at, updated_at)
         VALUES (?, ?, 'SEND_INVOICE', ?, 'PENDING_APPROVAL', CAST(? AS JSONB), ?, ?, ?, ?, ?)`
      )
      .run(
        actionId,
        ownerUserId,
        invoice.id,
        payloadJson,
        canonicalHash,
        options?.idempotencyKey ?? `send_${invoiceId}_${Date.now()}`,
        expiresAt,
        now.toISOString(),
        now.toISOString()
      );

    const action = await this.getPendingActionForOwner(ownerUserId, actionId);
    return { action, slip };
  }

  public async getPendingActionForOwner(
    ownerUserId: string,
    actionId: string
  ): Promise<PendingActionRecord> {
    const row = (await this.db
      .prepare('SELECT * FROM pending_actions WHERE id = ?')
      .get(actionId)) as any;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Action "${actionId}" not found.`);
    }

    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'Unauthorized action access.'
      );
    }

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      actionType: row.action_type,
      targetInvoiceId: row.target_invoice_id,
      state: row.state as PendingActionState,
      payloadJson:
        typeof row.payload_json === 'string'
          ? row.payload_json
          : JSON.stringify(row.payload_json ?? {}),
      payloadHash: row.payload_hash,
      idempotencyKey: row.idempotency_key,
      expiresAt: row.expires_at,
      approvedAt: row.approved_at ?? undefined,
      executedAt: row.executed_at ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async listPendingActionsForOwner(
    ownerUserId: string,
    invoiceId?: string
  ): Promise<PendingActionRecord[]> {
    const sql = invoiceId
      ? 'SELECT * FROM pending_actions WHERE owner_user_id = ? AND target_invoice_id = ? ORDER BY created_at DESC'
      : 'SELECT * FROM pending_actions WHERE owner_user_id = ? ORDER BY created_at DESC';
    const params = invoiceId ? [ownerUserId, invoiceId] : [ownerUserId];

    const rows = (await this.db.prepare(sql).all(...params)) as any[];
    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      actionType: row.action_type,
      targetInvoiceId: row.target_invoice_id,
      state: row.state as PendingActionState,
      payloadJson:
        typeof row.payload_json === 'string'
          ? row.payload_json
          : JSON.stringify(row.payload_json ?? {}),
      payloadHash: row.payload_hash,
      idempotencyKey: row.idempotency_key,
      expiresAt: row.expires_at,
      approvedAt: row.approved_at ?? undefined,
      executedAt: row.executed_at ?? undefined,
      failureReason: row.failure_reason ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public async approvePendingAction(ownerUserId: string, actionId: string): Promise<PendingActionRecord> {
    const action = await this.getPendingActionForOwner(ownerUserId, actionId);
    if (action.state === 'APPROVED' || action.state === 'EXECUTED') {
      throw new OwnershipOrValidationError('DUPLICATE_EVENT', 'Action is already approved/executed.');
    }
    if (action.state !== 'PENDING_APPROVAL') {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', `Cannot approve in state "${action.state}".`);
    }

    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE pending_actions SET state = 'APPROVED', approved_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, now, actionId, ownerUserId);

    return await this.getPendingActionForOwner(ownerUserId, actionId);
  }

  public async rejectPendingAction(
    ownerUserId: string,
    actionId: string,
    reason?: string
  ): Promise<PendingActionRecord> {
    await this.getPendingActionForOwner(ownerUserId, actionId);
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE pending_actions SET state = 'REJECTED', failure_reason = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(reason ?? 'Discarded by user', now, actionId, ownerUserId);

    return await this.getPendingActionForOwner(ownerUserId, actionId);
  }

  public async beginActionExecution(
    ownerUserId: string,
    actionId: string
  ): Promise<{ action: PendingActionRecord; invoice: InvoiceRecord; client: ClientRecord }> {
    const action = await this.getPendingActionForOwner(ownerUserId, actionId);
    if (action.state !== 'APPROVED') {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Action must be in APPROVED state to execute.');
    }

    const invoice = await this.getInvoiceForOwner(ownerUserId, action.targetInvoiceId);
    const client = await this.getClientForOwner(ownerUserId, invoice.clientId);
    const now = new Date().toISOString();

    await this.db
      .prepare(`UPDATE pending_actions SET state = 'EXECUTING', updated_at = ? WHERE id = ? AND owner_user_id = ?`)
      .run(now, actionId, ownerUserId);

    return { action: await this.getPendingActionForOwner(ownerUserId, actionId), invoice, client };
  }

  public async completeActionExecutionSuccess(
    ownerUserId: string,
    actionId: string,
    _resultData?: Record<string, unknown>
  ): Promise<PendingActionRecord> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE pending_actions SET state = 'EXECUTED', executed_at = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, now, actionId, ownerUserId);

    return await this.getPendingActionForOwner(ownerUserId, actionId);
  }

  public async completeActionExecutionFailure(
    ownerUserId: string,
    actionId: string,
    error: { message: string; code?: string }
  ): Promise<PendingActionRecord> {
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `UPDATE pending_actions SET state = 'FAILED', failure_reason = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(`${error.code ?? 'ERROR'}: ${error.message}`, now, actionId, ownerUserId);

    return await this.getPendingActionForOwner(ownerUserId, actionId);
  }

  // ============================================================================
  // Activity, Notifications & Insights
  // ============================================================================

  public async appendActivityLog(
    ownerUserId: string,
    input: {
      id?: string;
      actorType: 'user' | 'agent' | 'provider' | 'system';
      action: string;
      entityType: string;
      entityId: string;
      result: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'INFO';
      detail?: Record<string, unknown>;
      correlationId?: string;
    }
  ): Promise<ActivityRecord> {
    const now = new Date().toISOString();
    const id = input.id ?? `actlog_${crypto.randomUUID()}`;
    const detailJson = JSON.stringify(input.detail ?? {});

    await this.db
      .prepare(
        `INSERT INTO activity_log (
          id, owner_user_id, actor_type, action, entity_type, entity_id,
          result, detail_json, correlation_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        ownerUserId,
        input.actorType,
        input.action,
        input.entityType,
        input.entityId,
        input.result,
        detailJson,
        input.correlationId ?? null,
        now
      );

    return {
      id,
      ownerUserId,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      result: input.result,
      detailJson,
      correlationId: input.correlationId,
      createdAt: now
    };
  }

  public async listActivityForOwner(ownerUserId: string): Promise<ActivityRecord[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM activity_log WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(ownerUserId)) as any[];

    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      actorType: r.actor_type,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      result: r.result,
      detailJson: r.detail_json,
      correlationId: r.correlation_id ?? undefined,
      createdAt: r.created_at
    }));
  }

  public async createNotification(
    ownerUserId: string,
    input: { title: string; body: string }
  ): Promise<NotificationRecord> {
    const id = `notif_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `INSERT INTO notifications (id, owner_user_id, title, body, is_read, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      )
      .run(id, ownerUserId, input.title.trim(), input.body.trim(), now);

    return {
      id,
      ownerUserId,
      title: input.title.trim(),
      body: input.body.trim(),
      isRead: false,
      createdAt: now
    };
  }

  public async listNotificationsForOwner(ownerUserId: string): Promise<NotificationRecord[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM notifications WHERE owner_user_id = ? ORDER BY created_at DESC')
      .all(ownerUserId)) as any[];

    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      title: r.title,
      body: r.body,
      isRead: r.is_read === 1,
      createdAt: r.created_at
    }));
  }

  public async markNotificationAsRead(ownerUserId: string, notificationId: string): Promise<void> {
    await this.db
      .prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND owner_user_id = ?')
      .run(notificationId, ownerUserId);
  }

  public async markAllNotificationsAsRead(ownerUserId: string): Promise<void> {
    await this.db
      .prepare('UPDATE notifications SET is_read = 1 WHERE owner_user_id = ?')
      .run(ownerUserId);
  }

  public async recordWebhookEvent(input: {
    providerEventId: string;
    eventType: string;
    verificationStatus: 'VERIFIED' | 'REJECTED';
    processingStatus: 'PROCESSED' | 'IGNORED' | 'FAILED';
    relatedProviderInvoiceId?: string;
    payloadJson: string;
  }): Promise<{ id: string; duplicate: boolean }> {
    const existing = await this.db
      .prepare('SELECT id FROM webhook_events WHERE provider_event_id = ?')
      .get(input.providerEventId);

    if (existing) {
      return { id: input.providerEventId, duplicate: true };
    }

    const now = new Date().toISOString();
    const id = `wh_${crypto.randomUUID()}`;
    const payloadHash = crypto.createHash('sha256').update(input.payloadJson).digest('hex');

    await this.db
      .prepare(
        `INSERT INTO webhook_events (id, provider_event_id, event_type, verification_status,
                                     processing_status, related_provider_invoice_id, payload_hash, received_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.providerEventId,
        input.eventType,
        input.verificationStatus,
        input.processingStatus,
        input.relatedProviderInvoiceId ?? null,
        payloadHash,
        now
      );

    return { id, duplicate: false };
  }

  public async listWebhookEvents(limit = 50): Promise<WebhookEventDetailRecord[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT ?')
      .all(limit)) as any[];

    return rows.map((r) => ({
      id: r.id,
      providerEventId: r.provider_event_id,
      eventType: r.event_type,
      summary: `PayPal event ${r.event_type} (${r.provider_event_id})`,
      verificationStatus: r.verification_status,
      processingStatus: r.processing_status,
      relatedProviderInvoiceId: r.related_provider_invoice_id ?? undefined,
      payloadHash: r.payload_hash,
      payload: {
        id: r.provider_event_id,
        event_type: r.event_type,
        payload_hash: r.payload_hash
      },
      receivedAt: r.received_at,
      processedAt: r.processed_at ?? undefined
    }));
  }

  public async listTemplatesForOwner(ownerUserId: string): Promise<InvoiceTemplateRecord[]> {
    const rows = (await this.db
      .prepare('SELECT * FROM invoice_templates WHERE owner_user_id = ? ORDER BY created_at ASC')
      .all(ownerUserId)) as any[];

    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      title: r.title,
      description: r.description,
      unitAmountMinor: r.unit_amount_minor,
      currencyCode: r.currency_code,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async createTemplate(
    ownerUserId: string,
    input: CreateTemplateInput
  ): Promise<InvoiceTemplateRecord> {
    const title = (input.title ?? '').trim();
    const desc = (input.description ?? '').trim();
    if (!title) throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Template title required.');
    const now = new Date().toISOString();
    const id = `tmpl_${crypto.randomUUID()}`;

    await this.db
      .prepare(
        `INSERT INTO invoice_templates (id, owner_user_id, title, description, unit_amount_minor, currency_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, ownerUserId, title, desc, input.unitAmountMinor, input.currencyCode, now, now);

    return {
      id,
      ownerUserId,
      title,
      description: desc,
      unitAmountMinor: input.unitAmountMinor,
      currencyCode: input.currencyCode,
      createdAt: now,
      updatedAt: now
    };
  }

  public async deleteTemplate(ownerUserId: string, templateId: string): Promise<void> {
    const res = await this.db
      .prepare('DELETE FROM invoice_templates WHERE id = ? AND owner_user_id = ?')
      .run(templateId, ownerUserId);

    if (Number(res.changes) === 0) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Template "${templateId}" not found.`);
    }
  }

  // ============================================================================
  // Reminders
  // ============================================================================

  public async createReminder(
    ownerUserId: string,
    input: {
      id?: string;
      invoiceId: string;
      tone?: ReminderTone;
      subject: string;
      body: string;
      scheduledFor?: string | null;
      approvalState?: ReminderApprovalState;
    }
  ): Promise<ReminderRecord> {
    const id = input.id ?? `rem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    const tone = input.tone ?? 'polite';
    const state = input.approvalState ?? 'DRAFTED';

    await this.db
      .prepare(
        `INSERT INTO reminders (id, owner_user_id, invoice_id, tone, subject, body, approval_state, scheduled_for, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        ownerUserId,
        input.invoiceId,
        tone,
        input.subject.trim(),
        input.body.trim(),
        state,
        input.scheduledFor ?? null,
        now,
        now
      );

    return (await this.getReminderById(ownerUserId, id))!;
  }

  public async getReminderById(ownerUserId: string, reminderId: string): Promise<ReminderRecord | null> {
    const row = (await this.db
      .prepare('SELECT * FROM reminders WHERE id = ?')
      .get(reminderId)) as any;

    if (!row) return null;
    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError('FORBIDDEN_OWNER_MISMATCH', 'Unauthorized reminder access.');
    }

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      invoiceId: row.invoice_id,
      tone: row.tone,
      subject: row.subject,
      body: row.body,
      approvalState: row.approval_state as ReminderApprovalState,
      scheduledFor: row.scheduled_for ?? undefined,
      sentAt: row.sent_at ?? undefined,
      deliveryEvidence: row.delivery_evidence ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async listRemindersForOwner(
    ownerUserId: string,
    filters?: { invoiceId?: string; state?: string }
  ): Promise<ReminderRecord[]> {
    let sql = 'SELECT * FROM reminders WHERE owner_user_id = ?';
    const params: unknown[] = [ownerUserId];

    if (filters?.invoiceId) {
      sql += ' AND invoice_id = ?';
      params.push(filters.invoiceId);
    }
    if (filters?.state) {
      sql += ' AND approval_state = ?';
      params.push(filters.state);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = (await this.db.prepare(sql).all(...params)) as any[];
    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      invoiceId: r.invoice_id,
      tone: r.tone,
      subject: r.subject,
      body: r.body,
      approvalState: r.approval_state as ReminderApprovalState,
      scheduledFor: r.scheduled_for ?? undefined,
      sentAt: r.sent_at ?? undefined,
      deliveryEvidence: r.delivery_evidence ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  public async updateReminder(
    ownerUserId: string,
    reminderId: string,
    patch: Partial<{ subject: string; body: string; tone: ReminderTone; scheduledFor: string | null }>
  ): Promise<ReminderRecord> {
    const existing = await this.getReminderById(ownerUserId, reminderId);
    if (!existing) throw new OwnershipOrValidationError('NOT_FOUND', 'Reminder not found.');
    const now = new Date().toISOString();

    const subject = patch.subject?.trim() || existing.subject;
    const body = patch.body?.trim() || existing.body;
    const tone = patch.tone || existing.tone;
    const scheduledFor = patch.scheduledFor !== undefined ? patch.scheduledFor : existing.scheduledFor;

    await this.db
      .prepare(
        `UPDATE reminders SET subject = ?, body = ?, tone = ?, scheduled_for = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(subject, body, tone, scheduledFor ?? null, now, reminderId, ownerUserId);

    return (await this.getReminderById(ownerUserId, reminderId))!;
  }

  public async deleteReminder(ownerUserId: string, reminderId: string): Promise<boolean> {
    await this.getReminderById(ownerUserId, reminderId);
    const res = await this.db
      .prepare('DELETE FROM reminders WHERE id = ? AND owner_user_id = ?')
      .run(reminderId, ownerUserId);
    return Number(res.changes) > 0;
  }

  public async requestReminderSendApproval(
    ownerUserId: string,
    reminderId: string
  ): Promise<ReminderRecord> {
    const reminder = await this.getReminderById(ownerUserId, reminderId);
    if (!reminder) throw new OwnershipOrValidationError('NOT_FOUND', 'Reminder not found.');
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE reminders SET approval_state = 'PENDING_APPROVAL', updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, reminderId, ownerUserId);

    return (await this.getReminderById(ownerUserId, reminderId))!;
  }

  public async approveReminder(ownerUserId: string, reminderId: string): Promise<ReminderRecord> {
    const reminder = await this.getReminderById(ownerUserId, reminderId);
    if (!reminder) throw new OwnershipOrValidationError('NOT_FOUND', 'Reminder not found.');
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE reminders SET approval_state = 'APPROVED', updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, reminderId, ownerUserId);

    return (await this.getReminderById(ownerUserId, reminderId))!;
  }

  public async rejectReminder(
    ownerUserId: string,
    reminderId: string,
    _reason?: string
  ): Promise<ReminderRecord> {
    const reminder = await this.getReminderById(ownerUserId, reminderId);
    if (!reminder) throw new OwnershipOrValidationError('NOT_FOUND', 'Reminder not found.');
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE reminders SET approval_state = 'REJECTED', updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, reminderId, ownerUserId);

    return (await this.getReminderById(ownerUserId, reminderId))!;
  }

  public async sendReminder(
    ownerUserId: string,
    reminderId: string,
    sendFn?: (reminder: ReminderRecord) => Promise<string>
  ): Promise<ReminderRecord> {
    const reminder = await this.getReminderById(ownerUserId, reminderId);
    if (!reminder) throw new OwnershipOrValidationError('NOT_FOUND', 'Reminder not found.');
    if (reminder.approvalState !== 'APPROVED') {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Reminder must be in APPROVED state to send.');
    }

    const evidence = sendFn
      ? await sendFn(reminder)
      : `Sent via sandbox mailer at ${new Date().toISOString()}`;
    const now = new Date().toISOString();

    await this.db
      .prepare(
        `UPDATE reminders SET approval_state = 'SENT', sent_at = ?, delivery_evidence = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`
      )
      .run(now, evidence, now, reminderId, ownerUserId);

    return (await this.getReminderById(ownerUserId, reminderId))!;
  }

  public async processDueScheduledReminders(
    currentTimeIso: string = new Date().toISOString(),
    sendFn?: (reminder: ReminderRecord) => Promise<string>
  ): Promise<Array<{ id: string; success: boolean; evidence?: string; error?: string }>> {
    const dueRows = (await this.db
      .prepare(
        `SELECT * FROM reminders WHERE approval_state = 'APPROVED' AND scheduled_for IS NOT NULL AND scheduled_for <= ?`
      )
      .all(currentTimeIso)) as any[];

    const results: Array<{ id: string; success: boolean; evidence?: string; error?: string }> = [];
    for (const row of dueRows) {
      try {
        const updated = await this.sendReminder(row.owner_user_id, row.id, sendFn);
        results.push({ id: row.id, success: true, evidence: updated.deliveryEvidence });
      } catch (err: any) {
        results.push({ id: row.id, success: false, error: err.message });
      }
    }
    return results;
  }

  // ============================================================================
  // Grounded Insights & Demo Tenant
  // ============================================================================

  public async getGroundedInsights(
    ownerUserId: string,
    asOfDate?: string
  ): Promise<GroundedFinancialInsights> {
    const invoices = await this.listInvoicesForOwner(ownerUserId);
    const clients = await this.listClientsForOwner(ownerUserId);
    const reminders = await this.listRemindersForOwner(ownerUserId);
    return buildGroundedFinancialInsights(invoices, clients, reminders, asOfDate);
  }

  public async resetAndSeedDemoTenant(): Promise<{
    user: UserRecord;
    demoUser: UserRecord;
    settings: SettingsRecord;
    clients: ClientRecord[];
    invoices: InvoiceRecord[];
  }> {
    return await this.withTransaction(async () => {
      await this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM activity_log WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM notifications WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM reminders WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM pending_actions WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM invoice_items WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM invoices WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM invoice_templates WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM onboarding_progress WHERE user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM chat_threads WHERE user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM clients WHERE owner_user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM settings WHERE user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM paypal_connections WHERE user_id = ?').run(DEMO_TENANT_USER_ID);
      await this.db.prepare('DELETE FROM users WHERE id = ?').run(DEMO_TENANT_USER_ID);

      const now = new Date().toISOString();

      await this.db
        .prepare(
          `INSERT INTO users (id, email, display_name, auth_provider, is_demo, created_at, updated_at)
           VALUES (?, ?, ?, 'demo', 1, ?, ?)`
        )
        .run(DEMO_TENANT_USER_ID, DEMO_TENANT_EMAIL, 'Aarav Mehta Studio (Demo Workspace)', now, now);

      await this.db
        .prepare(
          `INSERT INTO settings (user_id, business_name, business_email, default_currency, max_invoice_amount_minor, default_payment_terms_days, created_at, updated_at)
           VALUES (?, 'Aarav Mehta Design & Engineering', ?, 'USD', 2500000, 14, ?, ?)`
        )
        .run(DEMO_TENANT_USER_ID, DEMO_TENANT_EMAIL, now, now);

      const c1 = await this.createClient(DEMO_TENANT_USER_ID, {
        id: 'cli_elena_01',
        fullName: 'Elena Vance',
        companyName: 'Black Mesa Research Labs',
        email: 'elena.vance@blackmesa.example.com',
        defaultCurrency: 'USD',
        notes: 'Monthly enterprise instrumentation retainer.'
      });

      const c2 = await this.createClient(DEMO_TENANT_USER_ID, {
        id: 'cli_marcus_02',
        fullName: 'Marcus Aurelius',
        companyName: 'Meditations Media',
        email: 'marcus@meditations.example.com',
        defaultCurrency: 'USD',
        notes: 'Quarterly publishing design sprint.'
      });

      const inv1 = await this.createInvoiceDraft(DEMO_TENANT_USER_ID, {
        id: 'inv_demo_01',
        clientId: c1.id,
        invoiceNumber: 'INV-DEMO-1001',
        currencyCode: 'USD',
        taxRateBps: 500,
        issueDate: '2026-10-15',
        dueDate: '2026-10-29',
        notes: 'Retainer for Stage 01 through Stage 09 sprint deliverables.',
        items: [
          {
            description: 'Full-Stack Architecture & Security Audit',
            quantity: 1,
            unitAmountMinor: 200000,
            currencyCode: 'USD'
          }
        ]
      });

      const user = (await this.getUserById(DEMO_TENANT_USER_ID))!;
      const settings = (await this.getSettings(DEMO_TENANT_USER_ID))!;
      return { user, demoUser: user, settings, clients: [c1, c2], invoices: [inv1] };
    });
  }
}
