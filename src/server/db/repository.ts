import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getCurrencyExponent } from './schema.js';
import type { PayPalMode } from '../config.js';
import type { ProviderConfirmedStatus } from '../paypal/adapter.js';

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

export interface CreateInvoiceLineItemInput {
  description: string;
  quantity: number;
  unitAmountMinor: number;
  currencyCode: string;
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

export class OwnershipOrValidationError extends Error {
  public readonly code: 'NOT_FOUND' | 'FORBIDDEN_OWNER_MISMATCH' | 'VALIDATION_ERROR' | 'DUPLICATE_EVENT';

  public constructor(
    code: 'NOT_FOUND' | 'FORBIDDEN_OWNER_MISMATCH' | 'VALIDATION_ERROR' | 'DUPLICATE_EVENT',
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

export class InvoicePilotRepository {
  private transactionDepth = 0;

  public constructor(private readonly db: DatabaseSync) {}

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

    const nextCurrency = (patch.defaultCurrency ?? existing.defaultCurrency).trim().toUpperCase();
    getCurrencyExponent(nextCurrency);

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
    const currency = (input.defaultCurrency ?? 'USD').trim().toUpperCase();
    getCurrencyExponent(currency);

    const fullName = input.fullName.trim();
    const email = input.email.trim().toLowerCase();
    if (!fullName || !email.includes('@')) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and a valid email address are required.'
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
    const defaultCurrency = (patch.defaultCurrency ?? existing.defaultCurrency).trim().toUpperCase();
    getCurrencyExponent(defaultCurrency);

    if (!fullName || !email.includes('@')) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        'Client full name and valid email are required.'
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
    this.db
      .prepare('DELETE FROM clients WHERE id = ? AND owner_user_id = ?')
      .run(clientId, ownerUserId);
  }

  /**
   * Creates a local invoice draft with server-validated line items, tax, totals, and ownership.
   */
  public createInvoiceDraft(
    ownerUserId: string,
    input: CreateInvoiceInput & { id?: string }
  ): InvoiceRecord {
    // 1. Verify client exists and belongs to the same owner
    this.getClientForOwner(ownerUserId, input.clientId);

    const currencyCode = input.currencyCode.trim().toUpperCase();
    getCurrencyExponent(currencyCode);

    if (!input.items || input.items.length === 0) {
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
      const itemCurrency = item.currencyCode.trim().toUpperCase();
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
      if (!Number.isSafeInteger(item.unitAmountMinor) || item.unitAmountMinor < 0) {
        throw new OwnershipOrValidationError(
          'VALIDATION_ERROR',
          `Line item ${idx + 1} unitAmountMinor must be a non-negative integer.`
        );
      }

      const lineTotalMinor = item.quantity * item.unitAmountMinor;
      subtotalMinor += lineTotalMinor;
      preparedItems.push({
        id: `itm_${crypto.randomUUID()}`,
        position: idx,
        description: item.description.trim(),
        quantity: item.quantity,
        unitAmountMinor: item.unitAmountMinor,
        lineTotalMinor,
        currencyCode
      });
    }

    const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
    const totalMinor = subtotalMinor + taxMinor;

    // Enforce owner's safety amount limit if settings exist
    const settings = this.getSettings(ownerUserId);
    if (settings && totalMinor > settings.maxInvoiceAmountMinor) {
      throw new OwnershipOrValidationError(
        'VALIDATION_ERROR',
        `Invoice total (${totalMinor} minor units) exceeds the configured safety limit (${settings.maxInvoiceAmountMinor} minor units).`
      );
    }

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
          input.invoiceNumber.trim(),
          currencyCode,
          subtotalMinor,
          taxRateBps,
          taxMinor,
          totalMinor,
          input.issueDate.trim(),
          input.dueDate.trim(),
          input.notes?.trim() ?? null,
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
      for (const item of preparedItems) {
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
        invoiceNumber: input.invoiceNumber.trim(),
        currencyCode,
        subtotalMinor,
        taxRateBps,
        taxMinor,
        totalMinor,
        issueDate: input.issueDate.trim(),
        dueDate: input.dueDate.trim(),
        notes: input.notes?.trim(),
        localStatus: 'DRAFT',
        providerMode,
        providerStatus: 'NONE',
        items: itemRecords,
        createdAt: now,
        updatedAt: now
      };
    });
  }

  public getInvoiceForOwner(ownerUserId: string, invoiceId: string): InvoiceRecord {
    const row = this.db
      .prepare(
        `SELECT
          id, owner_user_id, client_id, invoice_number, currency_code,
          subtotal_minor, tax_rate_bps, tax_minor, total_minor,
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

      return {
        demoUser,
        clients: [clientNorthstar, clientKestrel],
        invoices: [invoiceDraft]
      };
    });
  }
}
