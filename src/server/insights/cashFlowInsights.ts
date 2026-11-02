import type { ClientRecord, InvoiceRecord, ReminderRecord } from '../db/repository.js';

export interface AgingBucketItem {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  currencyCode: string;
  totalMinor: number;
  paidMinor: number;
  outstandingMinor: number;
}

export interface AgingBucketSummary {
  bucketKey: 'current' | 'days1_30' | 'days31_60' | 'days61_90' | 'days90Plus';
  label: string;
  description: string;
  minDaysOverdue: number;
  maxDaysOverdue: number | null;
  count: number;
  totalOutstandingMinor: number;
  invoices: AgingBucketItem[];
}

export interface CurrencyAgingSummary {
  currencyCode: string;
  totalOutstandingMinor: number;
  totalInvoicesCount: number;
  buckets: {
    current: AgingBucketSummary;
    days1_30: AgingBucketSummary;
    days31_60: AgingBucketSummary;
    days61_90: AgingBucketSummary;
    days90Plus: AgingBucketSummary;
  };
}

export type ClientReliabilityTag =
  | 'PAYS_ON_TIME'
  | 'OCCASIONALLY_LATE'
  | 'FREQUENTLY_LATE'
  | 'INSUFFICIENT_HISTORY';

export interface SlowPayerRankingItem {
  clientId: string;
  clientName: string;
  companyName?: string;
  email: string;
  defaultCurrency: string;
  totalInvoicesCount: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
  totalOutstandingMinorByCurrency: Record<string, number>;
  averageDaysToPay: number | null; // null if insufficient history
  latePaymentRate: number; // 0.0 to 1.0
  reliability: ClientReliabilityTag;
  reliabilityLabel: string;
  historyStatus: 'SUFFICIENT_HISTORY' | 'INSUFFICIENT_HISTORY';
  rankScore: number; // Higher score = slower/riskier payer
}

export interface WeeklySummarySnapshot {
  asOfDate: string;
  trailingWindowDays: 7;
  startDate: string;
  endDate: string;
  invoicesIssuedCount: number;
  invoicesIssuedTotalByCurrency: Record<string, number>;
  invoicesPaidCount: number;
  invoicesPaidTotalByCurrency: Record<string, number>;
  invoicesOverdueCount: number;
  invoicesOverdueTotalByCurrency: Record<string, number>;
  remindersSentCount: number;
}

export type ForecastConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ForecastInflowItem {
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  dueDate: string;
  daysUntilDue: number; // relative to asOfDate
  currencyCode: string;
  outstandingMinor: number;
  probability: number; // 0.0 to 1.0 based on client reliability
  expectedMinor: number; // Math.round(outstandingMinor * probability)
  confidence: ForecastConfidence;
  reliabilityBasis: ClientReliabilityTag;
}

export interface ForecastWindowBucket {
  periodKey: 'days1_7' | 'days8_14' | 'days15_21' | 'days22_30';
  periodLabel: string;
  startDate: string;
  endDate: string;
  contractualTotalMinor: number;
  expectedTotalMinor: number;
  itemCount: number;
  inflows: ForecastInflowItem[];
}

export interface CurrencyCashFlowForecast {
  currencyCode: string;
  asOfDate: string;
  forecastWindowDays: 30;
  contractualTotalMinor: number; // sum of scheduled unpaid dues
  expectedTotalMinor: number; // probability-adjusted estimate
  isEstimate: true; // Explicitly marked as projection
  uncertaintyNotes: string[];
  windows: {
    days1_7: ForecastWindowBucket;
    days8_14: ForecastWindowBucket;
    days15_21: ForecastWindowBucket;
    days22_30: ForecastWindowBucket;
  };
}

export interface GroundedFinancialInsights {
  asOfDate: string;
  observedFactsNotice: string;
  projectionNotice: string;
  currenciesPresent: string[];
  agingByCurrency: Record<string, CurrencyAgingSummary>;
  slowPayerRankings: SlowPayerRankingItem[];
  weeklySummary: WeeklySummarySnapshot;
  forecastByCurrency: Record<string, CurrencyCashFlowForecast>;
}

