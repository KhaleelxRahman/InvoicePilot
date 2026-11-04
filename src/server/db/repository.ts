import crypto from 'node:crypto';
import type { ISqlDatabase } from './types.js';
import { getCurrencyExponent, formatMinorUnitsToDecimal } from './schema.js';
import type { PayPalMode } from '../config.js';
import type { ProviderConfirmedStatus } from '../paypal/adapter.js';
import {
  buildGroundedFinancialInsights,
  type GroundedFinancialInsights
} from '../insights/cashFlowInsights.js';

export const DEMO_TENANT_USER_ID = 'usr_demo_tenant_01';
export const DEMO_TENANT_EMAIL = 'demo.freelancer@invoicepilot.local';

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

export interface OnboardingRecord {
  userId: string;
  currentStep: number;
  completed: boolean;
  skipped: boolean;
  businessName?: string;
  businessEmail?: string;
  defaultCurrency: string;
  maxInvoiceAmountMinor: number;
  defaultReminderTone: 'polite' | 'firm' | 'final';
  sandboxTested: boolean;
  firstClientId?: string;
  updatedAt: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface SettingsRecord {
  userId: string;
  businessName: string;
  businessEmail: string;
  defaultCurrency: string;
  maxInvoiceAmountMinor: number;
  defaultPaymentTermsDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientRecord {
  id: string;
  ownerUserId: string;
  fullName: string;
  companyName?: string;
  email: string;
  defaultCurrency: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItemRecord {
  id: string;
  invoiceId: string;
  ownerUserId: string;
  position: number;
  description: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
  createdAt: string;
}

export type LocalInvoiceStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'CANCELLED'
  | 'FAILED';

export interface InvoiceRecord {
  id: string;
  ownerUserId: string;
  clientId: string;
  invoiceNumber: string;
  currencyCode: string;
  subtotalMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  paidAmountMinor: number;
  isCompleted?: boolean;
  completedAt?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  localStatus: LocalInvoiceStatus;
  providerMode: PayPalMode;
  providerInvoiceId?: string;
  providerStatus: 'NONE' | ProviderConfirmedStatus;
  providerRecipientViewUrl?: string;
  providerInvoicerViewUrl?: string;
  lastProviderSyncAt?: string;
  items: InvoiceLineItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export type PendingActionState =
  | 'DRAFTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED';

export interface PendingActionRecord {
  id: string;
  ownerUserId: string;
  actionType: 'SEND_INVOICE' | 'SEND_REMINDER';
  targetInvoiceId: string;
  state: PendingActionState;
  payloadJson: string;
  payloadHash: string;
  idempotencyKey: string;
  expiresAt: string;
  approvedAt?: string;
  executedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSlipPayload {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientFullName: string;
  clientCompanyName?: string;
  clientEmail: string;
  currencyCode: string;
  subtotalMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  issueDate: string;
  dueDate: string;
  notes?: string;
  providerMode: PayPalMode;
  items: Array<{
    description: string;
    quantity: number;
    unitAmountMinor: number;
    lineTotalMinor: number;
    currencyCode: string;
  }>;
  warnings: string[];
  whatWillHappen: string;
}

export interface ActivityRecord {
  id: string;
  ownerUserId: string;
  actorType: 'user' | 'agent' | 'provider' | 'system';
  action: string;
  entityType: string;
  entityId: string;
  result: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'INFO';
  detailJson: string;
  correlationId?: string;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  providerEventId: string;
  eventType: string;
  verificationStatus: 'VERIFIED' | 'REJECTED';
  processingStatus: 'PROCESSED' | 'IGNORED' | 'FAILED';
  relatedProviderInvoiceId?: string;
  payloadHash: string;
  receivedAt: string;
  processedAt?: string;
}

export interface NotificationRecord {
  id: string;
  ownerUserId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export type ReminderTone = 'polite' | 'firm' | 'final';
export type ReminderApprovalState =
  | 'DRAFTED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'SENT'
  | 'REJECTED'
  | 'FAILED';

export interface ReminderRecord {
  id: string;
  ownerUserId: string;
  invoiceId: string;
  tone: ReminderTone;
  subject: string;
  body: string;
  approvalState: ReminderApprovalState;
  scheduledFor?: string;
  sentAt?: string;
  deliveryEvidence?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceLineItemInput {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  currencyCode?: string;
}

export interface CreateInvoiceInput {
  clientId: string;
  invoiceNumber: string;
  currencyCode: string;
  taxRateBps?: number;
  issueDate: string;
  dueDate: string;
  notes?: string;
  providerMode?: PayPalMode;
  items: CreateInvoiceLineItemInput[];
}

export interface InvoiceTemplateRecord {
  id: string;
  ownerUserId: string;
  title: string;
  description: string;
  unitAmountMinor: number;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  title: string;
  description: string;
  unitAmountMinor: number;
  currencyCode: string;
}

export interface WebhookEventDetailRecord {
  id: string;
  providerEventId: string;
  eventType: string;
  summary: string;
  verificationStatus: 'VERIFIED' | 'REJECTED';
  processingStatus: 'PROCESSED' | 'IGNORED' | 'FAILED';
  relatedProviderInvoiceId?: string;
  payloadHash: string;
  receivedAt: string;
  processedAt?: string;
}

export class OwnershipOrValidationError extends Error {
  public readonly code:
    | 'NOT_FOUND'
    | 'FORBIDDEN_OWNER_MISMATCH'
    | 'VALIDATION_ERROR'
    | 'DUPLICATE_EVENT'
    | 'INVALID_STATE_TRANSITION'
    | 'INVOICE_ALREADY_COMPLETED';

  public constructor(
    code:
      | 'NOT_FOUND'
      | 'FORBIDDEN_OWNER_MISMATCH'
      | 'VALIDATION_ERROR'
      | 'DUPLICATE_EVENT'
      | 'INVALID_STATE_TRANSITION'
      | 'INVOICE_ALREADY_COMPLETED',
    message: string
  ) {
    super(message);
    this.name = 'OwnershipOrValidationError';
    this.code = code;
  }
}

function computeCanonicalHash(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export function isValidIsoCalendarDate(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function validateSupportedCurrency(rawCurrency: string): string {
  if (typeof rawCurrency !== 'string' || !rawCurrency.trim()) {
    throw new OwnershipOrValidationError('VALIDATION_ERROR', 'A valid 3-letter currency code is required.');
  }
  const normalized = rawCurrency.trim().toUpperCase();
  try {
    getCurrencyExponent(normalized);
    return normalized;
  } catch (err) {
    throw new OwnershipOrValidationError(
      'VALIDATION_ERROR',
      err instanceof Error ? err.message : `Unsupported currency code "${rawCurrency}".`
    );
  }
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export class InvoicePilotRepository {
  private transactionDepth = 0;

  public constructor(private readonly db: ISqlDatabase) {}

  public withTransaction<T>(fn: () => T): T {
    if (this.transactionDepth > 0) {
      const savepointName = `sp_${this.transactionDepth}`;
      this.transactionDepth += 1;
      this.db.exec(`SAVEPOINT ${savepointName};`);
      try {
        const result = fn();
        this.db.exec(`RELEASE SAVEPOINT ${savepointName};`);
        return result;
      } catch (err) {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${savepointName};`);
        this.db.exec(`RELEASE SAVEPOINT ${savepointName};`);
        throw err;
      } finally {
        this.transactionDepth -= 1;
      }
    }

    this.transactionDepth += 1;
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  public createUser(input: {
    id?: string;
    email: string;
    displayName: string;
    authProvider?: string;
    passwordHash?: string;
    isDemo?: boolean;
  }): UserRecord {
    const now = new Date().toISOString();
    const id = input.id ?? `usr_${crypto.randomUUID()}`;
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const authProvider = input.authProvider ?? 'session';
    const isDemoInt = input.isDemo ? 1 : 0;

    return this.withTransaction(() => {
      this.db
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

      this.db
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

  public getUserById(userId: string): UserRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, email, display_name, auth_provider, is_demo, created_at, updated_at
         FROM users WHERE id = ?`
      )
      .get(userId) as
      | {
          id: string;
          email: string;
          display_name: string;
          auth_provider: string;
          is_demo: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;

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

  public getUserByEmail(email: string): (UserRecord & { passwordHash?: string | null }) | null {
    const row = this.db
      .prepare(
        `SELECT id, email, display_name, auth_provider, password_hash, is_demo, created_at, updated_at
         FROM users WHERE email = ?`
      )
      .get(email.trim().toLowerCase()) as
      | {
          id: string;
          email: string;
          display_name: string;
          auth_provider: string;
          password_hash: string | null;
          is_demo: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;

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

  public createSession(
    userId: string,
    ttlSeconds = 7 * 24 * 3600
  ): { session: SessionRecord; rawToken: string } {
    const user = this.getUserById(userId);
    if (!user) {
      throw new OwnershipOrValidationError('NOT_FOUND', `User "${userId}" does not exist.`);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const id = `ses_${crypto.randomUUID()}`;

    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, userId, tokenHash, expiresAt, now.toISOString());

    return {
      rawToken,
      session: {
        id,
        userId,
        tokenHash,
        expiresAt,
        createdAt: now.toISOString()
      }
    };
  }

  public getSessionByToken(
    rawToken: string
  ): { session: SessionRecord; user: UserRecord } | null {
    if (!rawToken || typeof rawToken !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const nowIso = new Date().toISOString();

    const row = this.db
      .prepare(
        `SELECT s.id AS s_id, s.user_id, s.token_hash, s.expires_at, s.created_at AS s_created_at,
                u.id AS u_id, u.email, u.display_name, u.auth_provider, u.is_demo, u.created_at AS u_created_at, u.updated_at AS u_updated_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?`
      )
      .get(tokenHash) as
      | {
          s_id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          s_created_at: string;
          u_id: string;
          email: string;
          display_name: string;
          auth_provider: string;
          is_demo: number;
          u_created_at: string;
          u_updated_at: string;
        }
      | undefined;

    if (!row) return null;

    if (row.expires_at <= nowIso) {
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(row.s_id);
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

  public deleteSession(rawToken: string): boolean {
    if (!rawToken) return false;
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const res = this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return res.changes > 0;
  }

  public getOnboardingProgress(userId: string): OnboardingRecord {
    const row = this.db
      .prepare(
        `SELECT user_id, current_step, completed, skipped, business_name, business_email,
                default_currency, max_invoice_amount_minor, default_reminder_tone, sandbox_tested,
                first_client_id, updated_at
         FROM onboarding_progress
         WHERE user_id = ?`
      )
      .get(userId) as
      | {
          user_id: string;
          current_step: number;
          completed: number;
          skipped: number;
          business_name: string | null;
          business_email: string | null;
          default_currency: string;
          max_invoice_amount_minor: number;
          default_reminder_tone: string;
          sandbox_tested: number;
          first_client_id: string | null;
          updated_at: string;
        }
      | undefined;

    if (row) {
      return {
        userId: row.user_id,
        currentStep: row.current_step,
        completed: row.completed === 1,
        skipped: row.skipped === 1,
        businessName: row.business_name ?? undefined,
        businessEmail: row.business_email ?? undefined,
        defaultCurrency: row.default_currency,
        maxInvoiceAmountMinor: row.max_invoice_amount_minor,
        defaultReminderTone: (row.default_reminder_tone as 'polite' | 'firm' | 'final') ?? 'polite',
        sandboxTested: row.sandbox_tested === 1,
        firstClientId: row.first_client_id ?? undefined,
        updatedAt: row.updated_at
      };
    }

    const settings = this.getSettings(userId);
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO onboarding_progress (
          user_id, current_step, completed, skipped, business_name, business_email,
          default_currency, max_invoice_amount_minor, default_reminder_tone, sandbox_tested,
          first_client_id, updated_at
        ) VALUES (?, 1, 0, 0, ?, ?, ?, ?, 'polite', 0, NULL, ?)`
      )
      .run(
        userId,
        settings?.businessName ?? null,
        settings?.businessEmail ?? null,
        settings?.defaultCurrency ?? 'USD',
        settings?.maxInvoiceAmountMinor ?? 1000000,
        now
      );

    return {
      userId,
      currentStep: 1,
      completed: false,
      skipped: false,
      businessName: settings?.businessName,
      businessEmail: settings?.businessEmail,
      defaultCurrency: settings?.defaultCurrency ?? 'USD',
      maxInvoiceAmountMinor: settings?.maxInvoiceAmountMinor ?? 1000000,
      defaultReminderTone: 'polite',
      sandboxTested: false,
      updatedAt: now
    };
  }

  public updateOnboardingProgress(
    userId: string,
    patch: {
      currentStep?: number;
      completed?: boolean;
      skipped?: boolean;
      businessName?: string;
      businessEmail?: string;
      defaultCurrency?: string;
      maxInvoiceAmountMinor?: number;
      defaultReminderTone?: 'polite' | 'firm' | 'final';
      sandboxTested?: boolean;
      firstClientId?: string;
    }
  ): OnboardingRecord {
    const existing = this.getOnboardingProgress(userId);
    const now = new Date().toISOString();

    const nextStep = patch.currentStep ?? existing.currentStep;
    const completed = patch.completed !== undefined ? (patch.completed ? 1 : 0) : (existing.completed ? 1 : 0);
    const skipped = patch.skipped !== undefined ? (patch.skipped ? 1 : 0) : (existing.skipped ? 1 : 0);
    const businessName = patch.businessName ?? existing.businessName ?? null;
    const businessEmail = patch.businessEmail ?? existing.businessEmail ?? null;
    const defaultCurrency = patch.defaultCurrency ?? existing.defaultCurrency;
    const maxAmount = patch.maxInvoiceAmountMinor ?? existing.maxInvoiceAmountMinor;
    const reminderTone = patch.defaultReminderTone ?? existing.defaultReminderTone;
    const sandboxTested = patch.sandboxTested !== undefined ? (patch.sandboxTested ? 1 : 0) : (existing.sandboxTested ? 1 : 0);
    const firstClientId = patch.firstClientId ?? existing.firstClientId ?? null;

    this.db
      .prepare(
        `UPDATE onboarding_progress
         SET current_step = ?, completed = ?, skipped = ?, business_name = ?, business_email = ?,
             default_currency = ?, max_invoice_amount_minor = ?, default_reminder_tone = ?,
             sandbox_tested = ?, first_client_id = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(
        nextStep,
        completed,
        skipped,
        businessName,
        businessEmail,
        defaultCurrency,
        maxAmount,
        reminderTone,
        sandboxTested,
        firstClientId,
        now,
        userId
      );

    if (patch.businessName || patch.businessEmail || patch.defaultCurrency || patch.maxInvoiceAmountMinor) {
      this.updateSettings(userId, {
        businessName: patch.businessName,
        businessEmail: patch.businessEmail,
        defaultCurrency: patch.defaultCurrency,
        maxInvoiceAmountMinor: patch.maxInvoiceAmountMinor
      });
    }

    return this.getOnboardingProgress(userId);
  }

  public getSettings(ownerUserId: string): SettingsRecord | null {
    const row = this.db
      .prepare(
        `SELECT user_id, business_name, business_email, default_currency, max_invoice_amount_minor, default_payment_terms_days, created_at, updated_at
         FROM settings WHERE user_id = ?`
      )
      .get(ownerUserId) as
      | {
          user_id: string;
          business_name: string;
          business_email: string;
          default_currency: string;
          max_invoice_amount_minor: number;
          default_payment_terms_days: number;
          created_at: string;
          updated_at: string;
        }
      | undefined;

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

  public updateSettings(
    ownerUserId: string,
    patch: {
      businessName?: string;
      businessEmail?: string;
      defaultCurrency?: string;
      maxInvoiceAmountMinor?: number;
      defaultPaymentTermsDays?: number;
    }
  ): SettingsRecord {
    const existing = this.getSettings(ownerUserId);
    if (!existing) {
      throw new OwnershipOrValidationError('NOT_FOUND', 'User settings not found.');
    }

    const nextCurrency = validateSupportedCurrency(patch.defaultCurrency ?? existing.defaultCurrency);

    const nextMaxAmount = patch.maxInvoiceAmountMinor ?? existing.maxInvoiceAmountMinor;
    if (!Number.isSafeInteger(nextMaxAmount) || nextMaxAmount <= 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'maxInvoiceAmountMinor must be a positive integer.'
      );
    }

    const nextTerms = patch.defaultPaymentTermsDays ?? existing.defaultPaymentTermsDays;
    if (!Number.isSafeInteger(nextTerms) || nextTerms < 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'defaultPaymentTermsDays must be a non-negative integer.'
      );
    }

    const now = new Date().toISOString();
    const businessName = (patch.businessName ?? existing.businessName).trim();
    const businessEmail = (patch.businessEmail ?? existing.businessEmail).trim().toLowerCase();

    this.db
      .prepare(
        `UPDATE settings
         SET business_name = ?, business_email = ?, default_currency = ?, max_invoice_amount_minor = ?, default_payment_terms_days = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(businessName, businessEmail, nextCurrency, nextMaxAmount, nextTerms, now, ownerUserId);

    return {
      userId: ownerUserId,
      businessName,
      businessEmail,
      defaultCurrency: nextCurrency,
      maxInvoiceAmountMinor: nextMaxAmount,
      defaultPaymentTermsDays: nextTerms,
      createdAt: existing.createdAt,
      updatedAt: now
    };
  }

  public createClient(
    ownerUserId: string,
    input: {
      id?: string;
      fullName: string;
      companyName?: string;
      email: string;
      defaultCurrency?: string;
      notes?: string;
    }
  ): ClientRecord {
    const currency = validateSupportedCurrency(input.defaultCurrency ?? 'USD');

    const fullName = (input.fullName ?? '').trim();
    const email = (input.email ?? '').trim().toLowerCase();
    if (!fullName || !isValidEmailAddress(email)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and a valid email address are required.'
      );
    }

    const duplicate = this.db
      .prepare('SELECT id FROM clients WHERE owner_user_id = ? AND email = ?')
      .get(ownerUserId, email) as { id: string } | undefined;
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

    this.db
      .prepare(
        `INSERT INTO clients (id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        ownerUserId,
        fullName,
        companyName ?? null,
        email,
        currency,
        notes ?? null,
        now,
        now
      );

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

  public listClientsForOwner(ownerUserId: string): ClientRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at
         FROM clients
         WHERE owner_user_id = ?
         ORDER BY created_at DESC`
      )
      .all(ownerUserId) as Array<{
      id: string;
      owner_user_id: string;
      full_name: string;
      company_name: string | null;
      email: string;
      default_currency: string;
      notes: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      fullName: row.full_name,
      companyName: row.company_name ?? undefined,
      email: row.email,
      defaultCurrency: row.default_currency,
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public getClientForOwner(ownerUserId: string, clientId: string): ClientRecord {
    const row = this.db
      .prepare(
        `SELECT id, owner_user_id, full_name, company_name, email, default_currency, notes, created_at, updated_at
         FROM clients WHERE id = ?`
      )
      .get(clientId) as
      | {
          id: string;
          owner_user_id: string;
          full_name: string;
          company_name: string | null;
          email: string;
          default_currency: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Client "${clientId}" not found.`);
    }
    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'Access denied: client belongs to a different owner.'
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

  public updateClientForOwner(
    ownerUserId: string,
    clientId: string,
    patch: {
      fullName?: string;
      companyName?: string;
      email?: string;
      defaultCurrency?: string;
      notes?: string;
    }
  ): ClientRecord {
    const existing = this.getClientForOwner(ownerUserId, clientId);
    const fullName = (patch.fullName ?? existing.fullName).trim();
    const email = (patch.email ?? existing.email).trim().toLowerCase();
    const defaultCurrency = validateSupportedCurrency(
      patch.defaultCurrency ?? existing.defaultCurrency
    );

    if (!fullName || !isValidEmailAddress(email)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and valid email are required.'
      );
    }

    const duplicate = this.db
      .prepare('SELECT id FROM clients WHERE owner_user_id = ? AND email = ? AND id != ?')
      .get(ownerUserId, email, clientId) as { id: string } | undefined;
    if (duplicate) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `A client with email "${email}" already exists in this workspace.`
      );
    }

    const companyName =
      patch.companyName !== undefined ? patch.companyName.trim() || undefined : existing.companyName;
    const notes = patch.notes !== undefined ? patch.notes.trim() || undefined : existing.notes;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE clients
         SET full_name = ?, company_name = ?, email = ?, default_currency = ?, notes = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(
        fullName,
        companyName ?? null,
        email,
        defaultCurrency,
        notes ?? null,
        now,
        clientId,
        ownerUserId
      );

    return {
      ...existing,
      fullName,
      companyName,
      email,
      defaultCurrency,
      notes,
      updatedAt: now
    };
  }

  public deleteClientForOwner(ownerUserId: string, clientId: string): void {
    this.getClientForOwner(ownerUserId, clientId);
    const linkedInvoices = this.db
      .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE owner_user_id = ? AND client_id = ?')
      .get(ownerUserId, clientId) as { cnt: number };
    if (linkedInvoices && linkedInvoices.cnt > 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot delete client because one or more invoices are linked to this client.'
      );
    }
    this.db
      .prepare('DELETE FROM clients WHERE id = ? AND owner_user_id = ?')
      .run(clientId, ownerUserId);
  }

  private validateAndCalculateInvoiceDraft(
    ownerUserId: string,
    input: CreateInvoiceInput,
    existingInvoiceId?: string
  ): {
    invoiceNumber: string;
    currencyCode: string;
    taxRateBps: number;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    issueDate: string;
    dueDate: string;
    notes?: string;
    preparedItems: Array<{
      id: string;
      position: number;
      description: string;
      quantity: number;
      unitAmountMinor: number;
      lineTotalMinor: number;
      currencyCode: string;
    }>;
  } {
    // 1. Verify client exists and belongs to the same owner
    this.getClientForOwner(ownerUserId, input.clientId);

    // 2. Validate invoice number and uniqueness per owner
    const invoiceNumber = (input.invoiceNumber ?? '').trim();
    if (!invoiceNumber || invoiceNumber.length > 64) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice number is required and must be at most 64 characters.'
      );
    }

    const dupRow = existingInvoiceId
      ? (this.db
          .prepare(
            'SELECT id FROM invoices WHERE owner_user_id = ? AND invoice_number = ? AND id != ?'
          )
          .get(ownerUserId, invoiceNumber, existingInvoiceId) as { id: string } | undefined)
      : (this.db
          .prepare('SELECT id FROM invoices WHERE owner_user_id = ? AND invoice_number = ?')
          .get(ownerUserId, invoiceNumber) as { id: string } | undefined);
    if (dupRow) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Invoice number "${invoiceNumber}" already exists in this workspace.`
      );
    }

    // 3. Validate currency code
    const currencyCode = validateSupportedCurrency(input.currencyCode);

    // 4. Validate issueDate and dueDate calendar dates and ordering
    const issueDate = (input.issueDate ?? '').trim();
    const dueDate = (input.dueDate ?? '').trim();
    if (!isValidIsoCalendarDate(issueDate) || !isValidIsoCalendarDate(dueDate)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Issue date and due date must be valid YYYY-MM-DD calendar dates.'
      );
    }
    if (dueDate < issueDate) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Due date must be on or after the issue date.'
      );
    }

    // 5. Validate line items and tax
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'An invoice must include at least one line item.'
      );
    }

    const taxRateBps = input.taxRateBps ?? 0;
    if (!Number.isSafeInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'taxRateBps must be an integer between 0 and 10000 (0% to 100%).'
      );
    }

    let subtotalMinor = 0;
    const preparedItems: Array<{
      id: string;
      position: number;
      description: string;
      quantity: number;
      unitAmountMinor: number;
      lineTotalMinor: number;
      currencyCode: string;
    }> = [];

    for (let idx = 0; idx < input.items.length; idx++) {
      const item = input.items[idx];
      const description = (item?.description ?? '').trim();
      if (!description) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} description is required.`
        );
      }

      const itemCurrency = validateSupportedCurrency(item.currencyCode ?? currencyCode);
      if (itemCurrency !== currencyCode) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} currency (${itemCurrency}) must match invoice currency (${currencyCode}).`
        );
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} quantity must be a positive integer.`
        );
      }
      if (!Number.isSafeInteger(item.unitAmountMinor) || item.unitAmountMinor <= 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} unitAmountMinor must be a positive integer.`
        );
      }

      const lineTotalMinor = item.quantity * item.unitAmountMinor;
      subtotalMinor += lineTotalMinor;
      preparedItems.push({
        id: `itm_${crypto.randomUUID()}`,
        position: idx,
        description,
        quantity: item.quantity,
        unitAmountMinor: item.unitAmountMinor,
        lineTotalMinor,
        currencyCode
      });
    }

    const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
    const totalMinor = subtotalMinor + taxMinor;

    // 6. Enforce owner's safety amount limit if settings exist
    const settings = this.getSettings(ownerUserId);
    if (settings && totalMinor > settings.maxInvoiceAmountMinor) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Invoice total (${totalMinor} minor units) exceeds the configured safety limit (${settings.maxInvoiceAmountMinor} minor units).`
      );
    }

    return {
      invoiceNumber,
      currencyCode,
      taxRateBps,
      subtotalMinor,
      taxMinor,
      totalMinor,
      issueDate,
      dueDate,
      notes: input.notes?.trim() || undefined,
      preparedItems
    };
  }

  /**
   * Creates a local invoice draft with server-validated line items, tax, totals, and ownership.
   * Never sends to PayPal from draft creation.
   */
  public createInvoiceDraft(
    ownerUserId: string,
    input: CreateInvoiceInput & { id?: string }
  ): InvoiceRecord {
    const validated = this.validateAndCalculateInvoiceDraft(ownerUserId, input);
    const now = new Date().toISOString();
    const invoiceId = input.id ?? `inv_${crypto.randomUUID()}`;
    const providerMode: PayPalMode = input.providerMode ?? 'sandbox';

    return this.withTransaction(() => {
      this.db
        .prepare(
          `INSERT INTO invoices (
            id, owner_user_id, client_id, invoice_number, currency_code,
            subtotal_minor, tax_rate_bps, tax_minor, total_minor,
            issue_date, due_date, notes, local_status,
            provider_mode, provider_invoice_id, provider_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, NULL, 'NONE', ?, ?)`
        )
        .run(
          invoiceId,
          ownerUserId,
          input.clientId,
          validated.invoiceNumber,
          validated.currencyCode,
          validated.subtotalMinor,
          validated.taxRateBps,
          validated.taxMinor,
          validated.totalMinor,
          validated.issueDate,
          validated.dueDate,
          validated.notes ?? null,
          providerMode,
          now,
          now
        );

      const insertItemStmt = this.db.prepare(
        `INSERT INTO invoice_items (
          id, invoice_id, owner_user_id, position, description,
          quantity, unit_amount_minor, line_total_minor, currency_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const itemRecords: InvoiceLineItemRecord[] = [];
      for (const item of validated.preparedItems) {
        insertItemStmt.run(
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
        itemRecords.push({
          ...item,
          invoiceId,
          ownerUserId,
          createdAt: now
        });
      }

      return {
        id: invoiceId,
        ownerUserId,
        clientId: input.clientId,
        invoiceNumber: validated.invoiceNumber,
        currencyCode: validated.currencyCode,
        subtotalMinor: validated.subtotalMinor,
        taxRateBps: validated.taxRateBps,
        taxMinor: validated.taxMinor,
        totalMinor: validated.totalMinor,
        paidAmountMinor: 0,
        issueDate: validated.issueDate,
        dueDate: validated.dueDate,
        notes: validated.notes,
        localStatus: 'DRAFT',
        providerMode,
        providerStatus: 'NONE',
        items: itemRecords,
        createdAt: now,
        updatedAt: now
      };
    });
  }

  /**
   * Updates an owned local invoice draft before it has been sent (`localStatus !== 'SENT'`),
   * recalculating all line totals, subtotal, tax, and total on the server and resetting
   * `local_status` to `'DRAFT'` (which makes any older approval slip payload hash stale).
   */
  public updateInvoiceDraftForOwner(
    ownerUserId: string,
    invoiceId: string,
    patch: Partial<CreateInvoiceInput>
  ): InvoiceRecord {
    const existing = this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (existing.localStatus === 'SENT' || existing.localStatus === 'CANCELLED' || existing.providerInvoiceId) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Only local unsent invoices can be edited.'
      );
    }

    const mergedCurrency = patch.currencyCode ?? existing.currencyCode;
    const mergedInput: CreateInvoiceInput = {
      clientId: patch.clientId ?? existing.clientId,
      invoiceNumber: patch.invoiceNumber ?? existing.invoiceNumber,
      currencyCode: mergedCurrency,
      taxRateBps: patch.taxRateBps !== undefined ? patch.taxRateBps : existing.taxRateBps,
      issueDate: patch.issueDate ?? existing.issueDate,
      dueDate: patch.dueDate ?? existing.dueDate,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      providerMode: patch.providerMode ?? existing.providerMode,
      items:
        patch.items ??
        existing.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitAmountMinor: it.unitAmountMinor,
          currencyCode: patch.currencyCode ? mergedCurrency : it.currencyCode
        }))
    };

    const validated = this.validateAndCalculateInvoiceDraft(ownerUserId, mergedInput, invoiceId);
    const now = new Date().toISOString();

    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE invoices
           SET client_id = ?,
               invoice_number = ?,
               currency_code = ?,
               subtotal_minor = ?,
               tax_rate_bps = ?,
               tax_minor = ?,
               total_minor = ?,
               issue_date = ?,
               due_date = ?,
               notes = ?,
               local_status = 'DRAFT',
               updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(
          mergedInput.clientId,
          validated.invoiceNumber,
          validated.currencyCode,
          validated.subtotalMinor,
          validated.taxRateBps,
          validated.taxMinor,
          validated.totalMinor,
          validated.issueDate,
          validated.dueDate,
          validated.notes ?? null,
          now,
          invoiceId,
          ownerUserId
        );

      this.db
        .prepare('DELETE FROM invoice_items WHERE invoice_id = ? AND owner_user_id = ?')
        .run(invoiceId, ownerUserId);

      const insertItemStmt = this.db.prepare(
        `INSERT INTO invoice_items (
          id, invoice_id, owner_user_id, position, description,
          quantity, unit_amount_minor, line_total_minor, currency_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const item of validated.preparedItems) {
        insertItemStmt.run(
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

      return this.getInvoiceForOwner(ownerUserId, invoiceId);
    });
  }

  public listInvoicesForClient(ownerUserId: string, clientId: string): InvoiceRecord[] {
    this.getClientForOwner(ownerUserId, clientId);
    const rows = this.db
      .prepare(
        'SELECT id FROM invoices WHERE owner_user_id = ? AND client_id = ? ORDER BY created_at DESC'
      )
      .all(ownerUserId, clientId) as Array<{ id: string }>;
    return rows.map((r) => this.getInvoiceForOwner(ownerUserId, r.id));
  }

  public getInvoiceForOwner(ownerUserId: string, invoiceId: string): InvoiceRecord {
    const row = this.db
      .prepare(
        `SELECT
          id, owner_user_id, client_id, invoice_number, currency_code,
          subtotal_minor, tax_rate_bps, tax_minor, total_minor, paid_amount_minor,
          is_completed, completed_at,
          issue_date, due_date, notes, local_status,
          provider_mode, provider_invoice_id, provider_status,
          provider_recipient_view_url, provider_invoicer_view_url, last_provider_sync_at,
          created_at, updated_at
         FROM invoices WHERE id = ?`
      )
      .get(invoiceId) as
      | {
          id: string;
          owner_user_id: string;
          client_id: string;
          invoice_number: string;
          currency_code: string;
          subtotal_minor: number;
          tax_rate_bps: number;
          tax_minor: number;
          total_minor: number;
          paid_amount_minor: number | null;
          is_completed: number | null;
          completed_at: string | null;
          issue_date: string;
          due_date: string;
          notes: string | null;
          local_status: LocalInvoiceStatus;
          provider_mode: PayPalMode;
          provider_invoice_id: string | null;
          provider_status: 'NONE' | ProviderConfirmedStatus;
          provider_recipient_view_url: string | null;
          provider_invoicer_view_url: string | null;
          last_provider_sync_at: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Invoice "${invoiceId}" not found.`);
    }
    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'Access denied: invoice belongs to a different owner.'
      );
    }

    const itemRows = this.db
      .prepare(
        `SELECT id, invoice_id, owner_user_id, position, description, quantity, unit_amount_minor, line_total_minor, currency_code, created_at
         FROM invoice_items
         WHERE invoice_id = ? AND owner_user_id = ?
         ORDER BY position ASC`
      )
      .all(invoiceId, ownerUserId) as Array<{
      id: string;
      invoice_id: string;
      owner_user_id: string;
      position: number;
      description: string;
      quantity: number;
      unit_amount_minor: number;
      line_total_minor: number;
      currency_code: string;
      created_at: string;
    }>;

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      clientId: row.client_id,
      invoiceNumber: row.invoice_number,
      currencyCode: row.currency_code,
      subtotalMinor: row.subtotal_minor,
      taxRateBps: row.tax_rate_bps,
      taxMinor: row.tax_minor,
      totalMinor: row.total_minor,
      paidAmountMinor:
        row.paid_amount_minor ??
        (row.provider_status === 'PAID' || row.provider_status === 'MARKED_AS_PAID'
          ? row.total_minor
          : 0),
      isCompleted: Boolean(row.is_completed),
      completedAt: row.completed_at ?? undefined,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      notes: row.notes ?? undefined,
      localStatus: row.local_status,
      providerMode: row.provider_mode,
      providerInvoiceId: row.provider_invoice_id ?? undefined,
      providerStatus: row.provider_status,
      providerRecipientViewUrl: row.provider_recipient_view_url ?? undefined,
      providerInvoicerViewUrl: row.provider_invoicer_view_url ?? undefined,
      lastProviderSyncAt: row.last_provider_sync_at ?? undefined,
      items: itemRows.map((it) => ({
        id: it.id,
        invoiceId: it.invoice_id,
        ownerUserId: it.owner_user_id,
        position: it.position,
        description: it.description,
        quantity: it.quantity,
        unitAmountMinor: it.unit_amount_minor,
        lineTotalMinor: it.line_total_minor,
        currencyCode: it.currency_code,
        createdAt: it.created_at
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public markInvoiceCompleted(ownerUserId: string, invoiceId: string): InvoiceRecord {
    const invoice = this.getInvoiceForOwner(ownerUserId, invoiceId);

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
    this.db
      .prepare(
        'UPDATE invoices SET is_completed = 1, completed_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?'
      )
      .run(now, now, invoiceId, ownerUserId);

    this.appendActivityLog(ownerUserId, {
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

    return this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public listInvoicesForOwner(ownerUserId: string): InvoiceRecord[] {
    const rows = this.db
      .prepare('SELECT id FROM invoices WHERE owner_user_id = ? ORDER BY created_at DESC')
      .all(ownerUserId) as Array<{ id: string }>;
    return rows.map((r) => this.getInvoiceForOwner(ownerUserId, r.id));
  }

  /**
   * Updates provider-confirmed fields strictly on the server (never from untrusted browser input).
   * Keeps localStatus distinct from providerStatus.
   */
  public recordProviderInvoiceSync(
    ownerUserId: string,
    invoiceId: string,
    providerUpdate: {
      providerMode: PayPalMode;
      providerInvoiceId: string;
      providerStatus: ProviderConfirmedStatus;
      localStatus?: LocalInvoiceStatus;
      recipientViewUrl?: string;
      invoicerViewUrl?: string;
    }
  ): InvoiceRecord {
    const existing = this.getInvoiceForOwner(ownerUserId, invoiceId);
    const now = new Date().toISOString();
    const nextLocalStatus = providerUpdate.localStatus ?? existing.localStatus;

    this.db
      .prepare(
        `UPDATE invoices
         SET provider_mode = ?,
             provider_invoice_id = ?,
             provider_status = ?,
             local_status = ?,
             provider_recipient_view_url = COALESCE(?, provider_recipient_view_url),
             provider_invoicer_view_url = COALESCE(?, provider_invoicer_view_url),
             last_provider_sync_at = ?,
             updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(
        providerUpdate.providerMode,
        providerUpdate.providerInvoiceId,
        providerUpdate.providerStatus,
        nextLocalStatus,
        providerUpdate.recipientViewUrl ?? null,
        providerUpdate.invoicerViewUrl ?? null,
        now,
        now,
        invoiceId,
        ownerUserId
      );

    return this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public findInvoiceByProviderInvoiceId(providerInvoiceId: string): InvoiceRecord | null {
    const trimmed = (providerInvoiceId ?? '').trim();
    if (!trimmed) return null;
    const row = this.db
      .prepare('SELECT id, owner_user_id FROM invoices WHERE provider_invoice_id = ?')
      .get(trimmed) as { id: string; owner_user_id: string } | undefined;
    if (!row) return null;
    return this.getInvoiceForOwner(row.owner_user_id, row.id);
  }

  public refreshInvoiceProviderStatus(
    ownerUserId: string,
    invoiceId: string,
    snapshot: {
      providerMode: PayPalMode;
      isMock: boolean;
      providerInvoiceId: string;
      providerStatus: ProviderConfirmedStatus;
      recipientViewUrl?: string;
      invoicerViewUrl?: string;
      paypalDebugId?: string;
    },
    correlationId?: string
  ): InvoiceRecord {
    const existing = this.getInvoiceForOwner(ownerUserId, invoiceId);
    const nextLocalStatus: LocalInvoiceStatus =
      snapshot.providerStatus === 'SENT' ||
      snapshot.providerStatus === 'UNPAID' ||
      snapshot.providerStatus === 'PAID' ||
      snapshot.providerStatus === 'MARKED_AS_PAID'
        ? 'SENT'
        : snapshot.providerStatus === 'CANCELLED'
          ? 'CANCELLED'
          : existing.localStatus;

    return this.withTransaction(() => {
      const updated = this.recordProviderInvoiceSync(ownerUserId, invoiceId, {
        providerMode: snapshot.providerMode,
        providerInvoiceId: snapshot.providerInvoiceId,
        providerStatus: snapshot.providerStatus,
        localStatus: nextLocalStatus,
        recipientViewUrl: snapshot.recipientViewUrl,
        invoicerViewUrl: snapshot.invoicerViewUrl
      });

      this.appendActivityLog(ownerUserId, {
        actorType: 'provider',
        action: 'INVOICE_PROVIDER_STATUS_REFRESHED',
        entityType: 'invoice',
        entityId: invoiceId,
        result: 'INFO',
        detail: {
          invoiceNumber: updated.invoiceNumber,
          providerMode: snapshot.providerMode,
          isMock: snapshot.isMock,
          providerInvoiceId: snapshot.providerInvoiceId,
          previousProviderStatus: existing.providerStatus,
          providerStatus: snapshot.providerStatus,
          paypalDebugId: snapshot.paypalDebugId
        },
        correlationId
      });

      return updated;
    });
  }

  public createPendingAction(
    ownerUserId: string,
    input: {
      id?: string;
      actionType: 'SEND_INVOICE' | 'SEND_REMINDER';
      targetInvoiceId: string;
      payload: unknown;
      idempotencyKey?: string;
      expiresAt?: string;
      initialState?: PendingActionState;
    }
  ): PendingActionRecord {
    this.getInvoiceForOwner(ownerUserId, input.targetInvoiceId);

    const now = new Date().toISOString();
    const id = input.id ?? `act_${crypto.randomUUID()}`;
    const payloadJson = JSON.stringify(input.payload);
    const payloadHash = computeCanonicalHash(input.payload);
    const idempotencyKey = input.idempotencyKey ?? `idem_${crypto.randomUUID()}`;
    const expiresAt =
      input.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const state = input.initialState ?? 'PENDING_APPROVAL';

    this.db
      .prepare(
        `INSERT INTO pending_actions (
          id, owner_user_id, action_type, target_invoice_id, state,
          payload_json, payload_hash, idempotency_key, expires_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        ownerUserId,
        input.actionType,
        input.targetInvoiceId,
        state,
        payloadJson,
        payloadHash,
        idempotencyKey,
        expiresAt,
        now,
        now
      );

    return {
      id,
      ownerUserId,
      actionType: input.actionType,
      targetInvoiceId: input.targetInvoiceId,
      state,
      payloadJson,
      payloadHash,
      idempotencyKey,
      expiresAt,
      createdAt: now,
      updatedAt: now
    };
  }

  public getPendingActionForOwner(
    ownerUserId: string,
    actionId: string
  ): PendingActionRecord {
    const row = this.db
      .prepare(
        `SELECT id, owner_user_id, action_type, target_invoice_id, state,
                payload_json, payload_hash, idempotency_key, expires_at,
                approved_at, executed_at, failure_reason, created_at, updated_at
         FROM pending_actions WHERE id = ?`
      )
      .get(actionId) as
      | {
          id: string;
          owner_user_id: string;
          action_type: 'SEND_INVOICE' | 'SEND_REMINDER';
          target_invoice_id: string;
          state: PendingActionState;
          payload_json: string;
          payload_hash: string;
          idempotency_key: string;
          expires_at: string;
          approved_at: string | null;
          executed_at: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Action "${actionId}" not found.`);
    }
    if (row.owner_user_id !== ownerUserId) {
      throw new OwnershipOrValidationError(
        'FORBIDDEN_OWNER_MISMATCH',
        'Access denied: pending action belongs to a different owner.'
      );
    }

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      actionType: row.action_type,
      targetInvoiceId: row.target_invoice_id,
      state: row.state,
      payloadJson: row.payload_json,
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

  public listPendingActionsForOwner(
    ownerUserId: string,
    targetInvoiceId?: string
  ): PendingActionRecord[] {
    const rows = (
      targetInvoiceId
        ? this.db
            .prepare(
              `SELECT id FROM pending_actions
               WHERE owner_user_id = ? AND target_invoice_id = ?
               ORDER BY created_at DESC`
            )
            .all(ownerUserId, targetInvoiceId)
        : this.db
            .prepare(
              `SELECT id FROM pending_actions
               WHERE owner_user_id = ?
               ORDER BY created_at DESC`
            )
            .all(ownerUserId)
    ) as Array<{ id: string }>;

    return rows.map((r) => this.getPendingActionForOwner(ownerUserId, r.id));
  }

  public buildApprovalSlipPayload(
    ownerUserId: string,
    invoiceId: string,
    providerMode: PayPalMode = 'sandbox'
  ): { slip: ApprovalSlipPayload; canonicalHash: string } {
    const invoice = this.getInvoiceForOwner(ownerUserId, invoiceId);
    const client = this.getClientForOwner(ownerUserId, invoice.clientId);
    const settings = this.getSettings(ownerUserId);

    const warnings: string[] = [];
    if (providerMode === 'mock') {
      warnings.push(
        'Isolated Mock Mode active: execution creates a simulated local record (MOCK-LOCAL-...) and will NOT contact PayPal.'
      );
    } else {
      warnings.push(
        'PayPal Sandbox Mode active: execution will create and send a Sandbox invoice via api-m.sandbox.paypal.com (no real money).'
      );
    }

    if (settings && invoice.totalMinor >= Math.round(settings.maxInvoiceAmountMinor * 0.8)) {
      warnings.push(
        `High-value invoice: total (${invoice.totalMinor} minor units) is at or above 80% of your configured safety cap (${settings.maxInvoiceAmountMinor} minor units).`
      );
    }

    if (invoice.taxRateBps === 0) {
      warnings.push('Zero tax rate (0.00%) applied on this invoice.');
    }

    const whatWillHappen =
      providerMode === 'sandbox'
        ? `Approving and executing this slip authorizes the server to create a PayPal Sandbox invoice for ${client.fullName} (${client.email}) and transmit it via PayPal Invoicing v2 Sandbox API.`
        : `Approving and executing this slip authorizes the server to simulate sending this invoice to ${client.fullName} (${client.email}) in Isolated Mock Mode without external network calls.`;

    const canonicalObject = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: client.id,
      clientEmail: client.email,
      currencyCode: invoice.currencyCode,
      subtotalMinor: invoice.subtotalMinor,
      taxRateBps: invoice.taxRateBps,
      taxMinor: invoice.taxMinor,
      totalMinor: invoice.totalMinor,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes ?? '',
      items: invoice.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitAmountMinor: it.unitAmountMinor,
        lineTotalMinor: it.lineTotalMinor,
        currencyCode: it.currencyCode
      }))
    };

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

    return {
      slip,
      canonicalHash: computeCanonicalHash(canonicalObject)
    };
  }

  private assertInvoiceValidForApprovalOrExecution(
    ownerUserId: string,
    invoice: InvoiceRecord,
    actionIdForLog?: string,
    correlationId?: string
  ): void {
    validateSupportedCurrency(invoice.currencyCode);
    if (!isValidIsoCalendarDate(invoice.issueDate) || !isValidIsoCalendarDate(invoice.dueDate)) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice dates are invalid.'
      );
    }
    if (invoice.dueDate < invoice.issueDate) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice due date must be on or after the issue date.'
      );
    }
    if (!invoice.items || invoice.items.length === 0 || invoice.totalMinor <= 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice must contain at least one positive line item.'
      );
    }

    const settings = this.getSettings(ownerUserId);
    if (settings && invoice.totalMinor > settings.maxInvoiceAmountMinor) {
      if (actionIdForLog) {
        const now = new Date().toISOString();
        this.db
          .prepare(
            `UPDATE pending_actions SET state = 'FAILED', failure_reason = ?, updated_at = ?
             WHERE id = ? AND owner_user_id = ?`
          )
          .run('Invoice exceeds configured safety limit.', now, actionIdForLog, ownerUserId);
      }
      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_BLOCKED_OVER_LIMIT',
        entityType: 'invoice',
        entityId: invoice.id,
        result: 'FAILED',
        detail: {
          actionId: actionIdForLog,
          totalMinor: invoice.totalMinor,
          maxInvoiceAmountMinor: settings.maxInvoiceAmountMinor
        },
        correlationId
      });
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Invoice total (${invoice.totalMinor} minor units) exceeds the configured safety limit (${settings.maxInvoiceAmountMinor} minor units).`
      );
    }
  }

  /**
   * Stage 06: Proposes an owned invoice draft for human approval (`DRAFTED -> PENDING_APPROVAL`).
   * Supersedes any older unexecuted pending actions for the same invoice if its payload changed,
   * or returns the existing active slip idempotently if identical and unexpired.
   */
  public requestInvoiceSendApproval(
    ownerUserId: string,
    invoiceId: string,
    options?: {
      providerMode?: PayPalMode;
      expiresAt?: string;
      correlationId?: string;
    }
  ): { action: PendingActionRecord; slip: ApprovalSlipPayload } {
    const invoice = this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (
      invoice.localStatus === 'SENT' ||
      (invoice.providerInvoiceId &&
        invoice.providerStatus !== 'NONE' &&
        invoice.providerStatus !== 'DRAFT')
    ) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Invoice has already been sent and cannot be queued for send approval again.'
      );
    }
    if (invoice.localStatus === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cancelled invoices cannot be queued for approval.'
      );
    }

    this.assertInvoiceValidForApprovalOrExecution(
      ownerUserId,
      invoice,
      undefined,
      options?.correlationId
    );

    const providerMode = options?.providerMode ?? invoice.providerMode ?? 'sandbox';
    const { slip, canonicalHash } = this.buildApprovalSlipPayload(
      ownerUserId,
      invoiceId,
      providerMode
    );

    // Check if an identical unexpired PENDING_APPROVAL action already exists (when no custom expiresAt is requested)
    if (!options?.expiresAt) {
      const existingActions = this.listPendingActionsForOwner(ownerUserId, invoiceId);
      const matchingActive = existingActions.find(
        (a) =>
          a.actionType === 'SEND_INVOICE' &&
          a.state === 'PENDING_APPROVAL' &&
          a.payloadHash === canonicalHash &&
          Date.parse(a.expiresAt) > Date.now()
      );
      if (matchingActive) {
        return { action: matchingActive, slip };
      }
    }

    const now = new Date().toISOString();
    const id = `act_${crypto.randomUUID()}`;
    const payloadJson = JSON.stringify(slip);
    const idempotencyKey = `idem_${crypto.randomUUID()}`;
    const expiresAt =
      options?.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return this.withTransaction(() => {
      // Cancel any older open actions for this invoice
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'CANCELLED', failure_reason = 'Superseded by newer approval slip', updated_at = ?
           WHERE owner_user_id = ? AND target_invoice_id = ? AND state IN ('DRAFTED', 'PENDING_APPROVAL', 'APPROVED')`
        )
        .run(now, ownerUserId, invoiceId);

      this.db
        .prepare(
          `INSERT INTO pending_actions (
            id, owner_user_id, action_type, target_invoice_id, state,
            payload_json, payload_hash, idempotency_key, expires_at,
            created_at, updated_at
          ) VALUES (?, ?, 'SEND_INVOICE', ?, 'PENDING_APPROVAL', ?, ?, ?, ?, ?, ?)`
        )
        .run(id, ownerUserId, invoiceId, payloadJson, canonicalHash, idempotencyKey, expiresAt, now, now);

      this.db
        .prepare(
          `UPDATE invoices SET local_status = 'PENDING_APPROVAL', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, invoiceId, ownerUserId);

      this.appendActivityLog(ownerUserId, {
        actorType: 'user',
        action: 'ACTION_PROPOSED_FOR_APPROVAL',
        entityType: 'pending_action',
        entityId: id,
        result: 'PROPOSED',
        detail: {
          invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          totalMinor: invoice.totalMinor,
          currencyCode: invoice.currencyCode,
          providerMode
        },
        correlationId: options?.correlationId
      });

      return {
        action: this.getPendingActionForOwner(ownerUserId, id),
        slip
      };
    });
  }

  /**
   * Stage 06: Rejects / discards an action (`PENDING_APPROVAL | APPROVED -> REJECTED`).
   * Resets `invoice.localStatus` back to `'DRAFT'`. A rejected action can never execute.
   */
  public rejectPendingAction(
    ownerUserId: string,
    actionId: string,
    reason = 'Discarded by user during approval review.',
    correlationId?: string
  ): PendingActionRecord {
    const action = this.getPendingActionForOwner(ownerUserId, actionId);
    if (action.state === 'REJECTED' || action.state === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'DUPLICATE_EVENT',
        `Action is already ${action.state}.`
      );
    }
    if (
      action.state !== 'DRAFTED' &&
      action.state !== 'PENDING_APPROVAL' &&
      action.state !== 'APPROVED'
    ) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Cannot discard action in state "${action.state}".`
      );
    }

    const now = new Date().toISOString();
    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'REJECTED', failure_reason = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(reason, now, actionId, ownerUserId);

      this.db
        .prepare(
          `UPDATE invoices
           SET local_status = 'DRAFT', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND local_status != 'SENT'`
        )
        .run(now, action.targetInvoiceId, ownerUserId);

      this.appendActivityLog(ownerUserId, {
        actorType: 'user',
        action: 'ACTION_REJECTED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'REJECTED',
        detail: {
          invoiceId: action.targetInvoiceId,
          reason
        },
        correlationId
      });

      return this.getPendingActionForOwner(ownerUserId, actionId);
    });
  }

  /**
   * Stage 06: Explicitly approves a `PENDING_APPROVAL` action after verifying ownership,
   * expiry freshness, payload hash integrity, and safety cap (`PENDING_APPROVAL -> APPROVED`).
   */
  public approvePendingAction(
    ownerUserId: string,
    actionId: string,
    correlationId?: string
  ): PendingActionRecord {
    const action = this.getPendingActionForOwner(ownerUserId, actionId);

    if (
      action.state === 'APPROVED' ||
      action.state === 'EXECUTING' ||
      action.state === 'EXECUTED'
    ) {
      throw new OwnershipOrValidationError(
        'DUPLICATE_EVENT',
        `Action has already been approved (current state: "${action.state}").`
      );
    }

    if (action.state !== 'PENDING_APPROVAL') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Cannot approve action from state "${action.state}". Only PENDING_APPROVAL actions may be approved.`
      );
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();

    if (Date.parse(action.expiresAt) <= nowMs) {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXPIRED', failure_reason = 'Approval slip expired prior to approval.', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, actionId, ownerUserId);
      this.db
        .prepare(
          `UPDATE invoices SET local_status = 'DRAFT', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND local_status != 'SENT'`
        )
        .run(now, action.targetInvoiceId, ownerUserId);
      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_EXPIRED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'FAILED',
        detail: { invoiceId: action.targetInvoiceId, expiresAt: action.expiresAt },
        correlationId
      });
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Approval slip has expired. Please review a fresh approval slip.'
      );
    }

    const invoice = this.getInvoiceForOwner(ownerUserId, action.targetInvoiceId);
    const { canonicalHash } = this.buildApprovalSlipPayload(
      ownerUserId,
      invoice.id,
      invoice.providerMode
    );

    if (canonicalHash !== action.payloadHash) {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXPIRED', failure_reason = 'Underlying invoice draft changed since approval slip was generated.', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, actionId, ownerUserId);
      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_STALE_REJECTED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'FAILED',
        detail: { invoiceId: invoice.id, reason: 'payload_hash_mismatch' },
        correlationId
      });
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Approval slip is stale because the underlying invoice or client record changed. Please review a fresh slip.'
      );
    }

    this.assertInvoiceValidForApprovalOrExecution(
      ownerUserId,
      invoice,
      actionId,
      correlationId
    );

    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'APPROVED', approved_at = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, now, actionId, ownerUserId);

      this.db
        .prepare(
          `UPDATE invoices
           SET local_status = 'APPROVED', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, invoice.id, ownerUserId);

      this.appendActivityLog(ownerUserId, {
        actorType: 'user',
        action: 'ACTION_APPROVED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'APPROVED',
        detail: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalMinor: invoice.totalMinor,
          currencyCode: invoice.currencyCode
        },
        correlationId
      });

      return this.getPendingActionForOwner(ownerUserId, actionId);
    });
  }

  /**
   * Stage 06: Revalidates ownership, `APPROVED` state, freshness, payload hash, and amount cap
   * immediately before execution, transitioning `APPROVED -> EXECUTING`.
   */
  public beginActionExecution(
    ownerUserId: string,
    actionId: string,
    correlationId?: string
  ): { action: PendingActionRecord; invoice: InvoiceRecord; client: ClientRecord } {
    const action = this.getPendingActionForOwner(ownerUserId, actionId);

    if (action.state === 'EXECUTING' || action.state === 'EXECUTED') {
      throw new OwnershipOrValidationError(
        'DUPLICATE_EVENT',
        `Action is already ${action.state}; duplicate execution blocked.`
      );
    }

    if (action.state !== 'APPROVED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Action cannot be executed from state "${action.state}". Explicit human approval (APPROVED state) is required before execution.`
      );
    }

    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();

    if (Date.parse(action.expiresAt) <= nowMs) {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXPIRED', failure_reason = 'Approved action expired before execution.', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, actionId, ownerUserId);
      this.db
        .prepare(
          `UPDATE invoices SET local_status = 'DRAFT', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND local_status != 'SENT'`
        )
        .run(now, action.targetInvoiceId, ownerUserId);
      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_EXPIRED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'FAILED',
        detail: { invoiceId: action.targetInvoiceId, expiresAt: action.expiresAt },
        correlationId
      });
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Approved action has expired before execution. Please review and approve a fresh slip.'
      );
    }

    const invoice = this.getInvoiceForOwner(ownerUserId, action.targetInvoiceId);
    const client = this.getClientForOwner(ownerUserId, invoice.clientId);
    const { canonicalHash } = this.buildApprovalSlipPayload(
      ownerUserId,
      invoice.id,
      invoice.providerMode
    );

    if (canonicalHash !== action.payloadHash) {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXPIRED', failure_reason = 'Invoice draft changed after approval.', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, actionId, ownerUserId);
      this.db
        .prepare(
          `UPDATE invoices SET local_status = 'DRAFT', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND local_status != 'SENT'`
        )
        .run(now, invoice.id, ownerUserId);
      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_STALE_REJECTED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'FAILED',
        detail: { invoiceId: invoice.id, reason: 'payload_hash_mismatch_after_approval' },
        correlationId
      });
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Approved action is stale because the underlying invoice or client record was modified after approval.'
      );
    }

    this.assertInvoiceValidForApprovalOrExecution(
      ownerUserId,
      invoice,
      actionId,
      correlationId
    );

    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXECUTING', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, actionId, ownerUserId);

      this.appendActivityLog(ownerUserId, {
        actorType: 'system',
        action: 'ACTION_EXECUTING',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'INFO',
        detail: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
        correlationId
      });

      return {
        action: this.getPendingActionForOwner(ownerUserId, actionId),
        invoice,
        client
      };
    });
  }

  public completeActionExecutionSuccess(
    ownerUserId: string,
    actionId: string,
    providerUpdate: {
      providerMode: PayPalMode;
      isMock: boolean;
      providerInvoiceId: string;
      providerStatus: ProviderConfirmedStatus;
      recipientViewUrl?: string;
      invoicerViewUrl?: string;
    },
    correlationId?: string
  ): { action: PendingActionRecord; invoice: InvoiceRecord } {
    const action = this.getPendingActionForOwner(ownerUserId, actionId);
    const now = new Date().toISOString();

    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'EXECUTED', executed_at = ?, failure_reason = NULL, updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(now, now, actionId, ownerUserId);

      const updatedInvoice = this.recordProviderInvoiceSync(
        ownerUserId,
        action.targetInvoiceId,
        {
          providerMode: providerUpdate.providerMode,
          providerInvoiceId: providerUpdate.providerInvoiceId,
          providerStatus: providerUpdate.providerStatus,
          localStatus: 'SENT',
          recipientViewUrl: providerUpdate.recipientViewUrl,
          invoicerViewUrl: providerUpdate.invoicerViewUrl
        }
      );

      this.appendActivityLog(ownerUserId, {
        actorType: 'provider',
        action: 'ACTION_EXECUTED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'EXECUTED',
        detail: {
          invoiceId: updatedInvoice.id,
          invoiceNumber: updatedInvoice.invoiceNumber,
          providerMode: providerUpdate.providerMode,
          isMock: providerUpdate.isMock,
          providerInvoiceId: providerUpdate.providerInvoiceId,
          providerStatus: providerUpdate.providerStatus
        },
        correlationId
      });

      return {
        action: this.getPendingActionForOwner(ownerUserId, actionId),
        invoice: updatedInvoice
      };
    });
  }

  public completeActionExecutionFailure(
    ownerUserId: string,
    actionId: string,
    failureReason: string,
    detail?: Record<string, unknown>,
    correlationId?: string
  ): PendingActionRecord {
    const action = this.getPendingActionForOwner(ownerUserId, actionId);
    const now = new Date().toISOString();

    return this.withTransaction(() => {
      this.db
        .prepare(
          `UPDATE pending_actions
           SET state = 'FAILED', failure_reason = ?, updated_at = ?
           WHERE id = ? AND owner_user_id = ?`
        )
        .run(failureReason, now, actionId, ownerUserId);

      this.db
        .prepare(
          `UPDATE invoices
           SET local_status = 'FAILED', updated_at = ?
           WHERE id = ? AND owner_user_id = ? AND local_status != 'SENT'`
        )
        .run(now, action.targetInvoiceId, ownerUserId);

      this.appendActivityLog(ownerUserId, {
        actorType: 'provider',
        action: 'ACTION_EXECUTION_FAILED',
        entityType: 'pending_action',
        entityId: actionId,
        result: 'FAILED',
        detail: {
          invoiceId: action.targetInvoiceId,
          failureReason,
          ...(detail ?? {})
        },
        correlationId
      });

      return this.getPendingActionForOwner(ownerUserId, actionId);
    });
  }

  public appendActivityLog(
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
  ): ActivityRecord {
    const now = new Date().toISOString();
    const id = input.id ?? `actlog_${crypto.randomUUID()}`;
    const detailJson = JSON.stringify(input.detail ?? {});

    this.db
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

  public listActivityForOwner(ownerUserId: string): ActivityRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, owner_user_id, actor_type, action, entity_type, entity_id, result, detail_json, correlation_id, created_at
         FROM activity_log
         WHERE owner_user_id = ?
         ORDER BY created_at DESC`
      )
      .all(ownerUserId) as Array<{
      id: string;
      owner_user_id: string;
      actor_type: 'user' | 'agent' | 'provider' | 'system';
      action: string;
      entity_type: string;
      entity_id: string;
      result: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'INFO';
      detail_json: string;
      correlation_id: string | null;
      created_at: string;
    }>;

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

  /**
   * Deduplicated webhook event recording (idempotent on `provider_event_id`).
   */
  public recordWebhookEvent(input: {
    providerEventId: string;
    eventType: string;
    verificationStatus: 'VERIFIED' | 'REJECTED';
    processingStatus: 'PROCESSED' | 'IGNORED' | 'FAILED';
    relatedProviderInvoiceId?: string;
    payload: unknown;
  }): { deduplicated: boolean; record: WebhookEventRecord } {
    const existing = this.db
      .prepare(
        `SELECT id, provider_event_id, event_type, verification_status, processing_status,
                related_provider_invoice_id, payload_hash, received_at, processed_at
         FROM webhook_events WHERE provider_event_id = ?`
      )
      .get(input.providerEventId) as
      | {
          id: string;
          provider_event_id: string;
          event_type: string;
          verification_status: 'VERIFIED' | 'REJECTED';
          processing_status: 'PROCESSED' | 'IGNORED' | 'FAILED';
          related_provider_invoice_id: string | null;
          payload_hash: string;
          received_at: string;
          processed_at: string | null;
        }
      | undefined;

    if (existing) {
      return {
        deduplicated: true,
        record: {
          id: existing.id,
          providerEventId: existing.provider_event_id,
          eventType: existing.event_type,
          verificationStatus: existing.verification_status,
          processingStatus: existing.processing_status,
          relatedProviderInvoiceId: existing.related_provider_invoice_id ?? undefined,
          payloadHash: existing.payload_hash,
          receivedAt: existing.received_at,
          processedAt: existing.processed_at ?? undefined
        }
      };
    }

    const now = new Date().toISOString();
    const id = `wh_${crypto.randomUUID()}`;
    const payloadHash = computeCanonicalHash(input.payload);

    this.db
      .prepare(
        `INSERT INTO webhook_events (
          id, provider_event_id, event_type, verification_status, processing_status,
          related_provider_invoice_id, payload_hash, received_at, processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.providerEventId,
        input.eventType,
        input.verificationStatus,
        input.processingStatus,
        input.relatedProviderInvoiceId ?? null,
        payloadHash,
        now,
        now
      );

    return {
      deduplicated: false,
      record: {
        id,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        verificationStatus: input.verificationStatus,
        processingStatus: input.processingStatus,
        relatedProviderInvoiceId: input.relatedProviderInvoiceId,
        payloadHash,
        receivedAt: now,
        processedAt: now
      }
    };
  }

  public createNotification(
    ownerUserId: string,
    input: { title: string; body: string }
  ): NotificationRecord {
    const id = `notif_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    this.db
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

  public listNotificationsForOwner(ownerUserId: string): NotificationRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, owner_user_id, title, body, is_read, created_at
         FROM notifications
         WHERE owner_user_id = ?
         ORDER BY created_at DESC`
      )
      .all(ownerUserId) as Array<{
      id: string;
      owner_user_id: string;
      title: string;
      body: string;
      is_read: number;
      created_at: string;
    }>;

    return rows.map((r) => ({
      id: r.id,
      ownerUserId: r.owner_user_id,
      title: r.title,
      body: r.body,
      isRead: r.is_read === 1,
      createdAt: r.created_at
    }));
  }

  public markNotificationAsRead(ownerUserId: string, notificationId: string): void {
    this.db
      .prepare(
        `UPDATE notifications SET is_read = 1 WHERE id = ? AND owner_user_id = ?`
      )
      .run(notificationId, ownerUserId);
  }

  public markAllNotificationsAsRead(ownerUserId: string): void {
    this.db
      .prepare(
        `UPDATE notifications SET is_read = 1 WHERE owner_user_id = ?`
      )
      .run(ownerUserId);
  }

  // ============================================================================
  // Stage 11: Reminders Management
  // ============================================================================
  public createReminder(
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
  ): ReminderRecord {
    const id = input.id ?? `rem_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const now = new Date().toISOString();
    const tone = input.tone ?? 'polite';
    const state = input.approvalState ?? 'DRAFTED';

    this.db
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

    return {
      id,
      ownerUserId,
      invoiceId: input.invoiceId,
      tone,
      subject: input.subject.trim(),
      body: input.body.trim(),
      approvalState: state,
      scheduledFor: input.scheduledFor ?? undefined,
      createdAt: now,
      updatedAt: now
    };
  }

  public getReminderById(ownerUserId: string, reminderId: string): ReminderRecord | null {
    const row = this.db
      .prepare(
        `SELECT id, owner_user_id, invoice_id, tone, subject, body, approval_state, scheduled_for, sent_at, delivery_evidence, created_at, updated_at
         FROM reminders
         WHERE id = ? AND owner_user_id = ?`
      )
      .get(reminderId, ownerUserId) as {
      id: string;
      owner_user_id: string;
      invoice_id: string;
      tone: ReminderTone;
      subject: string;
      body: string;
      approval_state: ReminderApprovalState;
      scheduled_for: string | null;
      sent_at: string | null;
      delivery_evidence: string | null;
      created_at: string;
      updated_at: string;
    } | undefined;

    if (!row) return null;

    return {
      id: row.id,
      ownerUserId: row.owner_user_id,
      invoiceId: row.invoice_id,
      tone: row.tone,
      subject: row.subject,
      body: row.body,
      approvalState: row.approval_state,
      scheduledFor: row.scheduled_for ?? undefined,
      sentAt: row.sent_at ?? undefined,
      deliveryEvidence: row.delivery_evidence ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public listRemindersForOwner(
    ownerUserId: string,
    filter?: { status?: ReminderApprovalState; invoiceId?: string }
  ): ReminderRecord[] {
    let sql = `SELECT id, owner_user_id, invoice_id, tone, subject, body, approval_state, scheduled_for, sent_at, delivery_evidence, created_at, updated_at
               FROM reminders
               WHERE owner_user_id = ?`;
    const params: (string | number | null)[] = [ownerUserId];

    if (filter?.status) {
      sql += ` AND approval_state = ?`;
      params.push(filter.status);
    }
    if (filter?.invoiceId) {
      sql += ` AND invoice_id = ?`;
      params.push(filter.invoiceId);
    }

    sql += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string;
      owner_user_id: string;
      invoice_id: string;
      tone: ReminderTone;
      subject: string;
      body: string;
      approval_state: ReminderApprovalState;
      scheduled_for: string | null;
      sent_at: string | null;
      delivery_evidence: string | null;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.owner_user_id,
      invoiceId: row.invoice_id,
      tone: row.tone,
      subject: row.subject,
      body: row.body,
      approvalState: row.approval_state,
      scheduledFor: row.scheduled_for ?? undefined,
      sentAt: row.sent_at ?? undefined,
      deliveryEvidence: row.delivery_evidence ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public updateReminder(
    ownerUserId: string,
    reminderId: string,
    patch: {
      tone?: ReminderTone;
      subject?: string;
      body?: string;
      scheduledFor?: string | null;
      approvalState?: ReminderApprovalState;
      sentAt?: string | null;
      deliveryEvidence?: string | null;
    }
  ): ReminderRecord {
    const existing = this.getReminderById(ownerUserId, reminderId);
    if (!existing) {
      throw new Error(`Reminder ${reminderId} not found for owner.`);
    }

    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number | null)[] = [now];

    if (patch.tone !== undefined) {
      sets.push('tone = ?');
      params.push(patch.tone);
    }
    if (patch.subject !== undefined) {
      sets.push('subject = ?');
      params.push(patch.subject.trim());
    }
    if (patch.body !== undefined) {
      sets.push('body = ?');
      params.push(patch.body.trim());
    }
    if (patch.scheduledFor !== undefined) {
      sets.push('scheduled_for = ?');
      params.push(patch.scheduledFor);
    }
    if (patch.approvalState !== undefined) {
      sets.push('approval_state = ?');
      params.push(patch.approvalState);
    }
    if (patch.sentAt !== undefined) {
      sets.push('sent_at = ?');
      params.push(patch.sentAt);
    }
    if (patch.deliveryEvidence !== undefined) {
      sets.push('delivery_evidence = ?');
      params.push(patch.deliveryEvidence);
    }

    params.push(reminderId, ownerUserId);

    this.db
      .prepare(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ? AND owner_user_id = ?`)
      .run(...params);

    return this.getReminderById(ownerUserId, reminderId)!;
  }

  public deleteReminder(ownerUserId: string, reminderId: string): boolean {
    const info = this.db
      .prepare(`DELETE FROM reminders WHERE id = ? AND owner_user_id = ?`)
      .run(reminderId, ownerUserId);
    return info.changes > 0;
  }

  public async processDueScheduledReminders(
    currentTimeIso: string = new Date().toISOString(),
    sendFn?: (reminder: ReminderRecord) => Promise<string>
  ): Promise<Array<{ id: string; success: boolean; evidence?: string; error?: string }>> {
    const rows = this.db
      .prepare(
        `SELECT id, owner_user_id, invoice_id, tone, subject, body, approval_state, scheduled_for, sent_at, delivery_evidence, created_at, updated_at
         FROM reminders
         WHERE approval_state = 'SCHEDULED' AND scheduled_for IS NOT NULL AND scheduled_for <= ?`
      )
      .all(currentTimeIso) as Array<{
      id: string;
      owner_user_id: string;
      invoice_id: string;
      tone: ReminderTone;
      subject: string;
      body: string;
      approval_state: ReminderApprovalState;
      scheduled_for: string | null;
      sent_at: string | null;
      delivery_evidence: string | null;
      created_at: string;
      updated_at: string;
    }>;

    const results: Array<{ id: string; success: boolean; evidence?: string; error?: string }> = [];

    for (const row of rows) {
      const reminder: ReminderRecord = {
        id: row.id,
        ownerUserId: row.owner_user_id,
        invoiceId: row.invoice_id,
        tone: row.tone,
        subject: row.subject,
        body: row.body,
        approvalState: row.approval_state,
        scheduledFor: row.scheduled_for ?? undefined,
        sentAt: row.sent_at ?? undefined,
        deliveryEvidence: row.delivery_evidence ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

      try {
        let evidence = `SCHEDULED_DELIVERY_CONFIRMED:${reminder.id}:${currentTimeIso}`;
        if (sendFn) {
          evidence = await sendFn(reminder);
        }

        const now = new Date().toISOString();
        this.updateReminder(reminder.ownerUserId, reminder.id, {
          approvalState: 'SENT',
          sentAt: now,
          deliveryEvidence: evidence
        });

        this.appendActivityLog(reminder.ownerUserId, {
          actorType: 'system',
          action: 'REMINDER_SENT_SCHEDULED',
          entityType: 'reminder',
          entityId: reminder.id,
          result: 'EXECUTED',
          detail: {
            reminderId: reminder.id,
            invoiceId: reminder.invoiceId,
            tone: reminder.tone,
            scheduledFor: reminder.scheduledFor,
            evidence
          }
        });

        this.createNotification(reminder.ownerUserId, {
          title: 'Scheduled reminder executed',
          body: `Scheduled reminder (${reminder.tone}) was delivered for invoice ${reminder.invoiceId}.`
        });

        results.push({ id: reminder.id, success: true, evidence });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.updateReminder(reminder.ownerUserId, reminder.id, {
          approvalState: 'FAILED',
          deliveryEvidence: `FAILED: ${errorMsg}`
        });

        this.appendActivityLog(reminder.ownerUserId, {
          actorType: 'system',
          action: 'REMINDER_SCHEDULED_FAILED',
          entityType: 'reminder',
          entityId: reminder.id,
          result: 'FAILED',
          detail: {
            reminderId: reminder.id,
            invoiceId: reminder.invoiceId,
            error: errorMsg
          }
        });

        results.push({ id: reminder.id, success: false, error: errorMsg });
      }
    }

    return results;
  }

  public requestReminderSendApproval(
    ownerUserId: string,
    reminderId: string
  ): ReminderRecord {
    const reminder = this.getReminderById(ownerUserId, reminderId);
    if (!reminder) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
    }
    if (reminder.approvalState === 'SENT') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Reminder has already been sent and cannot be queued for approval again.'
      );
    }
    if (reminder.approvalState === 'REJECTED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot request approval for a rejected reminder.'
      );
    }

    const invoice = this.getInvoiceForOwner(ownerUserId, reminder.invoiceId);
    if (invoice.providerStatus === 'PAID' || invoice.providerStatus === 'MARKED_AS_PAID') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot request reminder approval for an already paid invoice.'
      );
    }
    if (invoice.localStatus === 'CANCELLED' || invoice.providerStatus === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot request reminder approval for a cancelled invoice.'
      );
    }

    const updated = this.updateReminder(ownerUserId, reminderId, {
      approvalState: 'PENDING_APPROVAL'
    });

    this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: 'REMINDER_APPROVAL_REQUESTED',
      entityType: 'reminder',
      entityId: reminder.id,
      result: 'PROPOSED',
      detail: {
        reminderId: reminder.id,
        invoiceId: invoice.id,
        tone: reminder.tone
      }
    });

    return updated;
  }

  public approveReminder(
    ownerUserId: string,
    reminderId: string
  ): ReminderRecord {
    const reminder = this.getReminderById(ownerUserId, reminderId);
    if (!reminder) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
    }
    if (reminder.approvalState === 'SENT') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Reminder has already been sent.'
      );
    }
    if (reminder.approvalState === 'REJECTED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot approve a discarded or rejected reminder.'
      );
    }

    const invoice = this.getInvoiceForOwner(ownerUserId, reminder.invoiceId);
    if (invoice.providerStatus === 'PAID' || invoice.providerStatus === 'MARKED_AS_PAID') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot approve reminder for an already paid invoice.'
      );
    }
    if (invoice.localStatus === 'CANCELLED' || invoice.providerStatus === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot approve reminder for a cancelled invoice.'
      );
    }

    const nextState: ReminderApprovalState =
      reminder.scheduledFor && reminder.scheduledFor > new Date().toISOString()
        ? 'SCHEDULED'
        : 'APPROVED';

    const updated = this.updateReminder(ownerUserId, reminderId, {
      approvalState: nextState
    });

    this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: 'REMINDER_APPROVED',
      entityType: 'reminder',
      entityId: reminder.id,
      result: 'EXECUTED',
      detail: {
        reminderId: reminder.id,
        invoiceId: invoice.id,
        nextState,
        scheduledFor: reminder.scheduledFor
      }
    });

    return updated;
  }

  public rejectReminder(
    ownerUserId: string,
    reminderId: string,
    reason?: string
  ): ReminderRecord {
    const reminder = this.getReminderById(ownerUserId, reminderId);
    if (!reminder) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
    }
    if (reminder.approvalState === 'SENT') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot reject a reminder that has already been sent.'
      );
    }

    const updated = this.updateReminder(ownerUserId, reminderId, {
      approvalState: 'REJECTED'
    });

    this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: 'REMINDER_REJECTED',
      entityType: 'reminder',
      entityId: reminder.id,
      result: 'EXECUTED',
      detail: {
        reminderId: reminder.id,
        invoiceId: reminder.invoiceId,
        reason: reason ?? 'Discarded by user.'
      }
    });

    return updated;
  }

  public async sendReminder(
    ownerUserId: string,
    reminderId: string,
    sendFn?: (reminder: ReminderRecord) => Promise<string>
  ): Promise<{ reminder: ReminderRecord; evidence: string }> {
    const reminder = this.getReminderById(ownerUserId, reminderId);
    if (!reminder) {
      throw new OwnershipOrValidationError('NOT_FOUND', `Reminder ${reminderId} not found.`);
    }
    if (reminder.approvalState === 'SENT') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Reminder has already been sent and cannot be sent again.'
      );
    }
    if (reminder.approvalState === 'REJECTED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot send a rejected reminder.'
      );
    }

    const invoice = this.getInvoiceForOwner(ownerUserId, reminder.invoiceId);
    if (invoice.providerStatus === 'PAID' || invoice.providerStatus === 'MARKED_AS_PAID') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot send reminder for an already paid invoice.'
      );
    }
    if (invoice.localStatus === 'CANCELLED' || invoice.providerStatus === 'CANCELLED') {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Cannot send reminder for a cancelled invoice.'
      );
    }

    let evidence = `MANUAL_DELIVERY_CONFIRMED:${reminder.id}:${new Date().toISOString()}`;
    if (sendFn) {
      evidence = await sendFn(reminder);
    }

    const now = new Date().toISOString();
    const updated = this.updateReminder(ownerUserId, reminderId, {
      approvalState: 'SENT',
      sentAt: now,
      deliveryEvidence: evidence
    });

    this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: 'REMINDER_SENT',
      entityType: 'reminder',
      entityId: reminder.id,
      result: 'EXECUTED',
      detail: {
        reminderId: reminder.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        tone: reminder.tone,
        evidence
      }
    });

    this.createNotification(ownerUserId, {
      title: 'Reminder sent',
      body: `Reminder (${reminder.tone}) sent for invoice ${invoice.invoiceNumber}.`
    });

    return { reminder: updated, evidence };
  }

  public recordPartialPayment(
    ownerUserId: string,
    invoiceId: string,
    amountMinor: number
  ): InvoiceRecord {
    const existing = this.getInvoiceForOwner(ownerUserId, invoiceId);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Partial payment amount must be a positive integer in minor units.'
      );
    }
    const currentPaid = existing.paidAmountMinor ?? 0;
    const nextPaid = currentPaid + amountMinor;
    if (nextPaid > existing.totalMinor) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Cumulative payment (${nextPaid}) cannot exceed invoice total (${existing.totalMinor}).`
      );
    }

    const isFullyPaid = nextPaid === existing.totalMinor;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE invoices
         SET paid_amount_minor = ?,
             provider_status = CASE WHEN ? = 1 THEN 'PAID' ELSE provider_status END,
             updated_at = ?
         WHERE id = ? AND owner_user_id = ?`
      )
      .run(nextPaid, isFullyPaid ? 1 : 0, now, invoiceId, ownerUserId);

    this.appendActivityLog(ownerUserId, {
      actorType: 'user',
      action: isFullyPaid ? 'INVOICE_SETTLED_IN_FULL' : 'INVOICE_PARTIAL_PAYMENT_RECORDED',
      entityType: 'invoice',
      entityId: existing.id,
      result: 'EXECUTED',
      detail: {
        invoiceNumber: existing.invoiceNumber,
        amountMinor,
        cumulativePaidMinor: nextPaid,
        totalMinor: existing.totalMinor,
        currencyCode: existing.currencyCode
      }
    });

    if (isFullyPaid) {
      this.createNotification(ownerUserId, {
        title: 'Invoice paid in full',
        body: `Invoice ${existing.invoiceNumber} has been fully settled (${formatMinorUnitsToDecimal(existing.totalMinor, existing.currencyCode)} ${existing.currencyCode}).`
      });
    } else {
      this.createNotification(ownerUserId, {
        title: 'Payment recorded',
        body: `Payment of ${formatMinorUnitsToDecimal(amountMinor, existing.currencyCode)} ${existing.currencyCode} recorded for ${existing.invoiceNumber}. Remaining balance: ${formatMinorUnitsToDecimal(existing.totalMinor - nextPaid, existing.currencyCode)} ${existing.currencyCode}.`
      });
    }

    return this.getInvoiceForOwner(ownerUserId, invoiceId);
  }

  public getGroundedInsights(
    ownerUserId: string,
    asOfDate?: string
  ): GroundedFinancialInsights {
    const invoices = this.listInvoicesForOwner(ownerUserId);
    const clients = this.listClientsForOwner(ownerUserId);
    const reminders = this.listRemindersForOwner(ownerUserId);
    return buildGroundedFinancialInsights(invoices, clients, reminders, asOfDate);
  }

  /**
   * Deterministic demo seed & reset.
   * Deletes ONLY records owned by `is_demo = 1` users and recreates the synthetic demo tenant dataset.
   * Real authenticated user records (`is_demo = 0`) are strictly untouched.
   */
  public resetAndSeedDemoTenant(): {
    demoUser: UserRecord;
    clients: ClientRecord[];
    invoices: InvoiceRecord[];
  } {
    return this.withTransaction(() => {
      // Delete only demo users (ON DELETE CASCADE removes their settings, clients, invoices, actions, activity, etc.)
      this.db.prepare('DELETE FROM users WHERE is_demo = 1').run();

      const demoUser = this.createUser({
        id: DEMO_TENANT_USER_ID,
        email: DEMO_TENANT_EMAIL,
        displayName: 'Aarav Mehta Studio (Demo Workspace)',
        authProvider: 'demo-session',
        isDemo: true
      });

      this.updateSettings(demoUser.id, {
        businessName: 'Aarav Mehta Design & Engineering',
        businessEmail: DEMO_TENANT_EMAIL,
        defaultCurrency: 'USD',
        maxInvoiceAmountMinor: 2500000, // $25,000.00 safety limit
        defaultPaymentTermsDays: 14
      });

      const clientNorthstar = this.createClient(demoUser.id, {
        id: 'cli_demo_northstar_01',
        fullName: 'Elena Vance',
        companyName: 'Northstar Civic Labs',
        email: 'elena.vance@northstar-demo.example.com',
        defaultCurrency: 'USD',
        notes: 'Prefers itemized milestone breakdowns.'
      });

      const clientKestrel = this.createClient(demoUser.id, {
        id: 'cli_demo_kestrel_02',
        fullName: 'Rohan Kulkarni',
        companyName: 'Kestrel Logistics Co.',
        email: 'rohan.k@kestrel-demo.example.com',
        defaultCurrency: 'USD',
        notes: 'Net-14 terms.'
      });

      const invoiceDraft = this.createInvoiceDraft(demoUser.id, {
        id: 'inv_demo_draft_01',
        clientId: clientNorthstar.id,
        invoiceNumber: 'INV-DEMO-1001',
        currencyCode: 'USD',
        taxRateBps: 500, // 5%
        issueDate: '2026-10-25',
        dueDate: '2026-11-08',
        notes: 'Q4 Accessibility & Ledger Design System Audit',
        providerMode: 'sandbox',
        items: [
          {
            description: 'Design system architecture & token specification',
            quantity: 1,
            unitAmountMinor: 120000, // $1,200.00
            currencyCode: 'USD'
          },
          {
            description: 'Interactive approval slip prototype',
            quantity: 2,
            unitAmountMinor: 40000, // $400.00 each = $800.00
            currencyCode: 'USD'
          }
        ]
      });

      this.updateOnboardingProgress(demoUser.id, {
        currentStep: 4,
        completed: true,
        skipped: false,
        businessName: 'Aarav Mehta Design & Engineering',
        businessEmail: DEMO_TENANT_EMAIL,
        defaultCurrency: 'USD',
        maxInvoiceAmountMinor: 2500000,
        defaultReminderTone: 'polite',
        sandboxTested: true,
        firstClientId: clientNorthstar.id
      });

      this.appendActivityLog(demoUser.id, {
        id: 'actlog_demo_seed_01',
        actorType: 'system',
        action: 'DEMO_TENANT_SEEDED',
        entityType: 'user',
        entityId: demoUser.id,
        result: 'INFO',
        detail: {
          seededClients: 2,
          seededInvoices: 1
        }
      });

      this.createNotification(demoUser.id, {
        title: 'Welcome to InvoicePilot',
        body: 'Your workspace is initialized in PayPal Sandbox mode with synthetic demo records.'
      });

      this.createNotification(demoUser.id, {
        title: 'Invoice draft ready for review',
        body: 'INV-DEMO-1001 for Northstar Civic Labs ($2,100.00) is ready to inspect.'
      });

      this.createReminder(demoUser.id, {
        id: 'rem_demo_seed_01',
        invoiceId: invoiceDraft.id,
        tone: 'polite',
        subject: 'Friendly reminder: Invoice INV-DEMO-1001 is due on 2026-11-08',
        body: 'Hi Elena,\n\nThis is a friendly reminder that invoice INV-DEMO-1001 for $2,100.00 USD is due on 2026-11-08.\n\nPlease let us know if you need anything. Thank you for your business!\n\nBest regards,\nAarav Mehta Design & Engineering',
        approvalState: 'DRAFTED'
      });

      return {
        demoUser,
        clients: [clientNorthstar, clientKestrel],
        invoices: [invoiceDraft]
      };
    });
  }

  public deleteUserAccount(userId: string): { deleted: boolean; isDemo: boolean } {
    const user = this.getUserById(userId);
    if (!user) {
      throw new OwnershipOrValidationError('NOT_FOUND', `User "${userId}" was not found.`);
    }

    if (user.isDemo) {
      this.resetAndSeedDemoTenant();
      return { deleted: true, isDemo: true };
    }

    this.withTransaction(() => {
      // Cascading deletion for real authenticated user
      this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM activity_log WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM notifications WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM reminders WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM pending_actions WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM invoice_items WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM invoices WHERE owner_user_id = ?').run(userId);
      try {
        this.db.prepare('DELETE FROM invoice_templates WHERE owner_user_id = ?').run(userId);
      } catch {
        // Table may not exist in early migrations
      }
      try {
        this.db.prepare('DELETE FROM onboarding_progress WHERE user_id = ?').run(userId);
      } catch {
        // ignore
      }
      try {
        this.db.prepare('DELETE FROM chat_threads WHERE user_id = ?').run(userId);
      } catch {
        // ignore
      }
      this.db.prepare('DELETE FROM clients WHERE owner_user_id = ?').run(userId);
      this.db.prepare('DELETE FROM settings WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM paypal_connections WHERE user_id = ?').run(userId);
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    });

    return { deleted: true, isDemo: false };
  }

  public listWebhookEvents(limit = 50): WebhookEventDetailRecord[] {
    const rows = this.db
      .prepare(
        `SELECT id, provider_event_id, event_type, verification_status,
                processing_status, related_provider_invoice_id, payload_hash,
                received_at, processed_at
         FROM webhook_events
         ORDER BY received_at DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
        id: string;
        provider_event_id: string;
        event_type: string;
        verification_status: 'VERIFIED' | 'REJECTED';
        processing_status: 'PROCESSED' | 'IGNORED' | 'FAILED';
        related_provider_invoice_id: string | null;
        payload_hash: string;
        received_at: string;
        processed_at: string | null;
      }>;

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

  public listTemplatesForOwner(ownerUserId: string): InvoiceTemplateRecord[] {
    let rows: Array<{
      id: string;
      owner_user_id: string;
      title: string;
      description: string;
      unit_amount_minor: number;
      currency_code: string;
      created_at: string;
      updated_at: string;
    }> = [];

    try {
      rows = this.db
        .prepare(
          `SELECT id, owner_user_id, title, description, unit_amount_minor, currency_code, created_at, updated_at
           FROM invoice_templates
           WHERE owner_user_id = ?
           ORDER BY created_at ASC`
        )
        .all(ownerUserId) as any[];
    } catch {
      return [];
    }

    if (rows.length === 0) {
      const now = new Date().toISOString();
      const defaults = [
        {
          id: `tmpl_${crypto.randomUUID()}`,
          title: 'Architecture Review & System Consulting',
          description: 'Senior technical architecture review, system design documentation, and threat modeling.',
          unitAmountMinor: 150000,
          currencyCode: 'USD'
        },
        {
          id: `tmpl_${crypto.randomUUID()}`,
          title: 'Monthly Engineering Retainer',
          description: 'Dedicated monthly retainer covering up to 20 hours of production support, maintenance, and bug fixes.',
          unitAmountMinor: 250000,
          currencyCode: 'USD'
        },
        {
          id: `tmpl_${crypto.randomUUID()}`,
          title: 'Code Quality & Security Audit',
          description: 'Comprehensive codebase inspection, security vulnerability analysis, and automated QA test suite implementation.',
          unitAmountMinor: 80000,
          currencyCode: 'USD'
        }
      ];

      for (const d of defaults) {
        try {
          this.db
            .prepare(
              `INSERT INTO invoice_templates (id, owner_user_id, title, description, unit_amount_minor, currency_code, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(d.id, ownerUserId, d.title, d.description, d.unitAmountMinor, d.currencyCode, now, now);
        } catch {
          // Ignore insertion error if table not ready
        }
      }

      return defaults.map((d) => ({
        ...d,
        ownerUserId,
        createdAt: now,
        updatedAt: now
      }));
    }

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

  public createTemplate(ownerUserId: string, input: CreateTemplateInput): InvoiceTemplateRecord {
    const title = (input.title ?? '').trim();
    const description = (input.description ?? '').trim();
    if (!title) {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Template title is required.');
    }
    if (!description) {
      throw new OwnershipOrValidationError('VALIDATION_ERROR', 'Template description is required.');
    }
    if (!Number.isSafeInteger(input.unitAmountMinor) || input.unitAmountMinor < 0) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Unit amount must be a non-negative integer in minor units.'
      );
    }
    const currency = validateSupportedCurrency(input.currencyCode ?? 'USD');
    const id = `tmpl_${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO invoice_templates (id, owner_user_id, title, description, unit_amount_minor, currency_code, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, ownerUserId, title, description, input.unitAmountMinor, currency, now, now);

    return {
      id,
      ownerUserId,
      title,
      description,
      unitAmountMinor: input.unitAmountMinor,
      currencyCode: currency,
      createdAt: now,
      updatedAt: now
    };
  }

  public deleteTemplate(ownerUserId: string, templateId: string): void {
    const res = this.db
      .prepare('DELETE FROM invoice_templates WHERE id = ? AND owner_user_id = ?')
      .run(templateId, ownerUserId);
    if (res.changes === 0) {
      throw new OwnershipOrValidationError(
        'NOT_FOUND',
        `Template "${templateId}" not found or unauthorized.`
      );
    }
  }
}
