import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  formatMinorUnitsToDecimal,
  openAndMigrateDatabase,
  parseDecimalToMinorUnits
} from '../../src/server/db/schema.js';
import {
  DEMO_TENANT_USER_ID,
  InvoicePilotRepository,
  OwnershipOrValidationError
} from '../../src/server/db/repository.js';
import type { DatabaseSync } from 'node:sqlite';

describe('Stage 04 — SQLite Persistence, Money Integrity, Ownership & Demo Isolation', () => {
  let tempDir = '';
  let dbFile = '';
  let db: DatabaseSync | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage04-'));
    dbFile = path.join(tempDir, 'test.sqlite');
    db = openAndMigrateDatabase(dbFile);
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('persists data on disk across database connections (not in-memory storage)', () => {
    expect(fs.existsSync(dbFile)).toBe(true);
    const repo1 = new InvoicePilotRepository(db!);
    const alice = repo1.createUser({
      id: 'usr_alice_01',
      email: 'alice@studio.example.com',
      displayName: 'Alice Studio'
    });
    const client = repo1.createClient(alice.id, {
      fullName: 'Bob Client',
      email: 'bob@client.example.com',
      defaultCurrency: 'USD'
    });

    // Close first connection and reopen from disk
    db!.close();
    db = openAndMigrateDatabase(dbFile);
    const repo2 = new InvoicePilotRepository(db);

    const loadedClient = repo2.getClientForOwner(alice.id, client.id);
    expect(loadedClient.fullName).toBe('Bob Client');
    expect(loadedClient.email).toBe('bob@client.example.com');
  });

  it('enforces exact integer minor-unit money conversions and currency exponents', () => {
    expect(parseDecimalToMinorUnits('25.00', 'USD')).toBe(2500);
    expect(parseDecimalToMinorUnits('199.95', 'INR')).toBe(19995);
    expect(parseDecimalToMinorUnits('500', 'JPY')).toBe(500);

    expect(formatMinorUnitsToDecimal(2500, 'USD')).toBe('25.00');
    expect(formatMinorUnitsToDecimal(500, 'JPY')).toBe('500');

    expect(() => parseDecimalToMinorUnits('10.999', 'USD')).toThrow(/exceeds 2 decimal places/);
    expect(() => parseDecimalToMinorUnits('10.5', 'JPY')).toThrow(/exceeds 0 decimal places/);
    expect(() => parseDecimalToMinorUnits('-5.00', 'USD')).toThrow(/Invalid decimal money/);
  });

  it('performs full CRUD for users, settings, clients, invoices, pending_actions, activity_log, and webhook_events', () => {
    const repo = new InvoicePilotRepository(db!);
    const owner = repo.createUser({
      email: 'owner@consulting.example.com',
      displayName: 'Consulting Owner'
    });

    const settings = repo.updateSettings(owner.id, {
      businessName: 'Apex Advisory LLC',
      maxInvoiceAmountMinor: 500000 // $5,000.00
    });
    expect(settings.businessName).toBe('Apex Advisory LLC');
    expect(settings.maxInvoiceAmountMinor).toBe(500000);

    const client = repo.createClient(owner.id, {
      fullName: 'Clara Oswald',
      companyName: 'Tardis Media',
      email: 'clara@tardis.example.com',
      defaultCurrency: 'USD'
    });

    const updatedClient = repo.updateClientForOwner(owner.id, client.id, {
      notes: 'Always include PO number'
    });
    expect(updatedClient.notes).toBe('Always include PO number');

    const invoice = repo.createInvoiceDraft(owner.id, {
      clientId: client.id,
      invoiceNumber: 'INV-2026-001',
      currencyCode: 'USD',
      taxRateBps: 1000, // 10%
      issueDate: '2026-10-31',
      dueDate: '2026-11-14',
      items: [
        {
          description: 'Frontend Architecture Review',
          quantity: 2,
          unitAmountMinor: 50000, // $500.00 * 2 = $1,000.00 (100000)
          currencyCode: 'USD'
        },
        {
          description: 'Security Audit',
          quantity: 1,
          unitAmountMinor: 25000, // $250.00 (25000)
          currencyCode: 'USD'
        }
      ]
    });

    expect(invoice.subtotalMinor).toBe(125000);
    expect(invoice.taxMinor).toBe(12500);
    expect(invoice.totalMinor).toBe(137500);
    expect(invoice.localStatus).toBe('DRAFT');
    expect(invoice.providerStatus).toBe('NONE');
    expect(invoice.items).toHaveLength(2);

    // Sync provider status separately from local status
    const synced = repo.recordProviderInvoiceSync(owner.id, invoice.id, {
      providerMode: 'sandbox',
      providerInvoiceId: 'INV2-STAGE04-TEST-0001',
      providerStatus: 'SENT',
      localStatus: 'SENT',
      recipientViewUrl: 'https://www.sandbox.paypal.com/invoice/p/#STAGE04'
    });
    expect(synced.providerInvoiceId).toBe('INV2-STAGE04-TEST-0001');
    expect(synced.providerStatus).toBe('SENT');
    expect(synced.localStatus).toBe('SENT');

    // Create pending action
    const action = repo.createPendingAction(owner.id, {
      actionType: 'SEND_INVOICE',
      targetInvoiceId: invoice.id,
      payload: { invoiceId: invoice.id, totalMinor: invoice.totalMinor },
      idempotencyKey: 'idem_stage04_001'
    });
    expect(action.state).toBe('PENDING_APPROVAL');
    expect(action.payloadHash).toHaveLength(64);

    // Append activity log
    repo.appendActivityLog(owner.id, {
      actorType: 'user',
      action: 'INVOICE_APPROVED_AND_SENT',
      entityType: 'invoice',
      entityId: invoice.id,
      result: 'EXECUTED',
      detail: { providerInvoiceId: 'INV2-STAGE04-TEST-0001' }
    });
    const logs = repo.listActivityForOwner(owner.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('INVOICE_APPROVED_AND_SENT');

    // Deduplicate webhook events by provider_event_id
    const wh1 = repo.recordWebhookEvent({
      providerEventId: 'WH-EVT-1001',
      eventType: 'INVOICING.INVOICE.PAID',
      verificationStatus: 'VERIFIED',
      processingStatus: 'PROCESSED',
      relatedProviderInvoiceId: 'INV2-STAGE04-TEST-0001',
      payload: { id: 'WH-EVT-1001' }
    });
    expect(wh1.deduplicated).toBe(false);

    const wh2 = repo.recordWebhookEvent({
      providerEventId: 'WH-EVT-1001',
      eventType: 'INVOICING.INVOICE.PAID',
      verificationStatus: 'VERIFIED',
      processingStatus: 'PROCESSED',
      relatedProviderInvoiceId: 'INV2-STAGE04-TEST-0001',
      payload: { id: 'WH-EVT-1001' }
    });
    expect(wh2.deduplicated).toBe(true);
    expect(wh2.record.id).toBe(wh1.record.id);
  });

  it('denies cross-owner access on clients, invoices, and pending actions (FORBIDDEN_OWNER_MISMATCH)', () => {
    const repo = new InvoicePilotRepository(db!);
    const ownerA = repo.createUser({
      email: 'owner.a@example.com',
      displayName: 'Owner A'
    });
    const ownerB = repo.createUser({
      email: 'owner.b@example.com',
      displayName: 'Owner B'
    });

    const clientA = repo.createClient(ownerA.id, {
      fullName: 'Client of A',
      email: 'client.a@example.com'
    });

    const invoiceA = repo.createInvoiceDraft(ownerA.id, {
      clientId: clientA.id,
      invoiceNumber: 'INV-A-001',
      currencyCode: 'USD',
      issueDate: '2026-10-31',
      dueDate: '2026-11-15',
      items: [{ description: 'Item', quantity: 1, unitAmountMinor: 10000, currencyCode: 'USD' }]
    });

    const actionA = repo.createPendingAction(ownerA.id, {
      actionType: 'SEND_INVOICE',
      targetInvoiceId: invoiceA.id,
      payload: { invoiceId: invoiceA.id }
    });

    // Owner B cannot read, update, or delete Owner A's client
    expect(() => repo.getClientForOwner(ownerB.id, clientA.id)).toThrowError(
      OwnershipOrValidationError
    );
    try {
      repo.getClientForOwner(ownerB.id, clientA.id);
    } catch (err) {
      expect((err as OwnershipOrValidationError).code).toBe('FORBIDDEN_OWNER_MISMATCH');
    }

    expect(() =>
      repo.updateClientForOwner(ownerB.id, clientA.id, { fullName: 'Hijacked' })
    ).toThrow(/Access denied/);

    expect(() => repo.deleteClientForOwner(ownerB.id, clientA.id)).toThrow(/Access denied/);

    // Owner B cannot create an invoice referencing Owner A's client
    expect(() =>
      repo.createInvoiceDraft(ownerB.id, {
        clientId: clientA.id,
        invoiceNumber: 'INV-B-001',
        currencyCode: 'USD',
        issueDate: '2026-10-31',
        dueDate: '2026-11-15',
        items: [{ description: 'Item', quantity: 1, unitAmountMinor: 5000, currencyCode: 'USD' }]
      })
    ).toThrow(/Access denied/);

    // Owner B cannot read or sync Owner A's invoice
    expect(() => repo.getInvoiceForOwner(ownerB.id, invoiceA.id)).toThrow(/Access denied/);
    expect(() =>
      repo.recordProviderInvoiceSync(ownerB.id, invoiceA.id, {
        providerMode: 'sandbox',
        providerInvoiceId: 'INV2-FAKE',
        providerStatus: 'SENT'
      })
    ).toThrow(/Access denied/);

    // Owner B cannot read Owner A's pending action
    expect(() => repo.getPendingActionForOwner(ownerB.id, actionA.id)).toThrow(/Access denied/);

    // Owner B's list queries return empty arrays
    expect(repo.listClientsForOwner(ownerB.id)).toHaveLength(0);
    expect(repo.listInvoicesForOwner(ownerB.id)).toHaveLength(0);
  });

  it('rejects invoices that exceed the owner safety limit or mismatch item currency', () => {
    const repo = new InvoicePilotRepository(db!);
    const owner = repo.createUser({
      email: 'limit@example.com',
      displayName: 'Limit Tester'
    });
    repo.updateSettings(owner.id, {
      maxInvoiceAmountMinor: 50000 // $500.00 cap
    });

    const client = repo.createClient(owner.id, {
      fullName: 'Cap Client',
      email: 'cap@example.com'
    });

    // Over limit ($600.00 > $500.00)
    expect(() =>
      repo.createInvoiceDraft(owner.id, {
        clientId: client.id,
        invoiceNumber: 'INV-OVER',
        currencyCode: 'USD',
        issueDate: '2026-10-31',
        dueDate: '2026-11-15',
        items: [{ description: 'Too expensive', quantity: 1, unitAmountMinor: 60000, currencyCode: 'USD' }]
      })
    ).toThrow(/exceeds the configured safety limit/);

    // Currency mismatch between invoice (USD) and line item (EUR)
    expect(() =>
      repo.createInvoiceDraft(owner.id, {
        clientId: client.id,
        invoiceNumber: 'INV-CURR',
        currencyCode: 'USD',
        issueDate: '2026-10-31',
        dueDate: '2026-11-15',
        items: [{ description: 'Wrong currency', quantity: 1, unitAmountMinor: 10000, currencyCode: 'EUR' }]
      })
    ).toThrow(/must match invoice currency/);
  });

  it('resetAndSeedDemoTenant resets demo records deterministically without touching real user records', () => {
    const repo = new InvoicePilotRepository(db!);

    // 1. Create a real authenticated user (isDemo = false) with a client and invoice
    const realUser = repo.createUser({
      id: 'usr_real_customer_99',
      email: 'real.owner@freelance.example.com',
      displayName: 'Real Freelancer',
      isDemo: false
    });
    const realClient = repo.createClient(realUser.id, {
      fullName: 'Real Enterprise Client',
      email: 'ap@real-enterprise.example.com'
    });
    const realInvoice = repo.createInvoiceDraft(realUser.id, {
      clientId: realClient.id,
      invoiceNumber: 'INV-REAL-001',
      currencyCode: 'USD',
      issueDate: '2026-10-31',
      dueDate: '2026-11-30',
      items: [{ description: 'Retainer', quantity: 1, unitAmountMinor: 300000, currencyCode: 'USD' }]
    });

    // 2. Seed demo tenant and mutate demo data
    const firstSeed = repo.resetAndSeedDemoTenant();
    expect(firstSeed.demoUser.id).toBe(DEMO_TENANT_USER_ID);
    expect(firstSeed.clients).toHaveLength(2);
    expect(firstSeed.invoices).toHaveLength(1);

    repo.createClient(DEMO_TENANT_USER_ID, {
      fullName: 'Temporary Demo Client',
      email: 'temp@demo.example.com'
    });
    expect(repo.listClientsForOwner(DEMO_TENANT_USER_ID)).toHaveLength(3);

    // 3. Reset demo tenant again
    const secondSeed = repo.resetAndSeedDemoTenant();
    expect(secondSeed.clients).toHaveLength(2);
    expect(repo.listClientsForOwner(DEMO_TENANT_USER_ID)).toHaveLength(2);

    // 4. Verify real user's client and invoice were completely untouched
    const preservedRealClient = repo.getClientForOwner(realUser.id, realClient.id);
    expect(preservedRealClient.fullName).toBe('Real Enterprise Client');
    const preservedRealInvoice = repo.getInvoiceForOwner(realUser.id, realInvoice.id);
    expect(preservedRealInvoice.invoiceNumber).toBe('INV-REAL-001');
    expect(preservedRealInvoice.totalMinor).toBe(300000);
  });
});