/**
 * Standard UTC calendar date math for consistent, deterministic boundary checks.
 */
export function parseIsoDateToUtc(dateStr: string): number {
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) {
    throw new Error(`Invalid ISO date format: "${dateStr}"`);
  }
  const year = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10);
  const day = Number.parseInt(parts[2], 10);
  return Date.UTC(year, month - 1, day);
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  const fromMs = parseIsoDateToUtc(fromIso);
  const toMs = parseIsoDateToUtc(toIso);
  return Math.floor((toMs - fromMs) / (1000 * 60 * 60 * 24));
}

export function addCalendarDays(fromIso: string, days: number): string {
  const ms = parseIsoDateToUtc(fromIso) + days * (1000 * 60 * 60 * 24);
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isInvoiceSettled(invoice: InvoiceRecord): boolean {
  return (
    invoice.providerStatus === 'PAID' ||
    invoice.providerStatus === 'MARKED_AS_PAID' ||
    ((invoice as { paidAmountMinor?: number }).paidAmountMinor !== undefined &&
      (invoice as { paidAmountMinor?: number }).paidAmountMinor! >= invoice.totalMinor)
  );
}

export function calculateInvoiceOutstandingMinor(invoice: InvoiceRecord): {
  paidMinor: number;
  outstandingMinor: number;
} {
  if (isInvoiceSettled(invoice)) {
    return { paidMinor: invoice.totalMinor, outstandingMinor: 0 };
  }
  const recordedPaid = (invoice as { paidAmountMinor?: number }).paidAmountMinor ?? 0;
  const paidMinor = Math.min(invoice.totalMinor, Math.max(0, recordedPaid));
  const outstandingMinor = Math.max(0, invoice.totalMinor - paidMinor);
  return { paidMinor, outstandingMinor };
}

/**
 * Computes multi-currency aging buckets without combining currencies.
 */
export function computeAgingBuckets(
  invoices: InvoiceRecord[],
  clients: ClientRecord[],
  asOfDate: string
): Record<string, CurrencyAgingSummary> {
  const clientMap = new Map(clients.map((c) => [c.id, c.fullName]));
  const result: Record<string, CurrencyAgingSummary> = {};

  const activeInvoices = invoices.filter(
    (inv) => inv.localStatus !== 'CANCELLED' && inv.providerStatus !== 'CANCELLED'
  );

  for (const inv of activeInvoices) {
    const { paidMinor, outstandingMinor } = calculateInvoiceOutstandingMinor(inv);
    if (outstandingMinor <= 0) continue; // Fully paid invoices do not age in unpaid receivables

    const currency = inv.currencyCode.toUpperCase();
    if (!result[currency]) {
      result[currency] = {
        currencyCode: currency,
        totalOutstandingMinor: 0,
        totalInvoicesCount: 0,
        buckets: {
          current: {
            bucketKey: 'current',
            label: 'Current (Not Overdue)',
            description: 'Due on or after reference date',
            minDaysOverdue: 0,
            maxDaysOverdue: 0,
            count: 0,
            totalOutstandingMinor: 0,
            invoices: []
          },
          days1_30: {
            bucketKey: 'days1_30',
            label: '1–30 Days Overdue',
            description: '1 to 30 days past payment due date',
            minDaysOverdue: 1,
            maxDaysOverdue: 30,
            count: 0,
            totalOutstandingMinor: 0,
            invoices: []
          },
          days31_60: {
            bucketKey: 'days31_60',
            label: '31–60 Days Overdue',
            description: '31 to 60 days past payment due date',
            minDaysOverdue: 31,
            maxDaysOverdue: 60,
            count: 0,
            totalOutstandingMinor: 0,
            invoices: []
          },
          days61_90: {
            bucketKey: 'days61_90',
            label: '61–90 Days Overdue',
            description: '61 to 90 days past payment due date',
            minDaysOverdue: 61,
            maxDaysOverdue: 90,
            count: 0,
            totalOutstandingMinor: 0,
            invoices: []
          },
          days90Plus: {
            bucketKey: 'days90Plus',
            label: '90+ Days Overdue',
            description: 'More than 90 days past payment due date',
            minDaysOverdue: 91,
            maxDaysOverdue: null,
            count: 0,
            totalOutstandingMinor: 0,
            invoices: []
          }
        }
      };
    }

    const summary = result[currency];
    summary.totalOutstandingMinor += outstandingMinor;
    summary.totalInvoicesCount += 1;

    const daysOverdue = diffCalendarDays(inv.dueDate, asOfDate);
    const item: AgingBucketItem = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: clientMap.get(inv.clientId) ?? 'Unknown Client',
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      daysOverdue: Math.max(0, daysOverdue),
      currencyCode: currency,
      totalMinor: inv.totalMinor,
      paidMinor,
      outstandingMinor
    };

    let targetBucket: AgingBucketSummary;
    if (daysOverdue <= 0) {
      targetBucket = summary.buckets.current;
    } else if (daysOverdue <= 30) {
      targetBucket = summary.buckets.days1_30;
    } else if (daysOverdue <= 60) {
      targetBucket = summary.buckets.days31_60;
    } else if (daysOverdue <= 90) {
      targetBucket = summary.buckets.days61_90;
    } else {
      targetBucket = summary.buckets.days90Plus;
    }

    targetBucket.count += 1;
    targetBucket.totalOutstandingMinor += outstandingMinor;
    targetBucket.invoices.push(item);
  }

  return result;
}

