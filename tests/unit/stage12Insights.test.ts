import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiApp } from '../../src/server/app.js';
import { loadAppConfig } from '../../src/server/config.js';
import { openAndMigrateDatabase } from '../../src/server/db/schema.js';
import { InvoicePilotRepository } from '../../src/server/db/repository.js';
import { createPayPalAdapter } from '../../src/server/paypal/adapter.js';
import { GeminiInvoiceAgent } from '../../src/server/agent/geminiAgent.js';
import {
  diffCalendarDays,
  addCalendarDays,
  computeAgingBuckets,
  computeSlowPayerRankings,
  computeCashFlowForecast,
  buildGroundedFinancialInsights
} from '../../src/server/insights/cashFlowInsights.js';

describe('Stage 12 — Grounded Aging and Cash-Flow Insights', () => {
  const tempDirs: string[] = [];
  const openDbs: DatabaseSync[] = [];

  function createTestSetup(): {
    app: ReturnType<typeof createApiApp>;
    repo: InvoicePilotRepository;
    db: DatabaseSync;
  } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoicepilot-stage12-'));
    tempDirs.push(tmpDir);
    const dbFilePath = path.join(tmpDir, 'stage12.sqlite');
    const db = openAndMigrateDatabase(dbFilePath);
    openDbs.push(db);
    const repo = new InvoicePilotRepository(db);

    const config = loadAppConfig({
      DATABASE_URL: dbFilePath,
      PAYPAL_MODE: 'mock'
    });
    const adapter = createPayPalAdapter({ mode: 'mock' });
    const app = createApiApp(config, adapter, repo);

    return { app, repo, db };
  }

  afterEach(() => {
    while (openDbs.length > 0) {
      const db = openDbs.pop();
      try {
        db?.close();
      } catch {
        // Ignore close errors
      }
    }
    while (tempDirs.length > 0) {
      const d = tempDirs.pop();
      if (d && fs.existsSync(d)) {
        try {
          fs.rmSync(d, { recursive: true, force: true });
        } catch {
          // Ignore rm errors
        }
      }
    }
  });

  describe('1. Date Math & Aging Bucket Boundaries', () => {
    it('calculates deterministic UTC calendar day differences across month boundaries', () => {
      expect(diffCalendarDays('2026-10-31', '2026-11-01')).toBe(1);
      expect(diffCalendarDays('2026-11-01', '2026-11-01')).toBe(0);
      expect(diffCalendarDays('2026-11-05', '2026-11-01')).toBe(-4);
      expect(addCalendarDays('2026-10-31', 1)).toBe('2026-11-01');
      expect(addCalendarDays('2026-11-01', 30)).toBe('2026-12-01');
    });

    it('places overdue invoices into exact buckets (0, 1, 30, 31, 60, 61, 90, 91+)', () => {
      const asOfDate = '2026-11-01';

      // Test invoices at boundary due dates
      const mockInvoices: any[] = [
        {
          id: 'inv_curr_0',
          invoiceNumber: 'INV-0',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-10-01',
          dueDate: '2026-11-01', // Due today -> daysOverdue = 0 -> current
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_1_day',
          invoiceNumber: 'INV-1',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-10-01',
          dueDate: '2026-10-31', // 1 day overdue -> days1_30
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_30_days',
          invoiceNumber: 'INV-30',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-09-01',
          dueDate: '2026-10-02', // 30 days overdue -> days1_30
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_31_days',
          invoiceNumber: 'INV-31',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-09-01',
          dueDate: '2026-10-01', // 31 days overdue -> days31_60
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_60_days',
          invoiceNumber: 'INV-60',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-08-01',
          dueDate: '2026-09-02', // 60 days overdue -> days31_60
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_61_days',
          invoiceNumber: 'INV-61',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-08-01',
          dueDate: '2026-09-01', // 61 days overdue -> days61_90
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_90_days',
          invoiceNumber: 'INV-90',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-07-01',
          dueDate: '2026-08-03', // 90 days overdue -> days61_90
          localStatus: 'SENT',
          providerStatus: 'SENT'
        },
        {
          id: 'inv_91_days',
          invoiceNumber: 'INV-91',
          clientId: 'cli_1',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 0,
          issueDate: '2026-07-01',
          dueDate: '2026-08-02', // 91 days overdue -> days90Plus
          localStatus: 'SENT',
          providerStatus: 'SENT'
        }
      ];

      const clientList = [{ id: 'cli_1', fullName: 'Test Client' } as any];

      const aging = computeAgingBuckets(mockInvoices, clientList, asOfDate);
      const usdAging = aging['USD'];
      expect(usdAging).toBeDefined();

      expect(usdAging.buckets.current.count).toBe(1);
      expect(usdAging.buckets.current.invoices[0].invoiceId).toBe('inv_curr_0');

      expect(usdAging.buckets.days1_30.count).toBe(2);
      expect(usdAging.buckets.days1_30.invoices.map((i) => i.invoiceId)).toEqual([
        'inv_1_day',
        'inv_30_days'
      ]);

      expect(usdAging.buckets.days31_60.count).toBe(2);
      expect(usdAging.buckets.days31_60.invoices.map((i) => i.invoiceId)).toEqual([
        'inv_31_days',
        'inv_60_days'
      ]);

      expect(usdAging.buckets.days61_90.count).toBe(2);
      expect(usdAging.buckets.days61_90.invoices.map((i) => i.invoiceId)).toEqual([
        'inv_61_days',
        'inv_90_days'
      ]);

      expect(usdAging.buckets.days90Plus.count).toBe(1);
      expect(usdAging.buckets.days90Plus.invoices[0].invoiceId).toBe('inv_91_days');

      expect(usdAging.totalOutstandingMinor).toBe(80000);
      expect(usdAging.totalInvoicesCount).toBe(8);
    });
  });

  describe('2. Empty State & Truthful Grounding', () => {
    it('returns empty buckets and zeroes with no invented metrics when no data exists', () => {
      const insights = buildGroundedFinancialInsights([], [], [], '2026-11-01');

      expect(insights.currenciesPresent).toEqual([]);
      expect(Object.keys(insights.agingByCurrency)).toHaveLength(0);
      expect(insights.slowPayerRankings).toEqual([]);
      expect(insights.weeklySummary.invoicesIssuedCount).toBe(0);
      expect(insights.weeklySummary.invoicesPaidCount).toBe(0);
      expect(insights.weeklySummary.invoicesOverdueCount).toBe(0);
      expect(Object.keys(insights.forecastByCurrency)).toHaveLength(0);
      expect(insights.projectionNotice).toContain('statistical estimates');
      expect(insights.observedFactsNotice).toContain('Observed historical facts');
    });
  });

  describe('3. Partial Payments & Settlement Logic', () => {
    it('reduces outstanding balance by recorded partial payments and settles at 100%', () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'owner@example.com', displayName: 'Owner' });
      const client = repo.createClient(user.id, {
        fullName: 'Acme Logistics',
        email: 'billing@acme.example.com',
        defaultCurrency: 'USD'
      });

      const invoice = repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-PARTIAL-101',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'Freight Logistics', quantity: 1, unitAmountMinor: 100000 }]
      });

      expect(invoice.totalMinor).toBe(100000);
      expect(invoice.paidAmountMinor).toBe(0);

      // Record first partial payment: $400 (40000 minor)
      const afterPart1 = repo.recordPartialPayment(user.id, invoice.id, 40000);
      expect(afterPart1.paidAmountMinor).toBe(40000);
      expect(afterPart1.providerStatus).toBe('NONE'); // Not fully settled yet

      // Verify aging computation uses outstanding amount ($600), not total
      const insights1 = repo.getGroundedInsights(user.id, '2026-11-01');
      const usdAging1 = insights1.agingByCurrency['USD'];
      expect(usdAging1.totalOutstandingMinor).toBe(60000); // 100000 - 40000
      expect(usdAging1.buckets.days1_30.totalOutstandingMinor).toBe(60000);

      // Record second partial payment to settle in full: $600 (60000 minor)
      const afterPart2 = repo.recordPartialPayment(user.id, invoice.id, 60000);
      expect(afterPart2.paidAmountMinor).toBe(100000);
      expect(afterPart2.providerStatus).toBe('PAID'); // Settled in full

      // Fully settled invoice has 0 outstanding and is omitted from aging buckets
      const insights2 = repo.getGroundedInsights(user.id, '2026-11-01');
      expect(insights2.agingByCurrency['USD']).toBeUndefined();
    });

    it('rejects partial payments that exceed the total invoice amount or are non-positive', () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'owner2@example.com', displayName: 'Owner 2' });
      const client = repo.createClient(user.id, {
        fullName: 'Client Two',
        email: 'two@example.com',
        defaultCurrency: 'USD'
      });

      const invoice = repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-BOUND-202',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'Consulting', quantity: 1, unitAmountMinor: 50000 }]
      });

      // Non-positive amount
      expect(() => repo.recordPartialPayment(user.id, invoice.id, 0)).toThrow(/positive integer/i);
      expect(() => repo.recordPartialPayment(user.id, invoice.id, -100)).toThrow(/positive integer/i);

      // Over-payment (50001 exceeds total 50000)
      expect(() => repo.recordPartialPayment(user.id, invoice.id, 50001)).toThrow(
        /cannot exceed invoice total/i
      );
    });
  });

  describe('4. Multi-Currency Segregation (Never Combine Currencies)', () => {
    it('keeps USD, EUR, and GBP completely segregated in aging and forecasts', () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'multicurrency@example.com', displayName: 'Multi Owner' });
      const clientUSD = repo.createClient(user.id, {
        fullName: 'US Client',
        email: 'us@example.com',
        defaultCurrency: 'USD'
      });
      const clientEUR = repo.createClient(user.id, {
        fullName: 'EU Client',
        email: 'eu@example.com',
        defaultCurrency: 'EUR'
      });

      repo.createInvoiceDraft(user.id, {
        clientId: clientUSD.id,
        invoiceNumber: 'INV-USD-1',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'US Consulting', quantity: 1, unitAmountMinor: 150000 }]
      });

      repo.createInvoiceDraft(user.id, {
        clientId: clientEUR.id,
        invoiceNumber: 'INV-EUR-1',
        currencyCode: 'EUR',
        issueDate: '2026-10-01',
        dueDate: '2026-10-20',
        items: [{ description: 'EU Advisory', quantity: 1, unitAmountMinor: 200000 }]
      });

      const insights = repo.getGroundedInsights(user.id, '2026-11-01');

      expect(insights.currenciesPresent.sort()).toEqual(['EUR', 'USD']);
      expect(insights.agingByCurrency['USD'].totalOutstandingMinor).toBe(150000);
      expect(insights.agingByCurrency['EUR'].totalOutstandingMinor).toBe(200000);

      // Verify forecast is segregated
      expect(insights.forecastByCurrency['USD']).toBeDefined();
      expect(insights.forecastByCurrency['EUR']).toBeDefined();
      expect(insights.forecastByCurrency['USD'].currencyCode).toBe('USD');
      expect(insights.forecastByCurrency['EUR'].currencyCode).toBe('EUR');
    });
  });

  describe('5. Slow-Payer Rankings & Reliability Status', () => {
    it('identifies INSUFFICIENT_HISTORY for new clients with zero paid invoices', () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'newclient@example.com', displayName: 'Owner' });
      const client = repo.createClient(user.id, {
        fullName: 'Brand New Client',
        email: 'new@example.com',
        defaultCurrency: 'USD'
      });

      repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-NEW-1',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-11-15',
        items: [{ description: 'Setup', quantity: 1, unitAmountMinor: 50000 }]
      });

      const insights = repo.getGroundedInsights(user.id, '2026-11-01');
      const ranking = insights.slowPayerRankings.find((r) => r.clientId === client.id);

      expect(ranking).toBeDefined();
      expect(ranking!.historyStatus).toBe('INSUFFICIENT_HISTORY');
      expect(ranking!.averageDaysToPay).toBeNull();
      expect(ranking!.reliability).toBe('INSUFFICIENT_HISTORY');
      expect(ranking!.reliabilityLabel).toBe('New client — no completed payment history');
    });

    it('computes averageDaysToPay and tags reliability when invoices have been paid', () => {
      const asOfDate = '2026-11-01';
      const client1 = {
        id: 'cli_fast',
        fullName: 'Fast Payer Corp',
        email: 'fast@example.com',
        defaultCurrency: 'USD'
      } as any;

      const client2 = {
        id: 'cli_slow',
        fullName: 'Chronic Late LLC',
        email: 'slow@example.com',
        defaultCurrency: 'USD'
      } as any;

      const invoices: any[] = [
        // Fast client: paid in 5 days (issue Oct 1, paid Oct 6)
        {
          id: 'inv_fast_1',
          clientId: 'cli_fast',
          currencyCode: 'USD',
          totalMinor: 10000,
          paidAmountMinor: 10000,
          issueDate: '2026-10-01',
          dueDate: '2026-10-15',
          updatedAt: '2026-10-06T12:00:00Z',
          providerStatus: 'PAID'
        },
        // Slow client: paid 25 days after issue (11 days late)
        {
          id: 'inv_slow_1',
          clientId: 'cli_slow',
          currencyCode: 'USD',
          totalMinor: 20000,
          paidAmountMinor: 20000,
          issueDate: '2026-09-01',
          dueDate: '2026-09-15',
          updatedAt: '2026-09-26T12:00:00Z',
          providerStatus: 'PAID'
        },
        // Slow client: another late paid invoice
        {
          id: 'inv_slow_2',
          clientId: 'cli_slow',
          currencyCode: 'USD',
          totalMinor: 20000,
          paidAmountMinor: 20000,
          issueDate: '2026-09-10',
          dueDate: '2026-09-20',
          updatedAt: '2026-10-05T12:00:00Z',
          providerStatus: 'PAID'
        }
      ];

      const rankings = computeSlowPayerRankings([client1, client2], invoices, asOfDate);

      const fastRanking = rankings.find((r) => r.clientId === 'cli_fast')!;
      expect(fastRanking.reliability).toBe('PAYS_ON_TIME');
      expect(fastRanking.averageDaysToPay).toBe(0);
      expect(fastRanking.latePaymentRate).toBe(0);

      const slowRanking = rankings.find((r) => r.clientId === 'cli_slow')!;
      expect(slowRanking.reliability).toBe('FREQUENTLY_LATE');
      expect(slowRanking.averageDaysToPay).toBeGreaterThan(5);
      expect(slowRanking.latePaymentRate).toBe(1.0);
      expect(slowRanking.rankScore).toBeGreaterThan(fastRanking.rankScore);
    });
  });

  describe('6. 30-Day Cash-Flow Forecast & Uncertainty Disclaimers', () => {
    it('weights expected inflows by client reliability and labels projections as estimates', () => {
      const asOfDate = '2026-11-01';
      const client = {
        id: 'cli_reliable',
        fullName: 'Reliable Client',
        defaultCurrency: 'USD'
      } as any;

      const invoices: any[] = [
        {
          id: 'inv_future_1',
          invoiceNumber: 'INV-F-1',
          clientId: 'cli_reliable',
          currencyCode: 'USD',
          totalMinor: 100000, // $1,000
          paidAmountMinor: 0,
          issueDate: '2026-10-25',
          dueDate: '2026-11-05', // 4 days forward -> days1_7 window
          localStatus: 'SENT',
          providerStatus: 'SENT'
        }
      ];

      const forecastMap = computeCashFlowForecast(invoices, [client], asOfDate);
      const usdForecast = forecastMap['USD'];

      expect(usdForecast).toBeDefined();
      expect(usdForecast.isEstimate).toBe(true);
      expect(usdForecast.contractualTotalMinor).toBe(100000);
      expect(usdForecast.expectedTotalMinor).toBe(70000); // 0.70 conservative weight for new client
      expect(usdForecast.windows.days1_7.itemCount).toBe(1);
      expect(usdForecast.windows.days1_7.expectedTotalMinor).toBe(70000);
      expect(usdForecast.windows.days1_7.inflows[0].confidence).toBe('LOW');
      expect(usdForecast.uncertaintyNotes.length).toBeGreaterThan(0);
    });
  });

  describe('7. API Endpoints & Cross-Owner Isolation', () => {
    it('GET /api/insights retrieves grounded insights for authenticated owner', async () => {
      const { app, repo } = createTestSetup();
      const user = repo.createUser({ email: 'api_insights@example.com', displayName: 'API User' });
      const session = repo.createSession(user.id);
      const client = repo.createClient(user.id, {
        fullName: 'Tech Corp',
        email: 'billing@techcorp.example.com',
        defaultCurrency: 'USD'
      });

      repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-API-1',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'Dev sprint', quantity: 1, unitAmountMinor: 100000 }]
      });

      const res = await request(app)
        .get('/api/insights?asOfDate=2026-11-01')
        .set('Authorization', `Bearer ${session.rawToken}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.insights.currenciesPresent).toContain('USD');
      expect(res.body.insights.agingByCurrency['USD'].totalOutstandingMinor).toBe(100000);
      expect(res.body.insights.slowPayerRankings).toHaveLength(1);
    });

    it('validates asOfDate query parameter format strictly', async () => {
      const { app, repo } = createTestSetup();
      const user = repo.createUser({ email: 'invalid_date@example.com', displayName: 'User' });
      const session = repo.createSession(user.id);

      const res = await request(app)
        .get('/api/insights?asOfDate=not-a-date')
        .set('Authorization', `Bearer ${session.rawToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('YYYY-MM-DD');
    });

    it('POST /api/invoices/:id/partial-payment enforces owner authorization and validation', async () => {
      const { app, repo } = createTestSetup();
      const ownerA = repo.createUser({ email: 'ownerA@example.com', displayName: 'Owner A' });
      const ownerB = repo.createUser({ email: 'ownerB@example.com', displayName: 'Owner B' });
      const sessionA = repo.createSession(ownerA.id);
      const sessionB = repo.createSession(ownerB.id);

      const clientA = repo.createClient(ownerA.id, {
        fullName: 'Client A',
        email: 'clientA@example.com',
        defaultCurrency: 'USD'
      });

      const invA = repo.createInvoiceDraft(ownerA.id, {
        clientId: clientA.id,
        invoiceNumber: 'INV-A-100',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'Work', quantity: 1, unitAmountMinor: 100000 }]
      });

      // Owner B cannot record partial payment on Owner A's invoice
      const resForbidden = await request(app)
        .post(`/api/invoices/${invA.id}/partial-payment`)
        .set('Authorization', `Bearer ${sessionB.rawToken}`)
        .send({ amountMinor: 25000 });

      expect(resForbidden.status).toBe(403);

      // Owner A records valid partial payment
      const resSuccess = await request(app)
        .post(`/api/invoices/${invA.id}/partial-payment`)
        .set('Authorization', `Bearer ${sessionA.rawToken}`)
        .send({ amountMinor: 25000 });

      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.ok).toBe(true);
      expect(resSuccess.body.invoice.paidAmountMinor).toBe(25000);
    });
  });

  describe('8. Gemini Agent Financial Insights Tool & Fallback', () => {
    it('executes get_financial_insights tool when model selects it', async () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'agent_user@example.com', displayName: 'Agent User' });
      const client = repo.createClient(user.id, {
        fullName: 'Agent Client',
        email: 'cli@example.com',
        defaultCurrency: 'USD'
      });

      repo.createInvoiceDraft(user.id, {
        clientId: client.id,
        invoiceNumber: 'INV-AI-1',
        currencyCode: 'USD',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15',
        items: [{ description: 'Design Sprint', quantity: 1, unitAmountMinor: 50000 }]
      });

      const fetchMock = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        toolName: 'get_financial_insights',
                        assistantMessage: 'Here is your grounded cash-flow analysis.',
                        getFinancialInsightsArgs: {
                          asOfDate: '2026-11-01'
                        }
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

      const agent = new GeminiInvoiceAgent(repo, {
        apiKey: 'test-gemini-key',
        model: 'gemini-2.5-flash',
        fetchImpl: fetchMock as any
      });

      const outcome = await agent.processPrompt(user.id, {
        prompt: 'Show me my receivables aging and cash flow forecast'
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.status).toBe('FINANCIAL_INSIGHTS_RETRIEVED');
      expect(outcome.insights).toBeDefined();
      expect(outcome.insights!.agingByCurrency['USD'].totalOutstandingMinor).toBe(50000);
    });

    it('falls back to grounded insights when Gemini is offline and prompt requests cash flow insights', async () => {
      const { repo } = createTestSetup();
      const user = repo.createUser({ email: 'offline@example.com', displayName: 'Offline User' });

      const agent = new GeminiInvoiceAgent(repo, {
        apiKey: '', // unconfigured
        model: 'gemini-2.5-flash'
      });

      const outcome = await agent.processPrompt(user.id, {
        prompt: 'What is my 30-day cash flow forecast and aging?'
      });

      expect(outcome.ok).toBe(true);
      expect(outcome.status).toBe('FINANCIAL_INSIGHTS_RETRIEVED');
      expect(outcome.insights).toBeDefined();
      expect(outcome.assistantMessage).toContain('Grounded financial insights');
    });
  });
});
