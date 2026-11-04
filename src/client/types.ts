export type ThemePreference = 'light' | 'dark' | 'system';

export type ShellSection =
  | 'overview'
  | 'agent'
  | 'invoices'
  | 'clients'
  | 'reminders'
  | 'activity'
  | 'notifications'
  | 'settings'
  | 'onboarding'
  | 'tokens'
  | 'roadmap'
  | 'help'
  | 'policies';

export interface TemplatePresetDto {
  id: string;
  name: string;
  description: string;
  unitPriceMinor: number;
  currencyCode: string;
}

export interface WebhookEventDto {
  id: string;
  providerEventId: string;
  eventType: string;
  summary: string | null;
  receivedAt: string;
  verificationStatus: string;
  payload: any;
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

export interface ReminderDto {
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

export interface NotificationDto {
  id: string;
  ownerUserId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface SettingsDto {
  userId: string;
  businessName: string;
  businessEmail: string;
  defaultCurrency: string;
  maxInvoiceAmountMinor: number;
  defaultPaymentTermsDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  authProvider: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingDto {
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

export interface HealthPayload {
  status: string;
  service: string;
  stage: string;
  environment: string;
  paypalMode: 'sandbox' | 'mock';
  isMock?: boolean;
  sandboxCredentialsConfigured?: boolean;
  geminiConfigured?: boolean;
  geminiModel?: string;
  modeLabel: string;
  approvalGateEnforced: boolean;
  timestamp: string;
}

export interface AgentExecutionDto {
  ok: boolean;
  status:
    | 'DRAFT_PREPARED'
    | 'INVOICE_DETAILS_RETRIEVED'
    | 'APPROVAL_SLIP_READY'
    | 'CLARIFICATION_NEEDED'
    | 'FINANCIAL_INSIGHTS_RETRIEVED'
    | 'VALIDATION_FAILED'
    | 'SAFETY_BLOCKED'
    | 'AGENT_ERROR';
  toolUsed?: string;
  assistantMessage: string;
  clarificationQuestion?: string;
  missingOrAmbiguousFields?: string[];
  validationExplanation?: string;
  safetyWarnings: string[];
  fallbackToConventionalForm: boolean;
  invoice?: InvoiceDto;
  client?: ClientDto;
  pendingAction?: PendingActionDto;
  approvalSlip?: ApprovalSlipDto;
  insights?: GroundedFinancialInsightsDto;
  modelMetadata: {
    provider: 'gemini';
    model: string;
    configured: boolean;
  };
}

export interface ApprovalSlipDto {
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
  providerMode: 'sandbox' | 'mock';
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

export interface PendingActionDto {
  id: string;
  ownerUserId: string;
  actionType: 'SEND_INVOICE' | 'SEND_REMINDER';
  targetInvoiceId: string;
  state: string;
  payloadHash: string;
  idempotencyKey: string;
  expiresAt: string;
  approvedAt?: string;
  executedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDto {
  id: string;
  ownerUserId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  result: string;
  detailJson: string;
  correlationId?: string;
  createdAt: string;
}

export interface ClientDto {
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

export interface InvoiceLineItemDto {
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

export interface InvoiceDto {
  id: string;
  ownerUserId: string;
  clientId: string;
  invoiceNumber: string;
  currencyCode: string;
  subtotalMinor: number;
  taxRateBps: number;
  taxMinor: number;
  totalMinor: number;
  paidAmountMinor?: number;
  isCompleted?: boolean;
  completedAt?: string;
  issueDate: string;
  dueDate: string;
  notes?: string;
  localStatus: string;
  providerMode: 'sandbox' | 'mock';
  providerInvoiceId?: string;
  providerStatus: string;
  providerRecipientViewUrl?: string;
  providerInvoicerViewUrl?: string;
  lastProviderSyncAt?: string;
  items: InvoiceLineItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AgingBucketItemDto {
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

export interface AgingBucketSummaryDto {
  bucketKey: 'current' | 'days1_30' | 'days31_60' | 'days61_90' | 'days90Plus';
  label: string;
  description: string;
  minDaysOverdue: number;
  maxDaysOverdue: number | null;
  count: number;
  totalOutstandingMinor: number;
  invoices: AgingBucketItemDto[];
}

export interface CurrencyAgingSummaryDto {
  currencyCode: string;
  totalOutstandingMinor: number;
  totalInvoicesCount: number;
  buckets: {
    current: AgingBucketSummaryDto;
    days1_30: AgingBucketSummaryDto;
    days31_60: AgingBucketSummaryDto;
    days61_90: AgingBucketSummaryDto;
    days90Plus: AgingBucketSummaryDto;
  };
}

export interface SlowPayerRankingItemDto {
  clientId: string;
  clientName: string;
  companyName?: string;
  email: string;
  defaultCurrency: string;
  totalInvoicesCount: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
  totalOutstandingMinorByCurrency: Record<string, number>;
  averageDaysToPay: number | null;
  latePaymentRate: number;
  reliability: 'PAYS_ON_TIME' | 'OCCASIONALLY_LATE' | 'FREQUENTLY_LATE' | 'INSUFFICIENT_HISTORY';
  reliabilityLabel: string;
  historyStatus: 'SUFFICIENT_HISTORY' | 'INSUFFICIENT_HISTORY';
  rankScore: number;
}

export interface ForecastWindowBucketDto {
  periodKey: 'days1_7' | 'days8_14' | 'days15_21' | 'days22_30';
  periodLabel: string;
  startDate: string;
  endDate: string;
  contractualTotalMinor: number;
  expectedTotalMinor: number;
  itemCount: number;
  inflows: Array<{
    invoiceId: string;
    invoiceNumber: string;
    clientId: string;
    clientName: string;
    dueDate: string;
    daysUntilDue: number;
    currencyCode: string;
    outstandingMinor: number;
    probability: number;
    expectedMinor: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    reliabilityBasis: string;
  }>;
}

export interface CurrencyCashFlowForecastDto {
  currencyCode: string;
  asOfDate: string;
  forecastWindowDays: 30;
  contractualTotalMinor: number;
  expectedTotalMinor: number;
  isEstimate: true;
  uncertaintyNotes: string[];
  windows: {
    days1_7: ForecastWindowBucketDto;
    days8_14: ForecastWindowBucketDto;
    days15_21: ForecastWindowBucketDto;
    days22_30: ForecastWindowBucketDto;
  };
}

export interface WeeklySummarySnapshotDto {
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

export interface GroundedFinancialInsightsDto {
  asOfDate: string;
  observedFactsNotice: string;
  projectionNotice: string;
  currenciesPresent: string[];
  agingByCurrency: Record<string, CurrencyAgingSummaryDto>;
  slowPayerRankings: SlowPayerRankingItemDto[];
  weeklySummary: WeeklySummarySnapshotDto;
  forecastByCurrency: Record<string, CurrencyCashFlowForecastDto>;
}

export interface DraftFormItem {
  description: string;
  quantity: string;
  unitPriceDecimal: string;
}

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'JPY'] as const;

export const CURRENCY_EXPONENTS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  INR: 2,
  SGD: 2,
  JPY: 0
};

export function formatMoneyFromMinor(amountMinor: number, currencyCode: string): string {
  const code = (currencyCode || 'USD').toUpperCase();
  const exponent = CURRENCY_EXPONENTS[code] ?? 2;
  if (exponent === 0) {
    return `${code} ${amountMinor.toString()}`;
  }
  const factor = 10 ** exponent;
  const sign = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / factor);
  const minor = String(abs % factor).padStart(exponent, '0');
  return `${code} ${sign}${major}.${minor}`;
}

export function minorToInputDecimal(amountMinor: number, currencyCode: string): string {
  const code = (currencyCode || 'USD').toUpperCase();
  const exponent = CURRENCY_EXPONENTS[code] ?? 2;
  if (exponent === 0) {
    return String(amountMinor);
  }
  const factor = 10 ** exponent;
  const major = Math.floor(amountMinor / factor);
  const minor = String(amountMinor % factor).padStart(exponent, '0');
  return `${major}.${minor}`;
}

export function parsePreviewMinor(decimalStr: string, currencyCode: string): number | null {
  const code = (currencyCode || 'USD').toUpperCase();
  const exponent = CURRENCY_EXPONENTS[code] ?? 2;
  const trimmed = decimalStr.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  if (frac.length > exponent) return null;
  const paddedFrac = frac.padEnd(exponent, '0');
  const minor =
    Number.parseInt(whole, 10) * 10 ** exponent +
    (exponent > 0 ? Number.parseInt(paddedFrac || '0', 10) : 0);
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null;
}

export function resolveEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return pref;
}