/**
 * Computes client payment behavior, average settlement latency, and slow-payer rankings.
 */
export function computeSlowPayerRankings(
  clients: ClientRecord[],
  invoices: InvoiceRecord[],
  asOfDate: string
): SlowPayerRankingItem[] {
  const rankings: SlowPayerRankingItem[] = [];

  for (const client of clients) {
    const clientInvoices = invoices.filter(
      (inv) =>
        inv.clientId === client.id &&
        inv.localStatus !== 'CANCELLED' &&
        inv.providerStatus !== 'CANCELLED'
    );

    const totalInvoicesCount = clientInvoices.length;
    const paidInvoices = clientInvoices.filter((inv) => isInvoiceSettled(inv));
    const paidInvoicesCount = paidInvoices.length;

    let overdueCount = 0;
    const outstandingByCurrency: Record<string, number> = {};

    for (const inv of clientInvoices) {
      const { outstandingMinor } = calculateInvoiceOutstandingMinor(inv);
      if (outstandingMinor > 0) {
        const curr = inv.currencyCode.toUpperCase();
        outstandingByCurrency[curr] = (outstandingByCurrency[curr] ?? 0) + outstandingMinor;
        if (diffCalendarDays(inv.dueDate, asOfDate) > 0) {
          overdueCount += 1;
        }
      }
    }

    let averageDaysToPay: number | null = null;
    let lateInvoicesCount = overdueCount;

    if (paidInvoicesCount > 0) {
      let totalDaysToPay = 0;
      for (const inv of paidInvoices) {
        const settleTimestamp =
          inv.lastProviderSyncAt ?? inv.updatedAt ?? inv.createdAt ?? asOfDate;
        const settleDate = settleTimestamp.slice(0, 10);
        const daysLate = Math.max(0, diffCalendarDays(inv.dueDate, settleDate));
        totalDaysToPay += daysLate;
        if (daysLate > 0) {
          lateInvoicesCount += 1;
        }
      }
      averageDaysToPay = Math.round(totalDaysToPay / paidInvoicesCount);
    }

    const eligibleTotal = paidInvoicesCount + overdueCount;
    const latePaymentRate =
      eligibleTotal > 0 ? Math.round((lateInvoicesCount / eligibleTotal) * 100) / 100 : 0;

    let reliability: ClientReliabilityTag;
    let reliabilityLabel: string;
    let historyStatus: 'SUFFICIENT_HISTORY' | 'INSUFFICIENT_HISTORY';

    if (paidInvoicesCount === 0) {
      historyStatus = 'INSUFFICIENT_HISTORY';
      if (overdueCount > 0) {
        reliability = 'FREQUENTLY_LATE';
        reliabilityLabel = 'Overdue balance with no completed payment history';
      } else {
        reliability = 'INSUFFICIENT_HISTORY';
        reliabilityLabel = 'New client — no completed payment history';
      }
    } else {
      historyStatus = 'SUFFICIENT_HISTORY';
      if (overdueCount >= 2 || (averageDaysToPay ?? 0) > 14 || latePaymentRate >= 0.5) {
        reliability = 'FREQUENTLY_LATE';
        reliabilityLabel = 'Frequently late — active follow-up recommended';
      } else if (overdueCount === 1 || (averageDaysToPay ?? 0) > 3 || latePaymentRate > 0.15) {
        reliability = 'OCCASIONALLY_LATE';
        reliabilityLabel = 'Occasionally late — monitor upcoming terms';
      } else {
        reliability = 'PAYS_ON_TIME';
        reliabilityLabel = 'Reliable — pays consistently on time';
      }
    }

    // Rank score: higher means slower / higher financial risk
    const rankScore = Math.round(
      latePaymentRate * 100 + (averageDaysToPay ?? 0) + overdueCount * 25
    );

    rankings.push({
      clientId: client.id,
      clientName: client.fullName,
      companyName: client.companyName ?? undefined,
      email: client.email,
      defaultCurrency: client.defaultCurrency,
      totalInvoicesCount,
      paidInvoicesCount,
      overdueInvoicesCount: overdueCount,
      totalOutstandingMinorByCurrency: outstandingByCurrency,
      averageDaysToPay,
      latePaymentRate,
      reliability,
      reliabilityLabel,
      historyStatus,
      rankScore
    });
  }

  // Sort descending by rankScore (slowest / riskiest first)
  rankings.sort((a, b) => b.rankScore - a.rankScore);
  return rankings;
}

/**
 * Computes observed trailing weekly business facts without projections.
 */
export function computeWeeklySummary(
  invoices: InvoiceRecord[],
  reminders: ReminderRecord[],
  asOfDate: string
): WeeklySummarySnapshot {
  const startDate = addCalendarDays(asOfDate, -7);
  const endDate = asOfDate;

  const issuedByCurrency: Record<string, number> = {};
  let issuedCount = 0;

  const paidByCurrency: Record<string, number> = {};
  let paidCount = 0;

  const overdueByCurrency: Record<string, number> = {};
  let overdueCount = 0;

  for (const inv of invoices) {
    if (inv.localStatus === 'CANCELLED' || inv.providerStatus === 'CANCELLED') continue;
    const curr = inv.currencyCode.toUpperCase();

    // Issued in trailing 7 days
    if (inv.issueDate >= startDate && inv.issueDate <= endDate) {
      issuedCount += 1;
      issuedByCurrency[curr] = (issuedByCurrency[curr] ?? 0) + inv.totalMinor;
    }

    // Paid in trailing 7 days
    if (isInvoiceSettled(inv)) {
      const settleDate = (inv.lastProviderSyncAt ?? inv.updatedAt).slice(0, 10);
      if (settleDate >= startDate && settleDate <= endDate) {
        paidCount += 1;
        paidByCurrency[curr] = (paidByCurrency[curr] ?? 0) + inv.totalMinor;
      }
    } else {
      // Currently overdue
      const daysLate = diffCalendarDays(inv.dueDate, asOfDate);
      if (daysLate > 0) {
        const { outstandingMinor } = calculateInvoiceOutstandingMinor(inv);
        if (outstandingMinor > 0) {
          overdueCount += 1;
          overdueByCurrency[curr] = (overdueByCurrency[curr] ?? 0) + outstandingMinor;
        }
      }
    }
  }

  const remindersSentCount = reminders.filter((r) => {
    if (r.approvalState !== 'SENT' || !r.sentAt) return false;
    const sentDate = r.sentAt.slice(0, 10);
    return sentDate >= startDate && sentDate <= endDate;
  }).length;

  return {
    asOfDate,
    trailingWindowDays: 7,
    startDate,
    endDate,
    invoicesIssuedCount: issuedCount,
    invoicesIssuedTotalByCurrency: issuedByCurrency,
    invoicesPaidCount: paidCount,
    invoicesPaidTotalByCurrency: paidByCurrency,
    invoicesOverdueCount: overdueCount,
    invoicesOverdueTotalByCurrency: overdueByCurrency,
    remindersSentCount
  };
}

/**
 * Computes 30-day cash-flow forecast segregated strictly by currency.
 * Projections are probability-weighted statistical estimates, never mixed across currencies.
 */
export function computeCashFlowForecast(
  invoices: InvoiceRecord[],
  clients: ClientRecord[],
  asOfDate: string
): Record<string, CurrencyCashFlowForecast> {
  const clientRankings = computeSlowPayerRankings(clients, invoices, asOfDate);
  const clientReliabilityMap = new Map(clientRankings.map((r) => [r.clientId, r.reliability]));
  const clientNameMap = new Map(clients.map((c) => [c.id, c.fullName]));

  const forecastEndDate = addCalendarDays(asOfDate, 30);
  const result: Record<string, CurrencyCashFlowForecast> = {};

  const activeInvoices = invoices.filter(
    (inv) => inv.localStatus !== 'CANCELLED' && inv.providerStatus !== 'CANCELLED'
  );

  for (const inv of activeInvoices) {
    const { outstandingMinor } = calculateInvoiceOutstandingMinor(inv);
    if (outstandingMinor <= 0) continue;

    const daysUntilDue = diffCalendarDays(asOfDate, inv.dueDate);

    // Eligible if overdue or due within the 30-day forward horizon
    if (daysUntilDue > 30) continue;

    const currency = inv.currencyCode.toUpperCase();
    if (!result[currency]) {
      result[currency] = {
        currencyCode: currency,
        asOfDate,
        forecastWindowDays: 30,
        contractualTotalMinor: 0,
        expectedTotalMinor: 0,
        isEstimate: true,
        uncertaintyNotes: [
          'Expected inflows are probability-weighted estimates based on client payment history.',
          'Projections are not guaranteed receipts and assume no unilateral cancellations.',
          'Currencies are tracked independently without exchange-rate synthesis.'
        ],
        windows: {
          days1_7: {
            periodKey: 'days1_7',
            periodLabel: 'Days 1–7 (Immediate)',
            startDate: asOfDate,
            endDate: addCalendarDays(asOfDate, 7),
            contractualTotalMinor: 0,
            expectedTotalMinor: 0,
            itemCount: 0,
            inflows: []
          },
          days8_14: {
            periodKey: 'days8_14',
            periodLabel: 'Days 8–14 (Next Week)',
            startDate: addCalendarDays(asOfDate, 8),
            endDate: addCalendarDays(asOfDate, 14),
            contractualTotalMinor: 0,
            expectedTotalMinor: 0,
            itemCount: 0,
            inflows: []
          },
          days15_21: {
            periodKey: 'days15_21',
            periodLabel: 'Days 15–21 (Two Weeks Out)',
            startDate: addCalendarDays(asOfDate, 15),
            endDate: addCalendarDays(asOfDate, 21),
            contractualTotalMinor: 0,
            expectedTotalMinor: 0,
            itemCount: 0,
            inflows: []
          },
          days22_30: {
            periodKey: 'days22_30',
            periodLabel: 'Days 22–30 (Month End)',
            startDate: addCalendarDays(asOfDate, 22),
            endDate: forecastEndDate,
            contractualTotalMinor: 0,
            expectedTotalMinor: 0,
            itemCount: 0,
            inflows: []
          }
        }
      };
    }

    const forecast = result[currency];
    const reliability = clientReliabilityMap.get(inv.clientId) ?? 'INSUFFICIENT_HISTORY';

    // Probability & Confidence based on client history
    let probability: number;
    let confidence: ForecastConfidence;

    switch (reliability) {
      case 'PAYS_ON_TIME':
        probability = 0.9;
        confidence = 'HIGH';
        break;
      case 'OCCASIONALLY_LATE':
        probability = 0.65;
        confidence = 'MEDIUM';
        break;
      case 'FREQUENTLY_LATE':
        probability = 0.35;
        confidence = 'LOW';
        break;
      case 'INSUFFICIENT_HISTORY':
      default:
        probability = 0.7;
        confidence = 'LOW';
        break;
    }

    // Apply aging penalty if invoice is already past due
    if (daysUntilDue < 0) {
      probability = Math.round(probability * 0.7 * 100) / 100;
    }

    const expectedMinor = Math.round(outstandingMinor * probability);
    forecast.contractualTotalMinor += outstandingMinor;
    forecast.expectedTotalMinor += expectedMinor;

    const inflowItem: ForecastInflowItem = {
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: clientNameMap.get(inv.clientId) ?? 'Unknown Client',
      dueDate: inv.dueDate,
      daysUntilDue,
      currencyCode: currency,
      outstandingMinor,
      probability,
      expectedMinor,
      confidence,
      reliabilityBasis: reliability
    };

    let targetWindow: ForecastWindowBucket;
    if (daysUntilDue <= 7) {
      targetWindow = forecast.windows.days1_7;
    } else if (daysUntilDue <= 14) {
      targetWindow = forecast.windows.days8_14;
    } else if (daysUntilDue <= 21) {
      targetWindow = forecast.windows.days15_21;
    } else {
      targetWindow = forecast.windows.days22_30;
    }

    targetWindow.itemCount += 1;
    targetWindow.contractualTotalMinor += outstandingMinor;
    targetWindow.expectedTotalMinor += expectedMinor;
    targetWindow.inflows.push(inflowItem);
  }

  return result;
}

/**
 * Top-level pure aggregator returning grounded financial insights for an owner.
 */
export function buildGroundedFinancialInsights(
  invoices: InvoiceRecord[],
  clients: ClientRecord[],
  reminders: ReminderRecord[],
  asOfDate: string = new Date().toISOString().slice(0, 10)
): GroundedFinancialInsights {
  const agingByCurrency = computeAgingBuckets(invoices, clients, asOfDate);
  const slowPayerRankings = computeSlowPayerRankings(clients, invoices, asOfDate);
  const weeklySummary = computeWeeklySummary(invoices, reminders, asOfDate);
  const forecastByCurrency = computeCashFlowForecast(invoices, clients, asOfDate);

  const currencySet = new Set<string>();
  for (const c of Object.keys(agingByCurrency)) currencySet.add(c);
  for (const c of Object.keys(forecastByCurrency)) currencySet.add(c);
  for (const inv of invoices) {
    if (inv.localStatus !== 'CANCELLED') currencySet.add(inv.currencyCode.toUpperCase());
  }

  return {
    asOfDate,
    observedFactsNotice:
      'Observed historical facts directly aggregated from verified database records.',
    projectionNotice:
      'PROJECTION ESTIMATE: Projections are probability-weighted statistical estimates, not guaranteed receipts. Past payment timing may not predict future performance.',
    currenciesPresent: Array.from(currencySet).sort(),
    agingByCurrency,
    slowPayerRankings,
    weeklySummary,
    forecastByCurrency
  };
}
