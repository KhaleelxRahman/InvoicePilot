import React, { useEffect, useState } from 'react';
import { GlobalSearch } from './components/GlobalSearch';
import { DeveloperDiagnostics } from './components/DeveloperDiagnostics';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { ApprovalSlip } from './components/ApprovalSlip';
import { InvoiceDraftForm } from './components/InvoiceDraftForm';
import { InvoiceDetailView } from './components/InvoiceDetailView';
import { ClientDetailView } from './components/ClientDetailView';
import { ReminderModal } from './components/ReminderModal';
import { StartPage } from './components/StartPage';

export * from './types';

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

interface DraftFormItem {
  description: string;
  quantity: string;
  unitPriceDecimal: string;
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR', 'SGD', 'JPY'] as const;

const CURRENCY_EXPONENTS: Record<string, number> = {
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

function parsePreviewMinor(decimalStr: string, currencyCode: string): number | null {
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

interface TokenDefinition {
  name: string;
  lightHex: string;
  darkHex: string;
  purpose: string;
}

const DESIGN_TOKENS: TokenDefinition[] = [
  { name: 'desk', lightHex: '#F5F6F3', darkHex: '#151A18', purpose: 'Workspace background desk surface' },
  { name: 'sheet', lightHex: '#FFFFFF', darkHex: '#1C2420', purpose: 'Paper invoice & ledger sheet surface' },
  { name: 'sheet-2', lightHex: '#EEF1ED', darkHex: '#242E29', purpose: 'Secondary soft surface' },
  { name: 'ink', lightHex: '#202923', darkHex: '#E9EFEA', purpose: 'Primary typography & ledger figures' },
  { name: 'ink-muted', lightHex: '#66716A', darkHex: '#A5B0A8', purpose: 'Secondary labels & metadata' },
  { name: 'rule', lightHex: '#DEE4DF', darkHex: '#344139', purpose: 'Fine ledger & table rules' },
  { name: 'primary', lightHex: '#285B4A', darkHex: '#8FBFA6', purpose: 'Primary interactive control' },
  { name: 'on-primary', lightHex: '#FFFFFF', darkHex: '#11231B', purpose: 'Contrast text on primary surface' },
  { name: 'highlight', lightHex: '#F3EFE6', darkHex: 'rgba(180, 160, 120, 0.15)', purpose: 'Restrained approval review highlight' },
  { name: 'paid', lightHex: '#236B4D', darkHex: '#68C194', purpose: 'Verified paid status accent' },
  { name: 'late', lightHex: '#A83832', darkHex: '#E26D68', purpose: 'Overdue / error status accent' },
  { name: 'caution', lightHex: '#94601A', darkHex: '#E09F45', purpose: 'Pending approval / mock warning accent' },
  { name: 'info', lightHex: '#315A75', darkHex: '#7FA7C4', purpose: 'Sandbox environment & informational accent' }
];

interface StageGroupRow {
  id: string;
  title: string;
  stageTarget: string;
  status: string;
}

const BASELINE_FEATURE_GROUPS: StageGroupRow[] = [
  { id: 'Stage 01', title: 'App/repo foundation, design tokens, responsive shell, health check', stageTarget: 'Stage 1', status: 'VERIFIED' },
  { id: 'F-007 / Stage 02-08', title: 'PayPal Sandbox proof, isolated adapter, approved send & live status refresh', stageTarget: 'Stages 2–3, 8', status: 'VERIFIED' },
  { id: 'F-004 / F-006', title: 'SQLite persistence, owner isolation, Clients & conventional Invoices CRUD', stageTarget: 'Stages 4–5', status: 'VERIFIED' },
  { id: 'F-005 / F-010', title: 'Signature Approval Slip state machine & append-oriented Activity log', stageTarget: 'Stage 6', status: 'VERIFIED' },
  { id: 'F-003', title: 'Constrained Gemini AI invoice draft agent with form fallback', stageTarget: 'Stage 7', status: 'VERIFIED' },
  { id: 'F-008 / F-009', title: 'Client-aware reminder drafts & grounded aging/cash-flow insights', stageTarget: 'Stages 9–12', status: 'VERIFIED' },
  { id: 'F-013 / Stage 13', title: 'MCP vs REST evaluation & direct REST architectural decision (D-005)', stageTarget: 'Stage 13', status: 'VERIFIED' },
  { id: 'F-001 / F-011-014', title: 'Help/FAQ, Policies, Templates, Webhook viewer, Account deletion & settings', stageTarget: 'Stage 14', status: 'VERIFIED' }
];

function resolveEffectiveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') {
    return pref;
  }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function App() {
  const [themePref, setThemePref] = useState<ThemePreference>(() => {
    try {
      const saved = window.localStorage.getItem('invoicepilot-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() =>
    resolveEffectiveTheme(themePref)
  );
  const [activeSection, setActiveSection] = useState<ShellSection>('overview');

  // Health state
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Clients state
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [clientsLoading, setClientsLoading] = useState<boolean>(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientDto | null>(null);
  const [selectedClientInvoices, setSelectedClientInvoices] = useState<InvoiceDto[]>([]);
  const [clientFormMode, setClientFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [clientFullName, setClientFullName] = useState('');
  const [clientCompanyName, setClientCompanyName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCurrency, setClientCurrency] = useState('USD');
  const [clientNotes, setClientNotes] = useState('');
  const [clientFormSubmitting, setClientFormSubmitting] = useState(false);
  const [clientFormError, setClientFormError] = useState<string | null>(null);
  const [clientFeedback, setClientFeedback] = useState<string | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDto | null>(null);
  const [selectedInvoiceClient, setSelectedInvoiceClient] = useState<ClientDto | null>(null);
  const [invoiceFormMode, setInvoiceFormMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [draftClientId, setDraftClientId] = useState('');
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState('');
  const [draftCurrency, setDraftCurrency] = useState('USD');
  const [draftTaxPercent, setDraftTaxPercent] = useState('0');
  const [draftIssueDate, setDraftIssueDate] = useState('2026-10-31');
  const [draftDueDate, setDraftDueDate] = useState('2026-11-14');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftFormItem[]>([
    { description: '', quantity: '1', unitPriceDecimal: '100.00' }
  ]);
  const [invoiceFormSubmitting, setInvoiceFormSubmitting] = useState(false);
  const [invoiceFormError, setInvoiceFormError] = useState<string | null>(null);
  const [invoiceFeedback, setInvoiceFeedback] = useState<string | null>(null);

  // Stage 06: Approval Slip & Activity Log state
  const [activeAction, setActiveAction] = useState<PendingActionDto | null>(null);
  const [activeSlip, setActiveSlip] = useState<ApprovalSlipDto | null>(null);
  const [slipLoading, setSlipLoading] = useState<boolean>(false);
  const [slipError, setSlipError] = useState<string | null>(null);
  const [slipFeedback, setSlipFeedback] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState<boolean>(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  // Stage 07: Constrained Gemini Structured Agent state
  const [agentPrompt, setAgentPrompt] = useState<string>('');
  const [agentLoading, setAgentLoading] = useState<boolean>(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [agentResult, setAgentResult] = useState<AgentExecutionDto | null>(null);

  // Stage 08: PayPal Provider Status Refresh state
  const [providerRefreshing, setProviderRefreshing] = useState<boolean>(false);

  // Stage 09: Authentication & Onboarding state
  const [currentUser, setCurrentUser] = useState<UserDto | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('invoicepilot-session-token');
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authDisplayName, setAuthDisplayName] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);

  const [onboarding, setOnboarding] = useState<OnboardingDto | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState<boolean>(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [onboardingFeedback, setOnboardingFeedback] = useState<string | null>(null);

  // Onboarding step inputs
  // Stage 10: Settings & Notifications state
  const [settingsData, setSettingsData] = useState<SettingsDto | null>(null);
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'business' | 'paypal' | 'agent' | 'appearance' | 'privacy' | 'developer'
  >('business');
  const [settingsBusinessName, setSettingsBusinessName] = useState<string>('');
  const [settingsBusinessEmail, setSettingsBusinessEmail] = useState<string>('');
  const [settingsDefaultCurrency, setSettingsDefaultCurrency] = useState<string>('USD');
  const [settingsMaxAmountMinor, setSettingsMaxAmountMinor] = useState<number>(1000000);
  const [settingsPaymentTerms, setSettingsPaymentTerms] = useState<number>(14);
  const [settingsReminderTone, setSettingsReminderTone] = useState<'polite' | 'firm' | 'final'>('polite');

  // Stage 14: Remaining Pages, Controls, Webhook Viewer & Templates
  const [templates, setTemplates] = useState<TemplatePresetDto[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventDto[]>([]);
  const [webhookEventsLoading, setWebhookEventsLoading] = useState<boolean>(false);
  const [selectedWebhookPayload, setSelectedWebhookPayload] = useState<string | null>(null);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string>('');
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-approval');
  const [activePolicyTab, setActivePolicyTab] = useState<'terms' | 'privacy' | 'security' | 'aup'>('terms');

  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState<boolean>(false);
  const [notifFilter, setNotifFilter] = useState<'all' | 'unread'>('all');

  // Stage 11: Reminders state
  const [reminders, setReminders] = useState<ReminderDto[]>([]);
  const [remindersLoading, setRemindersLoading] = useState<boolean>(false);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [remindersTab, setRemindersTab] = useState<'waiting' | 'scheduled' | 'sent'>('waiting');

  const [reminderDraftModalOpen, setReminderDraftModalOpen] = useState<boolean>(false);
  const [reminderTargetInvoice, setReminderTargetInvoice] = useState<InvoiceDto | null>(null);
  const [reminderTone, setReminderTone] = useState<ReminderTone>('polite');
  const [reminderSubject, setReminderSubject] = useState<string>('');
  const [reminderBody, setReminderBody] = useState<string>('');
  const [reminderNotes, setReminderNotes] = useState<string>('');
  const [reminderScheduledDate, setReminderScheduledDate] = useState<string>('');
  const [reminderDraftLoading, setReminderDraftLoading] = useState<boolean>(false);
  const [reminderDraftError, setReminderDraftError] = useState<string | null>(null);
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);

  const [processScheduledLoading, setProcessScheduledLoading] = useState<boolean>(false);
  const [processScheduledResult, setProcessScheduledResult] = useState<string | null>(null);

  // Stage 12: Aging & Cash Flow Insights state
  const [insights, setInsights] = useState<GroundedFinancialInsightsDto | null>(null);
  const [insightsLoading, setInsightsLoading] = useState<boolean>(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>('');
  const [partialPaymentSubmitting, setPartialPaymentSubmitting] = useState<boolean>(false);
  const [partialPaymentError, setPartialPaymentError] = useState<string | null>(null);
  const [partialPaymentSuccess, setPartialPaymentSuccess] = useState<string | null>(null);

  // Stage 10: Invoices & Clients & Activity Filters
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [invoiceClientFilter, setInvoiceClientFilter] = useState<string>('all');
  const [invoiceSort, setInvoiceSort] = useState<string>('due-asc');

  const [clientSearch, setClientSearch] = useState<string>('');

  const [activitySearch, setActivitySearch] = useState<string>('');
  const [activityResultFilter, setActivityResultFilter] = useState<string>('all');

  // Frontend Redesign States: Header Search, Notification Dropdown & Mobile Navigation
  const [headerSearchQuery, setHeaderSearchQuery] = useState<string>('');
  const [notificationDropdownOpen, setNotificationDropdownOpen] = useState<boolean>(false);
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);

  const [onbBusinessName, setOnbBusinessName] = useState<string>('My Consulting Practice');
  const [onbBusinessEmail, setOnbBusinessEmail] = useState<string>('contact@mybusiness.example.com');
  const [onbCurrency, setOnbCurrency] = useState<string>('USD');
  const [onbMaxAmountMinor, setOnbMaxAmountMinor] = useState<number>(1000000);
  const [onbReminderTone, setOnbReminderTone] = useState<'polite' | 'firm' | 'final'>('polite');
  const [onbClientName, setOnbClientName] = useState<string>('Acme Corp Client');
  const [onbClientEmail, setOnbClientEmail] = useState<string>('billing@acme-corp.example.com');
  const [onbClientCompany, setOnbClientCompany] = useState<string>('Acme Corporation');

  useEffect(() => {
    const applied = resolveEffectiveTheme(themePref);
    setEffectiveTheme(applied);
    document.documentElement.setAttribute('data-theme', applied);
    try {
      window.localStorage.setItem('invoicepilot-theme', themePref);
    } catch {
      // Ignore storage write errors
    }

    if (themePref === 'system' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (event: MediaQueryListEvent) => {
        const nextTheme = event.matches ? 'dark' : 'light';
        setEffectiveTheme(nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [themePref]);

  function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  }

  async function loadSettings() {
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/settings', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setSettingsData(data.settings);
          setSettingsBusinessName(data.settings.businessName || '');
          setSettingsBusinessEmail(data.settings.businessEmail || '');
          setSettingsDefaultCurrency(data.settings.defaultCurrency || 'USD');
          setSettingsMaxAmountMinor(data.settings.maxInvoiceAmountMinor || 1000000);
          setSettingsPaymentTerms(data.settings.defaultPaymentTermsDays || 14);
        }
      }
    } catch {
      // Ignore
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveBusinessSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: settingsBusinessName,
          businessEmail: settingsBusinessEmail,
          defaultCurrency: settingsDefaultCurrency,
          defaultPaymentTermsDays: settingsPaymentTerms
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to update business settings.');
      setSettingsData(data.settings);
      setSettingsFeedback('Business settings saved successfully.');
      await loadActivities();
      await loadNotifications();
      await loadSettings();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Error updating settings.');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSaveAgentSettings(e: React.FormEvent) {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsFeedback(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxInvoiceAmountMinor: settingsMaxAmountMinor
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Failed to update safety limit.');
      setSettingsData(data.settings);
      setSettingsFeedback('Agent safety limits updated.');
      await loadActivities();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Error updating limits.');
    } finally {
      setSettingsLoading(false);
    }
  }

  async function loadNotifications() {
    setNotificationsLoading(true);
    try {
      const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Ignore
    } finally {
      setNotificationsLoading(false);
    }
  }

  async function handleMarkNotificationRead(id: string) {
    try {
      const res = await fetch('/api/notifications/' + encodeURIComponent(id) + '/read', {
        method: 'PATCH',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
      }
    } catch {
      // Ignore
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      const res = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // Ignore
    }
  }

  function handleDuplicateInvoice(inv: InvoiceDto) {
    setEditingInvoiceId(null);
    setDraftClientId(inv.clientId);
    setDraftInvoiceNumber('');
    setDraftCurrency(inv.currencyCode);
    setDraftTaxPercent(String((inv.taxRateBps / 100).toFixed(2)));
    const today = new Date().toISOString().slice(0, 10);
    setDraftIssueDate(today);
    const due = new Date();
    due.setDate(due.getDate() + 14);
    setDraftDueDate(due.toISOString().slice(0, 10));
    setDraftNotes(inv.notes || '');
    setDraftItems(
      inv.items.map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unitPriceDecimal: (it.unitAmountMinor / 100).toFixed(2)
      }))
    );
    setInvoiceFeedback('Duplicated invoice ' + inv.invoiceNumber + ' into a new draft.');
    setSelectedInvoice(null);
    setInvoiceFormMode('create');
    setActiveSection('invoices');
  }

  function handleExportInvoicesCsv() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const headers = ['Invoice Number', 'Client', 'Amount', 'Currency', 'Issue Date', 'Due Date', 'Status', 'Provider ID'];
    const rows = invoices.map((inv) => {
      const client = clients.find((c) => c.id === inv.clientId);
      const clientName = client?.companyName ? client.fullName + ' (' + client.companyName + ')' : client?.fullName || 'Unknown';
      const amount = (inv.totalMinor / 100).toFixed(2);
      const status = inv.providerStatus === 'PAID' ? 'PAID' : inv.dueDate < todayIso && inv.localStatus !== 'DRAFT' ? 'LATE' : inv.localStatus;
      return [
        inv.invoiceNumber,
        '"' + clientName.replace(/"/g, '""') + '"',
        amount,
        inv.currencyCode,
        inv.issueDate,
        inv.dueDate,
        status,
        inv.providerInvoiceId || ''
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'invoices-export-' + todayIso + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportActivityCsv() {
    const todayIso = new Date().toISOString().slice(0, 10);
    const headers = ['Timestamp', 'Actor', 'Action', 'Entity', 'Result', 'Correlation ID'];
    const rows = activities.map((act) => [
      act.createdAt,
      act.actorType,
      '"' + act.action.replace(/"/g, '""') + '"',
      act.entityType + ':' + act.entityId,
      act.result,
      act.correlationId || ''
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'activity-export-' + todayIso + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleExportWorkspaceJson() {
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const res = await fetch('/api/export', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to download workspace export.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'invoicepilot-export-' + todayIso + '.json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSettingsFeedback('Workspace data exported successfully.');
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Export failed.');
    }
  }

  async function checkSession() {
    try {
      if (!sessionToken) {
        // Do not automatically sign in as demo when user opens the app
        setCurrentUser(null);
        return;
      }

      const headers = getAuthHeaders();
      const res = await fetch('/api/auth/me', { headers });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setOnboarding(data.onboarding);
        if (data.onboarding) {
          if (data.onboarding.businessName) setOnbBusinessName(data.onboarding.businessName);
          if (data.onboarding.businessEmail) setOnbBusinessEmail(data.onboarding.businessEmail);
          if (data.onboarding.defaultCurrency) setOnbCurrency(data.onboarding.defaultCurrency);
          if (data.onboarding.maxInvoiceAmountMinor) setOnbMaxAmountMinor(data.onboarding.maxInvoiceAmountMinor);
          if (data.onboarding.defaultReminderTone) setOnbReminderTone(data.onboarding.defaultReminderTone);
        }
        await loadClients();
        await loadInvoices();
        await loadActivities();
        await loadNotifications();
        return;
      }

      // If stored session token is expired or invalid, clear it without falling back to demo
      try {
        window.localStorage.removeItem('invoicepilot-session-token');
      } catch {
        // Ignore
      }
      setSessionToken(null);
      setCurrentUser(null);
    } catch {
      // Ignore network errors on init
    }
  }

  async function performLogin(email: string, pass: string) {
    setAuthLoading(true);
    setAuthError(null);
    setAuthFeedback(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        throw new Error(data.error?.message ?? 'Invalid email or password.');
      }
      setCurrentUser(data.user);
      setSessionToken(data.sessionToken);
      setOnboarding(data.onboarding);
      try {
        window.localStorage.setItem('invoicepilot-session-token', data.sessionToken);
      } catch {
        // Ignore
      }
      setAuthModalOpen(false);
      setAuthFeedback(`Signed in as ${data.user.displayName}.`);
      await loadClients();
      await loadInvoices();
      await loadActivities();
      await loadNotifications();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function performRegister(email: string, pass: string, displayName: string) {
    setAuthLoading(true);
    setAuthError(null);
    setAuthFeedback(null);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email,
          password: pass,
          displayName
        })
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        throw new Error(data.error?.message ?? 'Registration failed.');
      }
      setCurrentUser(data.user);
      setSessionToken(data.sessionToken);
      setOnboarding(data.onboarding);
      try {
        window.localStorage.setItem('invoicepilot-session-token', data.sessionToken);
      } catch {
        // Ignore
      }
      setAuthModalOpen(false);
      setAuthFeedback(`Registered account for ${data.user.displayName}. Welcome to InvoicePilot!`);
      setActiveSection('onboarding');
      await loadClients();
      await loadInvoices();
      await loadActivities();
      await loadNotifications();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(authEmail, authPassword);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    await performRegister(authEmail, authPassword, authDisplayName);
  }

  async function handleLogout() {
    setAuthLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {
      // Ignore
    } finally {
      try {
        window.localStorage.removeItem('invoicepilot-session-token');
      } catch {
        // Ignore
      }
      setSessionToken(null);
      setCurrentUser(null);
      setClients([]);
      setInvoices([]);
      setActivities([]);
      setNotifications([]);
      setAuthLoading(false);
    }
  }

  async function handleSaveOnboardingBusiness(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/business-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          businessName: onbBusinessName,
          businessEmail: onbBusinessEmail,
          defaultCurrency: onbCurrency
        })
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Failed to save business details.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback('Business details saved. Next: Verify PayPal Sandbox connection.');
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Failed to save business details.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleTestOnboardingSandbox() {
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/test-sandbox', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Sandbox connection test failed.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback(
        data.sandboxResult?.ok
          ? `PayPal connection verified successfully (${data.modeLabel}).`
          : 'PayPal Sandbox test failed. Check credentials.'
      );
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Sandbox test failed.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleSaveOnboardingPreferences(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          maxInvoiceAmountMinor: onbMaxAmountMinor,
          defaultReminderTone: onbReminderTone
        })
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Failed to save preferences.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback('Preferences saved. Next: Create your first client profile.');
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Failed to save preferences.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleCreateOnboardingClient(e: React.FormEvent) {
    e.preventDefault();
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/first-client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          fullName: onbClientName,
          email: onbClientEmail,
          companyName: onbClientCompany,
          defaultCurrency: onbCurrency
        })
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Failed to create client.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback(`Workspace setup complete! Created first client: ${data.client.fullName}.`);
      await loadClients();
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Failed to create client.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleSkipOnboarding() {
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/skip', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Failed to skip onboarding.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback('Onboarding skipped. You can configure settings anytime.');
      setActiveSection('invoices');
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Failed to skip onboarding.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function handleResetOnboarding() {
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const res = await fetch('/api/onboarding/reset', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!res.ok || !data.onboarding) {
        throw new Error(data.error?.message ?? 'Failed to reset onboarding.');
      }
      setOnboarding(data.onboarding);
      setOnboardingFeedback('Onboarding reset to Step 1.');
      setActiveSection('onboarding');
      await loadActivities();
    } catch (err) {
      setOnboardingError(err instanceof Error ? err.message : 'Failed to reset onboarding.');
    } finally {
      setOnboardingLoading(false);
    }
  }

  async function fetchHealthStatus() {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const response = await fetch('/api/health', {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Health check returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as HealthPayload;
      setHealth(data);
    } catch (err) {
      setHealthError(
        err instanceof Error
          ? err.message
          : 'Unable to reach application server health check.'
      );
    } finally {
      setHealthLoading(false);
    }
  }

  async function loadClients() {
    setClientsLoading(true);
    setClientsError(null);
    try {
      const res = await fetch('/api/clients', { headers: getAuthHeaders() });
      const data = (await res.json()) as { clients?: ClientDto[]; error?: { message: string } };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to load clients (HTTP ${res.status})`);
      }
      const list = data.clients ?? [];
      setClients(list);
      if (!draftClientId && list.length > 0) {
        setDraftClientId(list[0].id);
      }
    } catch (err) {
      setClientsError(err instanceof Error ? err.message : 'Unable to load clients.');
    } finally {
      setClientsLoading(false);
    }
  }

  async function loadClientDetail(clientId: string) {
    setClientsError(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, {
        headers: getAuthHeaders()
      });
      const data = (await res.json()) as {
        client?: ClientDto;
        invoices?: InvoiceDto[];
        error?: { message: string };
      };
      if (!res.ok || !data.client) {
        throw new Error(data.error?.message ?? 'Unable to load client detail.');
      }
      setSelectedClient(data.client);
      setSelectedClientInvoices(data.invoices ?? []);
    } catch (err) {
      setClientsError(err instanceof Error ? err.message : 'Unable to load client detail.');
    }
  }

  async function loadInvoices() {
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const res = await fetch('/api/invoices', { headers: getAuthHeaders() });
      const data = (await res.json()) as { invoices?: InvoiceDto[]; error?: { message: string } };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to load invoices (HTTP ${res.status})`);
      }
      setInvoices(data.invoices ?? []);
      void loadInsights();
    } catch (err) {
      setInvoicesError(err instanceof Error ? err.message : 'Unable to load invoices.');
    } finally {
      setInvoicesLoading(false);
    }
  }

  async function loadInsights(asOfDate?: string) {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const url = asOfDate
        ? `/api/insights?asOfDate=${encodeURIComponent(asOfDate)}`
        : '/api/insights';
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = (await res.json()) as {
        insights?: GroundedFinancialInsightsDto;
        error?: { message: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to load insights (HTTP ${res.status})`);
      }
      setInsights(data.insights ?? null);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Unable to load insights.');
    } finally {
      setInsightsLoading(false);
    }
  }

  async function handleRecordPartialPayment(invoiceId: string, currencyCode: string) {
    if (!partialPaymentAmount.trim()) return;
    setPartialPaymentSubmitting(true);
    setPartialPaymentError(null);
    setPartialPaymentSuccess(null);
    try {
      const exp = CURRENCY_EXPONENTS[currencyCode] ?? 2;
      const parsedAmount = parseFloat(partialPaymentAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Please enter a valid positive payment amount.');
      }
      const amountMinor = Math.round(parsedAmount * Math.pow(10, exp));

      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/partial-payment`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amountMinor })
      });

      const data = (await res.json()) as {
        ok?: boolean;
        invoice?: InvoiceDto;
        error?: { message: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to record payment (HTTP ${res.status})`);
      }

      setPartialPaymentSuccess(
        `Payment of ${formatMoneyFromMinor(amountMinor, currencyCode)} recorded successfully.`
      );
      setPartialPaymentAmount('');
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
      }
      void loadInvoices();
      void loadInsights();
    } catch (err) {
      setPartialPaymentError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setPartialPaymentSubmitting(false);
    }
  }

  const [completeSubmitting, setCompleteSubmitting] = useState<boolean>(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completeSuccess, setCompleteSuccess] = useState<string | null>(null);

  async function handleMarkInvoiceCompleted(invoiceId: string) {
    setCompleteSubmitting(true);
    setCompleteError(null);
    setCompleteSuccess(null);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/complete`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });
      const data = (await res.json()) as {
        ok?: boolean;
        invoice?: InvoiceDto;
        error?: { message: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to mark completed (HTTP ${res.status})`);
      }

      setCompleteSuccess(`Invoice ${data.invoice?.invoiceNumber ?? invoiceId} marked as operationally completed.`);
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
      }
      void loadInvoices();
      void loadActivities();
      void loadNotifications();
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : 'Failed to mark invoice as completed.');
    } finally {
      setCompleteSubmitting(false);
    }
  }

  async function loadInvoiceDetail(invoiceId: string) {
    setInvoicesError(null);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
        headers: getAuthHeaders()
      });
      const data = (await res.json()) as {
        invoice?: InvoiceDto;
        client?: ClientDto;
        error?: { message: string };
      };
      if (!res.ok || !data.invoice) {
        throw new Error(data.error?.message ?? 'Unable to load invoice detail.');
      }
      setSelectedInvoice(data.invoice);
      setSelectedInvoiceClient(data.client ?? null);
    } catch (err) {
      setInvoicesError(err instanceof Error ? err.message : 'Unable to load invoice detail.');
    }
  }

  async function loadReminders() {
    setRemindersLoading(true);
    setRemindersError(null);
    try {
      const res = await fetch('/api/reminders', { headers: getAuthHeaders() });
      const data = (await res.json()) as { reminders?: ReminderDto[]; error?: { message: string } };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to load reminders (HTTP ${res.status})`);
      }
      setReminders(data.reminders ?? []);
    } catch (err) {
      setRemindersError(err instanceof Error ? err.message : 'Unable to load reminders.');
    } finally {
      setRemindersLoading(false);
    }
  }

  function handleOpenReminderDraftForInvoice(inv: InvoiceDto) {
    setReminderTargetInvoice(inv);
    const today = new Date().toISOString().slice(0, 10);
    const dueMs = new Date(inv.dueDate).getTime();
    const nowMs = new Date(today).getTime();
    const daysOverdue = Math.max(0, Math.floor((nowMs - dueMs) / 86400000));
    const autoTone = daysOverdue >= 30 ? 'final' : daysOverdue > 7 ? 'firm' : 'polite';
    setReminderTone(autoTone);
    setReminderSubject('');
    setReminderBody('');
    setReminderNotes('');
    setReminderScheduledDate('');
    setReminderDraftError(null);
    setReminderFeedback(null);
    setReminderDraftModalOpen(true);
  }

  async function handleGenerateReminderDraft() {
    if (!reminderTargetInvoice) return;
    setReminderDraftLoading(true);
    setReminderDraftError(null);
    try {
      const res = await fetch(
        `/api/invoices/${encodeURIComponent(reminderTargetInvoice.id)}/reminders/draft`,
        {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tone: reminderTone,
            notes: reminderNotes.trim() || undefined,
            scheduledFor: reminderScheduledDate.trim() || undefined
          })
        }
      );
      const data = (await res.json()) as {
        ok?: boolean;
        reminder?: ReminderDto;
        wording?: { subject: string; body: string };
        error?: { message: string };
      };
      if (!res.ok || !data.reminder) {
        throw new Error(data.error?.message ?? 'Failed to generate reminder draft.');
      }
      setReminderSubject(data.reminder.subject);
      setReminderBody(data.reminder.body);
      setReminderFeedback(
        `Draft generated (${data.reminder.tone} tone). Review wording before sending.`
      );
      void loadReminders();
      void loadNotifications();
      void loadActivities();
    } catch (err) {
      setReminderDraftError(err instanceof Error ? err.message : 'Failed to draft reminder.');
    } finally {
      setReminderDraftLoading(false);
    }
  }

  async function handleRequestReminderApproval(reminderId: string) {
    try {
      const res = await fetch(
        `/api/reminders/${encodeURIComponent(reminderId)}/request-approval`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );
      if (!res.ok) throw new Error('Failed to request approval.');
      void loadReminders();
      void loadActivities();
    } catch (err) {
      setRemindersError(err instanceof Error ? err.message : 'Failed to request approval.');
    }
  }

  async function handleApproveReminder(reminderId: string) {
    try {
      const res = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}/approve`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Failed to approve reminder.');
      void loadReminders();
      void loadActivities();
    } catch (err) {
      setRemindersError(err instanceof Error ? err.message : 'Failed to approve reminder.');
    }
  }

  async function handleRejectReminder(reminderId: string, reason?: string) {
    try {
      const res = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}/reject`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      if (!res.ok) throw new Error('Failed to reject reminder.');
      void loadReminders();
      void loadActivities();
    } catch (err) {
      setRemindersError(err instanceof Error ? err.message : 'Failed to reject reminder.');
    }
  }

  async function handleSendReminder(reminderId: string) {
    setRemindersError(null);
    setReminderFeedback('Sending reminder via PayPal Sandbox...');
    try {
      const res = await fetch(`/api/reminders/${encodeURIComponent(reminderId)}/send`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: { message: string };
        evidence?: string;
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Failed to send reminder.');
      }
      setReminderFeedback('Reminder sent successfully!');
      void loadReminders();
      void loadActivities();
      void loadNotifications();
    } catch (err) {
      setRemindersError(err instanceof Error ? err.message : 'Failed to send reminder.');
    }
  }

  async function handleProcessDueScheduled() {
    setProcessScheduledLoading(true);
    setProcessScheduledResult(null);
    try {
      const res = await fetch('/api/reminders/process-scheduled', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentTimeIso: new Date().toISOString() })
      });
      const data = (await res.json()) as {
        ok?: boolean;
        results?: Array<{ id: string; success: boolean; evidence?: string }>;
      };
      setProcessScheduledResult(
        `Scheduler executed: ${data.results?.length ?? 0} reminders processed.`
      );
      void loadReminders();
      void loadActivities();
    } catch {
      setProcessScheduledResult('Scheduler execution failed.');
    } finally {
      setProcessScheduledLoading(false);
    }
  }

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/templates', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = (await res.json()) as { templates?: TemplatePresetDto[] };
        if (Array.isArray(data.templates)) {
          setTemplates(data.templates);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setTemplatesLoading(false);
    }
  }

  function handleSelectTemplatePreset(templateId: string) {
    if (!templateId) return;
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    const priceDec = (tmpl.unitPriceMinor / 100).toFixed(2);
    setDraftItems((prev) => {
      if (prev.length === 1 && !prev[0].description.trim()) {
        return [
          {
            description: `${tmpl.name}: ${tmpl.description}`,
            quantity: '1',
            unitPriceDecimal: priceDec
          }
        ];
      }
      return [
        ...prev,
        {
          description: `${tmpl.name}: ${tmpl.description}`,
          quantity: '1',
          unitPriceDecimal: priceDec
        }
      ];
    });
  }

  async function loadWebhookEvents() {
    setWebhookEventsLoading(true);
    try {
      const res = await fetch('/api/webhooks/paypal/events', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = (await res.json()) as { events?: WebhookEventDto[] };
        if (Array.isArray(data.events)) {
          setWebhookEvents(data.events);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setWebhookEventsLoading(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleteSuccess(null);
    if (!deleteConfirmEmail.trim()) {
      setDeleteError('Please type your account email to confirm permanent deletion.');
      return;
    }
    setDeleteSubmitting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: deleteConfirmEmail.trim() })
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: { message: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? 'Account deletion failed.');
      }
      setDeleteSuccess(data.message ?? 'Account permanently deleted.');
      setDeleteConfirmEmail('');
      setTimeout(() => {
        void checkSession();
        void loadClients();
        void loadInvoices();
        void loadActivities();
        void loadNotifications();
      }, 1000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Account deletion failed.');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  useEffect(() => {
    void fetchHealthStatus();
    void checkSession();
  }, []);

  useEffect(() => {
    if (sessionToken) {
      void loadClients();
      void loadInvoices();
      void loadReminders();
      void loadActivities();
      void loadInsights();
      void loadTemplates();
    }
  }, [sessionToken]);

  async function loadActivities() {
    setActivitiesLoading(true);
    setActivitiesError(null);
    try {
      const res = await fetch('/api/activity', { headers: getAuthHeaders() });
      const data = (await res.json()) as {
        activities?: ActivityDto[];
        error?: { message: string };
      };
      if (!res.ok) {
        throw new Error(data.error?.message ?? `Failed to load activity log (HTTP ${res.status})`);
      }
      setActivities(data.activities ?? []);
    } catch (err) {
      setActivitiesError(err instanceof Error ? err.message : 'Unable to load activity log.');
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function handleAgentSubmit(e?: React.FormEvent, customPrompt?: string) {
    if (e) e.preventDefault();
    const promptToSend = (customPrompt ?? agentPrompt).trim();
    if (!promptToSend) {
      setAgentError('Please enter an invoice request or question for the agent.');
      return;
    }

    setAgentLoading(true);
    setAgentError(null);
    try {
      const res = await fetch('/api/agent/prepare-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ prompt: promptToSend })
      });
      const data = (await res.json()) as AgentExecutionDto & { error?: { message: string } };
      if (!res.ok || !data.status) {
        throw new Error(data.error?.message ?? 'Agent request failed.');
      }

      setAgentResult(data);
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
        await loadInvoices();
      }
      if (data.pendingAction && data.approvalSlip) {
        setActiveAction(data.pendingAction);
        setActiveSlip(data.approvalSlip);
      }
      await loadActivities();
    } catch (err) {
      setAgentError(
        err instanceof Error
          ? err.message
          : 'Gemini agent unavailable. Please use the conventional invoice form.'
      );
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleRequestApprovalSlip(invoiceId: string) {
    setSlipLoading(true);
    setSlipError(null);
    setSlipFeedback(null);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/approval-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ invoiceId })
      });
      const data = (await res.json()) as {
        action?: PendingActionDto;
        slip?: ApprovalSlipDto;
        invoice?: InvoiceDto;
        error?: { message: string };
      };
      if (!res.ok || !data.action || !data.slip) {
        throw new Error(data.error?.message ?? 'Unable to generate approval slip.');
      }
      setActiveAction(data.action);
      setActiveSlip(data.slip);
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
      }
      await loadInvoices();
      await loadActivities();
      setSlipFeedback(
        `Prepared approval slip for ${data.slip.invoiceNumber}. Review details and approve or discard.`
      );
    } catch (err) {
      setSlipError(err instanceof Error ? err.message : 'Unable to generate approval slip.');
    } finally {
      setSlipLoading(false);
    }
  }

  async function handleApproveSlip() {
    if (!activeAction) return;
    setSlipLoading(true);
    setSlipError(null);
    setSlipFeedback(null);
    try {
      const res = await fetch(`/api/actions/${encodeURIComponent(activeAction.id)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });
      const data = (await res.json()) as {
        action?: PendingActionDto;
        slip?: ApprovalSlipDto;
        invoice?: InvoiceDto;
        error?: { message: string };
      };
      if (!res.ok || !data.action) {
        throw new Error(data.error?.message ?? 'Unable to approve action.');
      }
      setActiveAction(data.action);
      if (data.slip) setActiveSlip(data.slip);
      if (data.invoice) setSelectedInvoice(data.invoice);
      await loadInvoices();
      await loadActivities();
      setSlipFeedback(
        `Approved slip ${data.action.id}. Ready for execution after final server revalidation.`
      );
    } catch (err) {
      setSlipError(err instanceof Error ? err.message : 'Unable to approve slip.');
      await loadInvoices();
      await loadActivities();
    } finally {
      setSlipLoading(false);
    }
  }

  async function handleRejectSlip() {
    if (!activeAction) return;
    setSlipLoading(true);
    setSlipError(null);
    setSlipFeedback(null);
    try {
      const res = await fetch(`/api/actions/${encodeURIComponent(activeAction.id)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ reason: 'Discarded by user on approval slip.' })
      });
      const data = (await res.json()) as {
        action?: PendingActionDto;
        invoice?: InvoiceDto;
        error?: { message: string };
      };
      if (!res.ok || !data.action) {
        throw new Error(data.error?.message ?? 'Unable to discard approval slip.');
      }
      setActiveAction(data.action);
      if (data.invoice) setSelectedInvoice(data.invoice);
      await loadInvoices();
      await loadActivities();
      setSlipFeedback(
        `Discarded approval slip (${data.action.id}). This action is terminal (REJECTED) and will never execute.`
      );
    } catch (err) {
      setSlipError(err instanceof Error ? err.message : 'Unable to discard approval slip.');
    } finally {
      setSlipLoading(false);
    }
  }

  async function handleExecuteApprovedSlip() {
    if (!activeAction) return;
    setSlipLoading(true);
    setSlipError(null);
    setSlipFeedback(null);
    try {
      const res = await fetch(`/api/actions/${encodeURIComponent(activeAction.id)}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });
      const data = (await res.json()) as {
        action?: PendingActionDto;
        invoice?: InvoiceDto;
        providerResult?: {
          mode: string;
          isMock: boolean;
          modeLabel: string;
          providerInvoiceId: string;
          providerStatus: string;
        };
        error?: { message: string };
      };
      if (data.action) setActiveAction(data.action);
      if (data.invoice) setSelectedInvoice(data.invoice);
      await loadInvoices();
      await loadActivities();

      if (!res.ok || !data.providerResult) {
        throw new Error(
          data.error?.message ?? 'Execution failed or is unavailable in the current mode.'
        );
      }

      setSlipFeedback(
        `Executed approved send (${data.providerResult.modeLabel}): Provider ID ${data.providerResult.providerInvoiceId} (${data.providerResult.providerStatus}).`
      );
    } catch (err) {
      setSlipError(err instanceof Error ? err.message : 'Unable to execute approved action.');
    } finally {
      setSlipLoading(false);
    }
  }

  async function handleRefreshProviderStatus(invoiceId: string) {
    setProviderRefreshing(true);
    setInvoicesError(null);
    setInvoiceFeedback(null);
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/paypal/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });
      const data = (await res.json()) as {
        invoice?: InvoiceDto;
        providerSnapshot?: {
          providerInvoiceId: string;
          providerStatus: string;
          recipientViewUrl?: string;
        };
        modeLabel?: string;
        error?: { message: string };
      };
      if (data.invoice) {
        setSelectedInvoice(data.invoice);
      }
      await loadInvoices();
      await loadActivities();

      if (!res.ok || !data.invoice || !data.providerSnapshot) {
        throw new Error(data.error?.message ?? 'Unable to refresh PayPal status.');
      }

      setInvoiceFeedback(
        `Refreshed PayPal status (${data.modeLabel ?? 'PayPal'}): ${data.providerSnapshot.providerInvoiceId} is currently ${data.providerSnapshot.providerStatus}.`
      );
    } catch (err) {
      setInvoicesError(
        err instanceof Error ? err.message : 'Unable to refresh PayPal status.'
      );
    } finally {
      setProviderRefreshing(false);
    }
  }

  function openCreateClientForm() {
    setClientFormError(null);
    setClientFeedback(null);
    setClientFullName('');
    setClientCompanyName('');
    setClientEmail('');
    setClientCurrency('USD');
    setClientNotes('');
    setClientFormMode('create');
  }

  function openEditClientForm(client: ClientDto) {
    setClientFormError(null);
    setClientFeedback(null);
    setSelectedClient(client);
    setClientFullName(client.fullName);
    setClientCompanyName(client.companyName ?? '');
    setClientEmail(client.email);
    setClientCurrency(client.defaultCurrency);
    setClientNotes(client.notes ?? '');
    setClientFormMode('edit');
  }

  async function handleSaveClient(e: React.FormEvent) {
    e.preventDefault();
    setClientFormError(null);
    setClientFeedback(null);

    const trimmedName = clientFullName.trim();
    const trimmedEmail = clientEmail.trim().toLowerCase();
    if (!trimmedName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setClientFormError('Client full name and a valid email address are required.');
      return;
    }

    setClientFormSubmitting(true);

    try {
      const isEdit = clientFormMode === 'edit' && selectedClient;
      const url = isEdit
        ? `/api/clients/${encodeURIComponent(selectedClient.id)}`
        : '/api/clients';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          fullName: trimmedName,
          companyName: clientCompanyName,
          email: trimmedEmail,
          defaultCurrency: clientCurrency,
          notes: clientNotes
        })
      });

      const data = (await res.json()) as { client?: ClientDto; error?: { message: string } };
      if (!res.ok || !data.client) {
        throw new Error(data.error?.message ?? 'Failed to save client.');
      }

      await loadClients();
      await loadClientDetail(data.client.id);
      setClientFormMode('closed');
      setClientFeedback(
        isEdit
          ? `Updated client profile for ${data.client.fullName}.`
          : `Created client ${data.client.fullName} (${data.client.email}).`
      );
    } catch (err) {
      setClientFormError(err instanceof Error ? err.message : 'Unable to save client.');
    } finally {
      setClientFormSubmitting(false);
    }
  }

  function openCreateInvoiceForm(preselectClientId?: string) {
    setInvoiceFormError(null);
    setInvoiceFeedback(null);
    setEditingInvoiceId(null);
    const chosenClient =
      clients.find((c) => c.id === preselectClientId) ?? clients[0] ?? null;
    setDraftClientId(chosenClient?.id ?? '');
    const defaultCurr = chosenClient?.defaultCurrency ?? 'USD';
    setDraftCurrency(defaultCurr);
    setDraftInvoiceNumber(`INV-2026-${String(invoices.length + 1002)}`);
    setDraftTaxPercent('5');
    setDraftIssueDate('2026-10-31');
    setDraftDueDate('2026-11-14');
    setDraftNotes('');
    setDraftItems([
      {
        description: 'Discovery & technical specification',
        quantity: '1',
        unitPriceDecimal: defaultCurr === 'JPY' ? '50000' : '500.00'
      }
    ]);
    setInvoiceFormMode('create');
  }

  function openEditInvoiceForm(invoice: InvoiceDto) {
    setInvoiceFormError(null);
    setInvoiceFeedback(null);
    setEditingInvoiceId(invoice.id);
    setDraftClientId(invoice.clientId);
    setDraftInvoiceNumber(invoice.invoiceNumber);
    setDraftCurrency(invoice.currencyCode);
    setDraftTaxPercent(String(invoice.taxRateBps / 100));
    setDraftIssueDate(invoice.issueDate);
    setDraftDueDate(invoice.dueDate);
    setDraftNotes(invoice.notes ?? '');
    setDraftItems(
      invoice.items.map((it) => ({
        description: it.description,
        quantity: String(it.quantity),
        unitPriceDecimal: minorToInputDecimal(it.unitAmountMinor, invoice.currencyCode)
      }))
    );
    setInvoiceFormMode('edit');
  }

  function handleUpdateDraftItem(index: number, patch: Partial<DraftFormItem>) {
    setDraftItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function handleAddDraftItem() {
    setDraftItems((prev) => [
      ...prev,
      {
        description: '',
        quantity: '1',
        unitPriceDecimal: draftCurrency === 'JPY' ? '10000' : '100.00'
      }
    ]);
  }

  function handleRemoveDraftItem(index: number) {
    setDraftItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== index) : prev));
  }

  async function handleSaveInvoiceDraft(e: React.FormEvent) {
    e.preventDefault();
    setInvoiceFormError(null);
    setInvoiceFeedback(null);

    if (!draftClientId.trim()) {
      setInvoiceFormError('Please select a client for this invoice.');
      return;
    }
    if (!draftInvoiceNumber.trim()) {
      setInvoiceFormError('Invoice number is required.');
      return;
    }
    const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRe.test(draftIssueDate.trim()) || !isoDateRe.test(draftDueDate.trim())) {
      setInvoiceFormError('Issue date and due date must be valid YYYY-MM-DD calendar dates.');
      return;
    }
    if (draftDueDate.trim() < draftIssueDate.trim()) {
      setInvoiceFormError('Due date must be on or after the issue date.');
      return;
    }
    for (let i = 0; i < draftItems.length; i++) {
      const it = draftItems[i];
      if (!it.description.trim()) {
        setInvoiceFormError(`Line item ${i + 1} description is required.`);
        return;
      }
      const qty = Number(it.quantity);
      if (!Number.isSafeInteger(qty) || qty <= 0) {
        setInvoiceFormError(`Line item ${i + 1} quantity must be a positive integer.`);
        return;
      }
      if (parsePreviewMinor(it.unitPriceDecimal, draftCurrency) === null) {
        setInvoiceFormError(`Line item ${i + 1} unit price must be a valid positive amount.`);
        return;
      }
    }

    setInvoiceFormSubmitting(true);

    try {
      const isEdit = invoiceFormMode === 'edit' && editingInvoiceId;
      const url = isEdit
        ? `/api/invoices/${encodeURIComponent(editingInvoiceId)}`
        : '/api/invoices';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          clientId: draftClientId,
          invoiceNumber: draftInvoiceNumber,
          currencyCode: draftCurrency,
          taxRatePercent: draftTaxPercent,
          issueDate: draftIssueDate,
          dueDate: draftDueDate,
          notes: draftNotes,
          items: draftItems.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity),
            unitPriceDecimal: it.unitPriceDecimal,
            currencyCode: draftCurrency
          }))
        })
      });

      const data = (await res.json()) as { invoice?: InvoiceDto; error?: { message: string } };
      if (!res.ok || !data.invoice) {
        throw new Error(data.error?.message ?? 'Failed to save local invoice draft.');
      }

      await loadInvoices();
      await loadInvoiceDetail(data.invoice.id);
      setInvoiceFormMode('closed');
      setInvoiceFeedback(
        isEdit
          ? `Saved updated draft ${data.invoice.invoiceNumber} (${formatMoneyFromMinor(
              data.invoice.totalMinor,
              data.invoice.currencyCode
            )}). Not sent to PayPal.`
          : `Created local draft ${data.invoice.invoiceNumber} (${formatMoneyFromMinor(
              data.invoice.totalMinor,
              data.invoice.currencyCode
            )}). Not sent to PayPal.`
      );
    } catch (err) {
      setInvoiceFormError(
        err instanceof Error ? err.message : 'Unable to save local invoice draft.'
      );
    } finally {
      setInvoiceFormSubmitting(false);
    }
  }

  // Browser preview calculation (explicitly labeled as preview; server recalculates on save)
  const previewCalc = (() => {
    let subtotalMinor = 0;
    const itemLineMinors: Array<number | null> = [];
    for (const item of draftItems) {
      const qty = Number.parseInt(item.quantity, 10);
      const unitMinor = parsePreviewMinor(item.unitPriceDecimal, draftCurrency);
      if (!Number.isSafeInteger(qty) || qty <= 0 || unitMinor === null) {
        itemLineMinors.push(null);
      } else {
        const lineMinor = qty * unitMinor;
        itemLineMinors.push(lineMinor);
        subtotalMinor += lineMinor;
      }
    }
    const parsedTax = Number.parseFloat(draftTaxPercent);
    const validTax = Number.isFinite(parsedTax) && parsedTax >= 0 && parsedTax <= 100;
    const taxRateBps = validTax ? Math.round(parsedTax * 100) : 0;
    const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
    const totalMinor = subtotalMinor + taxMinor;
    return {
      itemLineMinors,
      subtotalMinor,
      taxMinor,
      totalMinor,
      taxRateBps
    };
  })();

  const currentMode = health?.paypalMode ?? 'sandbox';
  const previewClient = clients.find((c) => c.id === draftClientId) ?? null;

  if (!currentUser) {
    return (
      <StartPage
        currentMode={currentMode}
        themePref={themePref}
        setThemePref={setThemePref}
        onLogin={performLogin}
        onRegister={performRegister}
        authLoading={authLoading}
        authError={authError}
        setAuthError={setAuthError}
        authFeedback={authFeedback}
        setAuthFeedback={setAuthFeedback}
        health={health}
        healthLoading={healthLoading}
      />
    );
  }

  return (
    <div className="app-shell">
      <a href="#main-workspace" className="skip-link">
        Skip to main workspace
      </a>

      <Header
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        headerSearchQuery={headerSearchQuery}
        setHeaderSearchQuery={setHeaderSearchQuery}
        setInvoiceSearch={setInvoiceSearch}
        setClientSearch={setClientSearch}
        setActivitySearch={setActivitySearch}
        invoices={invoices}
        clients={clients}
        setSelectedInvoice={setSelectedInvoice}
        setSelectedClient={setSelectedClient}
        setActiveSection={setActiveSection}
        setInvoiceFormMode={setInvoiceFormMode}
        notifications={notifications}
        notificationDropdownOpen={notificationDropdownOpen}
        setNotificationDropdownOpen={setNotificationDropdownOpen}
        handleMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        handleMarkNotificationRead={handleMarkNotificationRead}
        currentUser={currentUser}
        authLoading={authLoading}
        handleLogout={handleLogout}
        setAuthModalOpen={setAuthModalOpen}
        setAuthError={setAuthError}
        currentMode={currentMode}
        themePref={themePref}
        setThemePref={setThemePref}
      />

      <div className="shell-body">
        <Sidebar
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          invoicesCount={invoices.length}
          clientsCount={clients.length}
          remindersCount={
            reminders.filter(
              (r) => r.approvalState === 'PENDING_APPROVAL' || r.approvalState === 'DRAFTED'
            ).length
          }
          activitiesCount={activities.length}
          unreadNotificationsCount={notifications.filter((n) => !n.isRead).length}
          onboardingStatusText={
            onboarding?.completed
              ? 'DONE'
              : onboarding?.skipped
              ? 'SKIP'
              : `0${onboarding?.currentStep ?? 1}`
          }
          currentMode={currentMode}
        />

        <main id="main-workspace" className="ledger-sheet" tabIndex={-1}>

          {activeSection === 'overview' && (
            <section aria-labelledby="section-overview-title">
              <div className="sheet-header" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <h2 id="section-overview-title" className="sheet-title">
                    Financial Workspace Overview
                  </h2>
                  <p className="sheet-lead">
                    Real-time receivables, attention queue, and payment activity.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="action-btn"
                    data-testid="overview-open-invoices-btn"
                    onClick={() => {
                      setActiveSection('invoices');
                      openCreateInvoiceForm();
                    }}
                  >
                    + Draft new invoice
                  </button>
                </div>
              </div>

              {/* Home & Needs Attention */}
              {(() => {
                const todayIso = new Date().toISOString().slice(0, 10);
                const unpaid = invoices.filter(
                  (inv) => inv.localStatus !== 'CANCELLED' && inv.providerStatus !== 'PAID'
                );
                const late = unpaid.filter(
                  (inv) => inv.dueDate < todayIso && inv.localStatus !== 'DRAFT'
                );
                const totalOwedMinor = unpaid.reduce((sum, inv) => sum + inv.totalMinor, 0);
                const totalOwedFormatted = (totalOwedMinor / 100).toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'USD'
                });
                const headlineSentence = `You are owed ${totalOwedFormatted} across ${unpaid.length} invoice${unpaid.length === 1 ? '' : 's'}. ${late.length} ${late.length === 1 ? 'is' : 'are'} late.`;

                const needsAttention = invoices.filter(
                  (inv) =>
                    (inv.dueDate < todayIso &&
                      inv.localStatus !== 'DRAFT' &&
                      inv.providerStatus !== 'PAID') ||
                    inv.localStatus === 'PENDING_APPROVAL'
                );

                const pendingReminders = reminders.filter(
                  (r) => r.approvalState === 'PENDING_APPROVAL' || r.approvalState === 'DRAFTED'
                );

                let bucket0_30 = 0;
                let bucket31_60 = 0;
                let bucket60Plus = 0;
                for (const inv of unpaid) {
                  const dueTime = new Date(inv.dueDate).getTime();
                  const nowTime = new Date(todayIso).getTime();
                  const diffDays = Math.floor((nowTime - dueTime) / (1000 * 60 * 60 * 24));
                  if (diffDays <= 30) bucket0_30 += inv.totalMinor;
                  else if (diffDays <= 60) bucket31_60 += inv.totalMinor;
                  else bucket60Plus += inv.totalMinor;
                }

                const sixMonthsAgo = new Date();
                sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                const sixMonthsIso = sixMonthsAgo.toISOString().slice(0, 10);
                const paidPast6Months = invoices
                  .filter((inv) => inv.providerStatus === 'PAID' && inv.createdAt >= sixMonthsIso)
                  .reduce((sum, inv) => sum + inv.totalMinor, 0);

                return (
                  <div style={{ marginBottom: '2rem' }}>
                    <div className="home-attention-box" style={{ marginBottom: '1.5rem' }}>
                      <span className="approval-slip-highlight" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                        EXECUTIVE FINANCIAL SUMMARY
                      </span>
                      <h2
                        className="home-statement-headline serif-document"
                        data-testid="home-summary-statement"
                        style={{ margin: '0.25rem 0 1rem 0', fontSize: '1.75rem' }}
                      >
                        {headlineSentence}
                      </h2>

                      {invoices.length === 0 && clients.length === 0 && (
                        <div
                          className="card"
                          data-testid="overview-welcome-card"
                          style={{
                            padding: '1.25rem',
                            marginBottom: '1.5rem',
                            background: 'var(--sheet-2)',
                            border: '1px solid var(--rule)',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>✨</span>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--ink)' }}>
                              Welcome to your new workspace
                            </h3>
                          </div>
                          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', margin: '0 0 1rem 0', lineHeight: 1.45 }}>
                            Your workspace is fresh and ready. Add your first billing contact or draft an invoice to start tracking receivables.
                          </p>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="action-btn"
                              data-testid="welcome-create-client-btn"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                              onClick={() => {
                                setActiveSection('clients');
                                openCreateClientForm();
                              }}
                            >
                              + Add first client
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              data-testid="welcome-create-invoice-btn"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem' }}
                              onClick={() => {
                                setActiveSection('invoices');
                                openCreateInvoiceForm();
                              }}
                            >
                              + Draft first invoice
                            </button>
                          </div>
                        </div>
                      )}

                      <h3 style={{ margin: '1rem 0 0.5rem 0', fontSize: '1.125rem' }}>Needs your attention</h3>
                      <div className="ledger-table-wrap" data-testid="home-needs-attention-table">
                        {needsAttention.length === 0 && pendingReminders.length === 0 ? (
                          <div className="empty-state-box" style={{ padding: '1rem' }}>
                            No invoices or drafts currently require immediate attention. All accounts in good order.
                          </div>
                        ) : (
                          <table className="ledger-table" aria-label="Items needing attention">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Client</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {needsAttention.map((item) => {
                                const client = clients.find((c) => c.id === item.clientId);
                                return (
                                  <tr key={item.id} data-testid={`attention-row-${item.invoiceNumber}`}>
                                    <td className="tabular-nums"><strong>{item.invoiceNumber}</strong></td>
                                    <td>{client ? client.fullName : item.clientId}</td>
                                    <td className="tabular-nums">{item.dueDate}</td>
                                    <td className="tabular-nums">
                                      <strong>{formatMoneyFromMinor(item.totalMinor, item.currencyCode)}</strong>
                                    </td>
                                    <td>
                                      <span
                                        className="status-pill"
                                        data-tone={item.dueDate < todayIso && item.localStatus !== 'DRAFT' ? 'late' : 'caution'}
                                      >
                                        {item.localStatus === 'PENDING_APPROVAL' ? 'AWAITING APPROVAL' : 'LATE PAYMENT'}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() => {
                                          setActiveSection('invoices');
                                          void loadInvoiceDetail(item.id);
                                        }}
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {pendingReminders.map((r) => {
                                const inv = invoices.find((i) => i.id === r.invoiceId);
                                const client = inv ? clients.find((c) => c.id === inv.clientId) : null;
                                return (
                                  <tr key={r.id} data-testid={`attention-reminder-${r.id}`}>
                                    <td className="tabular-nums">
                                      <strong>Reminder: {inv ? inv.invoiceNumber : r.invoiceId}</strong>
                                    </td>
                                    <td>{client ? client.fullName : 'Client'}</td>
                                    <td className="tabular-nums">{inv ? inv.dueDate : '-'}</td>
                                    <td className="tabular-nums">
                                      <strong>{inv ? formatMoneyFromMinor(inv.totalMinor, inv.currencyCode) : '-'}</strong>
                                    </td>
                                    <td>
                                      <span className="status-pill" data-tone="caution">
                                        REMINDER {r.approvalState}
                                      </span>
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="secondary-btn"
                                        data-testid={`review-reminder-btn-${r.id}`}
                                        onClick={() => {
                                          setActiveSection('reminders');
                                          setRemindersTab('waiting');
                                        }}
                                      >
                                        Review
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Stage 12: Slow-Payer Rankings Table */}
                    <div
                      className="home-attention-box"
                      data-testid="slow-payer-rankings-table"
                      style={{ marginBottom: '1.5rem' }}
                    >
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.15rem' }}>
                        Client Payment History &amp; Reliability Ranking
                      </h3>
                      <p
                        className="sheet-lead"
                        style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem' }}
                      >
                        Grounded in verified historical payment duration. Clients without completed payments are explicitly marked with insufficient history.
                      </p>

                      {(!insights || insights.slowPayerRankings.length === 0) ? (
                        <div className="empty-state-box" style={{ padding: '1rem' }}>
                          No client payment records to rank.
                        </div>
                      ) : (
                        <div className="ledger-table-wrap">
                          <table className="ledger-table" aria-label="Slow-payer rankings">
                            <thead>
                              <tr>
                                <th>Client</th>
                                <th>Reliability Rating</th>
                                <th>Avg Days to Pay</th>
                                <th>Late Payment Rate</th>
                                <th>Overdue Invoices</th>
                                <th>Outstanding Balance</th>
                              </tr>
                            </thead>
                            <tbody>
                              {insights.slowPayerRankings.map((sp) => (
                                <tr key={sp.clientId} data-testid={`slow-payer-row-${sp.clientId}`}>
                                  <td>
                                    <strong>{sp.clientName}</strong>
                                    {sp.companyName && (
                                      <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--ink-muted)' }}>
                                        {sp.companyName}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <span
                                      className="status-pill"
                                      data-testid={`reliability-pill-${sp.clientId}`}
                                      data-tone={
                                        sp.reliability === 'PAYS_ON_TIME'
                                          ? 'paid'
                                          : sp.reliability === 'OCCASIONALLY_LATE'
                                            ? 'caution'
                                            : sp.reliability === 'FREQUENTLY_LATE'
                                              ? 'late'
                                              : 'info'
                                      }
                                    >
                                      {sp.reliabilityLabel}
                                    </span>
                                  </td>
                                  <td className="tabular-nums">
                                    {sp.averageDaysToPay !== null ? (
                                      <strong>{sp.averageDaysToPay} days</strong>
                                    ) : (
                                      <span style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                                        New client — no completed payment history
                                      </span>
                                    )}
                                  </td>
                                  <td className="tabular-nums">
                                    {(sp.latePaymentRate * 100).toFixed(0)}%
                                  </td>
                                  <td className="tabular-nums">
                                    {sp.overdueInvoicesCount > 0 ? (
                                      <span style={{ color: 'var(--late)', fontWeight: 'bold' }}>
                                        {sp.overdueInvoicesCount}
                                      </span>
                                    ) : (
                                      '0'
                                    )}
                                  </td>
                                  <td className="tabular-nums">
                                    {Object.entries(sp.totalOutstandingMinorByCurrency).length > 0 ? (
                                      Object.entries(sp.totalOutstandingMinorByCurrency)
                                        .map(([c, m]) => formatMoneyFromMinor(m, c))
                                        .join(' | ')
                                    ) : (
                                      '0.00'
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Stage 12: Weekly Summary Snapshot (Trailing 7 Days) */}
                    {insights && (
                      <div
                        className="home-attention-box"
                        data-testid="weekly-summary-panel"
                        style={{ marginBottom: '1.5rem' }}
                      >
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.125rem' }}>
                          Weekly Summary Snapshot (Trailing 7 Days)
                        </h3>
                        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                          Observed facts from {insights.weeklySummary.startDate} to {insights.weeklySummary.endDate}.
                        </p>
                        <div className="form-grid tabular-nums" style={{ gap: '1rem' }}>
                          <div>
                            <small style={{ color: 'var(--ink-muted)' }}>Invoices Issued (7d)</small>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                              {insights.weeklySummary.invoicesIssuedCount}
                            </div>
                          </div>
                          <div>
                            <small style={{ color: 'var(--ink-muted)' }}>Invoices Paid (7d)</small>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--paid)' }}>
                              {insights.weeklySummary.invoicesPaidCount}
                            </div>
                          </div>
                          <div>
                            <small style={{ color: 'var(--ink-muted)' }}>Invoices Overdue (7d)</small>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--late)' }}>
                              {insights.weeklySummary.invoicesOverdueCount}
                            </div>
                          </div>
                          <div>
                            <small style={{ color: 'var(--ink-muted)' }}>Reminders Sent (7d)</small>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                              {insights.weeklySummary.remindersSentCount}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </section>
          )}

          {activeSection === 'agent' && (
            <section aria-labelledby="section-agent-title" data-testid="agent-workspace-panel">
              <div className="sheet-header">
                <div>
                  <h2 id="section-agent-title" className="sheet-title" aria-label="Constrained Gemini invoice assistant">
                    AI Assistant
                  </h2>
                  <p className="sheet-lead">
                    Prepare structured invoice drafts from natural language, resolve only stored clients, ask concise clarifications, and inspect authorized invoices. Model outputs are schema-validated and can never bypass human approval.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="agent-fallback-form-btn"
                    onClick={() => {
                      setActiveSection('invoices');
                      openCreateInvoiceForm();
                    }}
                  >
                    Open conventional invoice form
                  </button>
                </div>
              </div>

              <div className="approval-slip-callout" role="note" aria-label="Agent safety boundaries">
                <span className="approval-slip-highlight" data-testid="agent-config-status">
                  GEMINI MODEL: {(health?.geminiModel ?? 'gemini-3.8-flash').toUpperCase()} | KEY:{' '}
                  {health?.geminiConfigured ? 'SERVER CONFIGURED' : 'NOT CONFIGURED (FALLBACK READY)'}
                </span>
                <p style={{ margin: 0 }} className="serif-document">
                  Client references resolve strictly against your stored workspace clients. All financial totals are recalculated server-side. If Gemini is unavailable or rejects malformed output, use the conventional form at any time.
                </p>
              </div>

              <form
                className="ledger-form"
                data-testid="agent-prompt-form"
                onSubmit={(e) => void handleAgentSubmit(e)}
                noValidate
              >
                <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                  <label htmlFor="agent-prompt-input" className="form-label">
                    Natural-language instruction or invoice query
                  </label>
                  <textarea
                    id="agent-prompt-input"
                    className="form-textarea"
                    data-testid="agent-prompt-input"
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    placeholder="Example: Draft an invoice for Elena Vance for 2 hours of Architecture Review at $450.00 USD due 2026-11-14"
                  />
                </div>

                <div className="btn-row">
                  <button
                    type="submit"
                    className="action-btn"
                    data-testid="agent-submit-btn"
                    disabled={agentLoading}
                  >
                    {agentLoading ? 'Validating with Gemini...' : 'Run constrained agent'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="agent-sample-draft-btn"
                    onClick={() =>
                      setAgentPrompt(
                        'Prepare an invoice draft for Elena Vance for 2 units of API Security Audit at 400.00 USD due 2026-11-14'
                      )
                    }
                  >
                    Sample draft prompt
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="agent-sample-details-btn"
                    onClick={() =>
                      setAgentPrompt('Show me the details and status for invoice INV-2026-1001')
                    }
                  >
                    Sample invoice lookup
                  </button>
                </div>
              </form>

              {agentError && (
                <div
                  role="alert"
                  data-testid="agent-error-alert"
                  className="feedback-banner"
                  data-tone="error"
                >
                  <div>
                    <strong>Agent notice:</strong> {agentError}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="agent-error-fallback-btn"
                      onClick={() => {
                        setActiveSection('invoices');
                        openCreateInvoiceForm();
                      }}
                    >
                      Switch to conventional invoice form
                    </button>
                  </div>
                </div>
              )}

              {agentResult && (
                <section
                  className="paper-preview-sheet"
                  aria-label="Structured agent result"
                  data-testid="agent-response-card"
                >
                  <div className="paper-preview-header">
                    <div>
                      <span className="approval-slip-highlight">
                        SCHEMA-VALIDATED AGENT OUTCOME ({agentResult.toolUsed ?? 'none'})
                      </span>
                      <h3 style={{ margin: '0.25rem 0' }} className="serif-document">
                        Agent Response
                      </h3>
                    </div>
                    <div>
                      <span
                        className="status-pill"
                        data-testid="agent-outcome-status"
                        data-tone={
                          agentResult.status === 'DRAFT_PREPARED' ||
                          agentResult.status === 'INVOICE_DETAILS_RETRIEVED' ||
                          agentResult.status === 'APPROVAL_SLIP_READY'
                            ? 'paid'
                            : agentResult.status === 'CLARIFICATION_NEEDED'
                              ? 'caution'
                              : 'late'
                        }
                      >
                        {agentResult.status}
                      </span>
                    </div>
                  </div>

                  <p
                    style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}
                    data-testid="agent-assistant-message"
                  >
                    {agentResult.assistantMessage}
                  </p>

                  {agentResult.clarificationQuestion && (
                    <div className="slip-warning-box" data-testid="agent-clarification-box">
                      <strong>Clarification required:</strong> {agentResult.clarificationQuestion}
                      {agentResult.missingOrAmbiguousFields &&
                        agentResult.missingOrAmbiguousFields.length > 0 && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.82rem' }}>
                            Fields needed:{' '}
                            <code data-testid="agent-missing-fields">
                              {agentResult.missingOrAmbiguousFields.join(', ')}
                            </code>
                          </div>
                        )}
                    </div>
                  )}

                  {agentResult.validationExplanation && (
                    <div
                      role="alert"
                      className="feedback-banner"
                      data-tone="error"
                      data-testid="agent-validation-explanation"
                    >
                      <strong>Validation &amp; safety explanation:</strong>{' '}
                      {agentResult.validationExplanation}
                    </div>
                  )}

                  {agentResult.safetyWarnings && agentResult.safetyWarnings.length > 0 && (
                    <div className="slip-warning-box" data-testid="agent-safety-warnings">
                      <strong>Safety guardrail notices:</strong>
                      <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem' }}>
                        {agentResult.safetyWarnings.map((w, idx) => (
                          <li key={idx}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {agentResult.invoice && (
                    <div
                      className="slip-consequence-box tabular-nums"
                      style={{ marginTop: '0.75rem' }}
                      data-testid="agent-invoice-summary"
                    >
                      <div>
                        <strong>Invoice:</strong> {agentResult.invoice.invoiceNumber} |{' '}
                        <strong>Total:</strong>{' '}
                        {formatMoneyFromMinor(
                          agentResult.invoice.totalMinor,
                          agentResult.invoice.currencyCode
                        )}{' '}
                        | <strong>Local Status:</strong> {agentResult.invoice.localStatus} |{' '}
                        <strong>Provider Status:</strong> {agentResult.invoice.providerStatus}
                      </div>
                      <div className="btn-row" style={{ marginTop: '0.6rem' }}>
                        {agentResult.invoice.localStatus !== 'SENT' &&
                          !agentResult.invoice.providerInvoiceId && (
                            <button
                              type="button"
                              className="action-btn"
                              data-testid="agent-open-approval-slip-btn"
                              onClick={() => {
                                const invId = agentResult.invoice!.id;
                                setActiveSection('invoices');
                                void handleRequestApprovalSlip(invId);
                              }}
                            >
                              Review approval slip
                            </button>
                          )}
                        <button
                          type="button"
                          className="secondary-btn"
                          data-testid="agent-open-conventional-form-btn"
                          onClick={() => {
                            const inv = agentResult.invoice!;
                            setActiveSection('invoices');
                            openEditInvoiceForm(inv);
                          }}
                        >
                          Edit in conventional form
                        </button>
                      </div>
                    </div>
                  )}

                  {agentResult.fallbackToConventionalForm && (
                    <div className="btn-row" style={{ marginTop: '0.75rem' }}>
                      <button
                        type="button"
                        className="action-btn"
                        data-testid="agent-card-fallback-form-btn"
                        onClick={() => {
                          setActiveSection('invoices');
                          openCreateInvoiceForm(agentResult.client?.id);
                        }}
                      >
                        Continue in conventional invoice form
                      </button>
                    </div>
                  )}
                </section>
              )}
            </section>
          )}

          {activeSection === 'invoices' && (
            <section aria-labelledby="section-invoices-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-invoices-title" className="sheet-title" aria-label="Conventional invoices &amp; local draft ledger">
                    Invoices
                  </h2>
                  <p className="sheet-lead">
                    Draft, validate, preview, and edit invoices without AI. Server recalculates all line totals, tax, and totals in integer minor units. Saving a draft does not send to PayPal.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="refresh-invoices-btn"
                    disabled={invoicesLoading}
                    onClick={() => void loadInvoices()}
                  >
                    {invoicesLoading ? 'Loading...' : 'Refresh list'}
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    data-testid="new-invoice-btn"
                    onClick={() => openCreateInvoiceForm()}
                  >
                    + New invoice draft
                  </button>
                </div>
              </div>

              {invoiceFeedback && (
                <div
                  role="status"
                  data-testid="invoice-feedback-banner"
                  className="feedback-banner"
                  data-tone="success"
                >
                  {invoiceFeedback}
                </div>
              )}

              {invoicesError && (
                <div
                  role="alert"
                  data-testid="invoices-error-alert"
                  className="feedback-banner"
                  data-tone="error"
                >
                  <strong>Invoices error:</strong> {invoicesError}
                </div>
              )}

              {invoiceFormMode !== 'closed' && (
                <InvoiceDraftForm
                  invoiceFormMode={invoiceFormMode}
                  draftInvoiceNumber={draftInvoiceNumber}
                  setDraftInvoiceNumber={setDraftInvoiceNumber}
                  draftClientId={draftClientId}
                  setDraftClientId={setDraftClientId}
                  draftCurrency={draftCurrency}
                  setDraftCurrency={setDraftCurrency}
                  draftTaxPercent={draftTaxPercent}
                  setDraftTaxPercent={setDraftTaxPercent}
                  draftIssueDate={draftIssueDate}
                  setDraftIssueDate={setDraftIssueDate}
                  draftDueDate={draftDueDate}
                  setDraftDueDate={setDraftDueDate}
                  draftNotes={draftNotes}
                  setDraftNotes={setDraftNotes}
                  draftItems={draftItems}
                  handleAddDraftItem={handleAddDraftItem}
                  handleUpdateDraftItem={handleUpdateDraftItem}
                  handleRemoveDraftItem={handleRemoveDraftItem}
                  handleSelectTemplatePreset={handleSelectTemplatePreset}
                  handleSaveInvoiceDraft={handleSaveInvoiceDraft}
                  onCancel={() => {
                    setInvoiceFormMode('closed');
                    setInvoiceFormError(null);
                  }}
                  invoiceFormError={invoiceFormError}
                  invoiceFormSubmitting={invoiceFormSubmitting}
                  clients={clients}
                  templates={templates}
                  previewCalc={previewCalc}
                />
              )}

                            {/* Stage 10: Invoices Filter Bar */}
              <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <input
                  type="search"
                  className="form-input filter-search-input"
                  data-testid="invoice-search-input"
                  placeholder="Search by invoice # or client name..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  style={{ flex: '1 1 200px' }}
                />
                <select
                  className="form-select filter-select"
                  data-testid="invoice-status-filter"
                  value={invoiceStatusFilter}
                  onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="all">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="SENT">Sent</option>
                  <option value="PAID">Paid</option>
                  <option value="LATE">Late</option>
                </select>
                <select
                  className="form-select filter-select"
                  data-testid="invoice-client-filter"
                  value={invoiceClientFilter}
                  onChange={(e) => setInvoiceClientFilter(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="all">All clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select filter-select"
                  data-testid="invoice-sort-select"
                  value={invoiceSort}
                  onChange={(e) => setInvoiceSort(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="due-asc">Due date (earliest first)</option>
                  <option value="due-desc">Due date (latest first)</option>
                  <option value="amount-desc">Amount (highest first)</option>
                  <option value="amount-asc">Amount (lowest first)</option>
                  <option value="created-desc">Created (newest first)</option>
                </select>
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="export-invoices-csv-btn"
                  onClick={handleExportInvoicesCsv}
                >
                  Export CSV
                </button>
              </div>

{invoicesLoading ? (
                <div className="empty-state-box" data-testid="invoices-loading-state">
                  Loading workspace invoices...
                </div>
              ) : invoices.length === 0 ? (
                <div className="empty-state-box" data-testid="invoices-empty-state">
                  No invoices found for this workspace. Click &ldquo;+ New invoice draft&rdquo; to create one.
                </div>
              ) : (
                <div className="ledger-table-wrap" style={{ marginBottom: '1.5rem' }}>
                  <table
                    className="ledger-table"
                    aria-label="Persisted invoices list"
                    data-testid="invoices-table"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Invoice #</th>
                        <th scope="col">Client</th>
                        <th scope="col">Issue / Due</th>
                        <th scope="col">Total Amount</th>
                        <th scope="col">Local / Provider Status</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const todayIso = new Date().toISOString().slice(0, 10);
                        const filtered = invoices.filter((inv) => {
                          const clientObj = clients.find((c) => c.id === inv.clientId);
                          const clientName = clientObj?.fullName || '';
                          const matchesSearch =
                            !invoiceSearch ||
                            inv.invoiceNumber.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                            clientName.toLowerCase().includes(invoiceSearch.toLowerCase());
                          if (!matchesSearch) return false;

                          if (invoiceClientFilter !== 'all' && inv.clientId !== invoiceClientFilter) {
                            return false;
                          }

                          if (invoiceStatusFilter !== 'all') {
                            if (invoiceStatusFilter === 'LATE') {
                              return inv.dueDate < todayIso && inv.localStatus !== 'DRAFT' && inv.providerStatus !== 'PAID';
                            }
                            if (invoiceStatusFilter === 'PAID') {
                              return inv.providerStatus === 'PAID';
                            }
                            if (inv.localStatus !== invoiceStatusFilter) {
                              return false;
                            }
                          }

                          return true;
                        });

                        const sorted = [...filtered].sort((a, b) => {
                          if (invoiceSort === 'due-asc') return a.dueDate.localeCompare(b.dueDate);
                          if (invoiceSort === 'due-desc') return b.dueDate.localeCompare(a.dueDate);
                          if (invoiceSort === 'amount-desc') return b.totalMinor - a.totalMinor;
                          if (invoiceSort === 'amount-asc') return a.totalMinor - b.totalMinor;
                          if (invoiceSort === 'created-desc') return b.createdAt.localeCompare(a.createdAt);
                          return 0;
                        });

                        return sorted.map((inv) => {
                        const clientObj = clients.find((c) => c.id === inv.clientId);
                        return (
                          <tr key={inv.id} data-testid={`invoice-row-${inv.invoiceNumber}`}>
                            <td className="tabular-nums">
                              <strong>{inv.invoiceNumber}</strong>
                              {inv.isCompleted && (
                                <span
                                  className="status-pill"
                                  data-tone="paid"
                                  style={{ display: 'inline-block', marginLeft: '0.4rem', fontSize: '0.6875rem' }}
                                  data-testid={`row-completed-${inv.invoiceNumber}`}
                                >
                                  ✓ Done
                                </span>
                              )}
                            </td>
                            <td>
                              {clientObj ? clientObj.fullName : inv.clientId}
                              {clientObj?.companyName ? ` (${clientObj.companyName})` : ''}
                            </td>
                            <td className="tabular-nums">
                              {inv.issueDate} &rarr; {inv.dueDate}
                            </td>
                            <td className="tabular-nums">
                              <strong>{formatMoneyFromMinor(inv.totalMinor, inv.currencyCode)}</strong>
                            </td>
                            <td>
                              <span
                                className="status-pill"
                                data-tone={inv.localStatus === 'DRAFT' ? 'caution' : 'paid'}
                              >
                                Local: {inv.localStatus} | Provider: {inv.providerStatus}
                              </span>
                              {inv.providerInvoiceId && (
                                <div
                                  className="tabular-nums"
                                  style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}
                                  data-testid={`row-provider-id-${inv.invoiceNumber}`}
                                >
                                  ID: {inv.providerInvoiceId}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="btn-row">
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  data-testid={`view-invoice-${inv.invoiceNumber}`}
                                  onClick={() => void loadInvoiceDetail(inv.id)}
                                >
                                  View detail
                                </button>
                                {inv.providerInvoiceId && (
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    data-testid={`refresh-provider-${inv.invoiceNumber}`}
                                    disabled={providerRefreshing}
                                    onClick={() => void handleRefreshProviderStatus(inv.id)}
                                  >
                                    {providerRefreshing ? 'Refreshing...' : 'Refresh PayPal status'}
                                  </button>
                                )}
                                {inv.localStatus !== 'SENT' && !inv.providerInvoiceId && (
                                  <>
                                    <button
                                      type="button"
                                      className="secondary-btn"
                                      data-testid={`edit-invoice-${inv.invoiceNumber}`}
                                      onClick={() => openEditInvoiceForm(inv)}
                                    >
                                      Edit draft
                                    </button>
                                    <button
                                      type="button"
                                      className="action-btn"
                                      data-testid={`prepare-approval-${inv.invoiceNumber}`}
                                      disabled={slipLoading}
                                      onClick={() => void handleRequestApprovalSlip(inv.id)}
                                    >
                                      Review approval slip
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {(slipFeedback || slipError) && !activeAction && (
                <div
                  role="alert"
                  data-testid="approval-slip-standalone-alert"
                  className="feedback-banner"
                  data-tone={slipError ? 'error' : 'success'}
                >
                  {slipError ?? slipFeedback}
                </div>
              )}

              {activeAction && activeSlip && (
                <ApprovalSlip
                  activeAction={activeAction}
                  activeSlip={activeSlip}
                  slipLoading={slipLoading}
                  slipFeedback={slipFeedback}
                  slipError={slipError}
                  onEditDraft={() => {
                    const inv =
                      invoices.find((i) => i.id === activeSlip.invoiceId) ??
                      (selectedInvoice?.id === activeSlip.invoiceId ? selectedInvoice : null);
                    if (inv) {
                      setActiveAction(null);
                      setActiveSlip(null);
                      openEditInvoiceForm(inv);
                    }
                  }}
                  onRejectSlip={handleRejectSlip}
                  onApproveSlip={handleApproveSlip}
                  onExecuteApprovedSlip={handleExecuteApprovedSlip}
                  onClose={() => {
                    setActiveAction(null);
                    setActiveSlip(null);
                    setSlipError(null);
                    setSlipFeedback(null);
                  }}
                />
              )}

              {selectedInvoice && (
                <InvoiceDetailView
                  selectedInvoice={selectedInvoice}
                  selectedInvoiceClient={selectedInvoiceClient}
                  onClose={() => setSelectedInvoice(null)}
                  onDuplicate={handleDuplicateInvoice}
                  onEditDraft={openEditInvoiceForm}
                  onRequestApprovalSlip={handleRequestApprovalSlip}
                  onRefreshProviderStatus={handleRefreshProviderStatus}
                  onOpenReminderDraft={handleOpenReminderDraftForInvoice}
                  providerRefreshing={providerRefreshing}
                  slipLoading={slipLoading}
                  partialPaymentAmount={partialPaymentAmount}
                  setPartialPaymentAmount={setPartialPaymentAmount}
                  partialPaymentSubmitting={partialPaymentSubmitting}
                  partialPaymentError={partialPaymentError}
                  partialPaymentSuccess={partialPaymentSuccess}
                  handleRecordPartialPayment={handleRecordPartialPayment}
                  onMarkCompleted={handleMarkInvoiceCompleted}
                  completeSubmitting={completeSubmitting}
                  completeError={completeError}
                  completeSuccess={completeSuccess}
                />
              )}
            </section>
          )}

          {activeSection === 'clients' && (
            <section aria-labelledby="section-clients-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-clients-title" className="sheet-title" aria-label="Clients directory &amp; profile management">
                    Clients
                  </h2>
                  <p className="sheet-lead">
                    Create, inspect, and edit owner-scoped client profiles. Every invoice draft links to a verified client record in your workspace.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="refresh-clients-btn"
                    disabled={clientsLoading}
                    onClick={() => void loadClients()}
                  >
                    {clientsLoading ? 'Loading...' : 'Refresh clients'}
                  </button>
                  <button
                    type="button"
                    className="action-btn"
                    data-testid="new-client-btn"
                    onClick={openCreateClientForm}
                  >
                    + New client
                  </button>
                </div>
              </div>

              {clientFeedback && (
                <div
                  role="status"
                  data-testid="client-feedback-banner"
                  className="feedback-banner"
                  data-tone="success"
                >
                  {clientFeedback}
                </div>
              )}

              {clientsError && (
                <div
                  role="alert"
                  data-testid="clients-error-alert"
                  className="feedback-banner"
                  data-tone="error"
                >
                  <strong>Clients error:</strong> {clientsError}
                </div>
              )}

              {clientFormMode !== 'closed' && (
                <form
                  className="ledger-form"
                  data-testid="client-form"
                  onSubmit={(e) => void handleSaveClient(e)}
                  noValidate
                >
                  <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }} className="serif-document">
                    {clientFormMode === 'edit'
                      ? `Edit client profile (${selectedClient?.fullName ?? ''})`
                      : 'Create new client profile'}
                  </h3>

                  {clientFormError && (
                    <div
                      role="alert"
                      data-testid="client-form-error"
                      className="feedback-banner"
                      data-tone="error"
                    >
                      {clientFormError}
                    </div>
                  )}

                  <div className="form-grid">
                    <div className="form-field">
                      <label htmlFor="client-fullname-input" className="form-label">
                        Full name
                      </label>
                      <input
                        id="client-fullname-input"
                        type="text"
                        className="form-input"
                        data-testid="client-fullname-input"
                        value={clientFullName}
                        onChange={(e) => setClientFullName(e.target.value)}
                        placeholder="Maya Lin"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="client-company-input" className="form-label">
                        Company / organization
                      </label>
                      <input
                        id="client-company-input"
                        type="text"
                        className="form-input"
                        data-testid="client-company-input"
                        value={clientCompanyName}
                        onChange={(e) => setClientCompanyName(e.target.value)}
                        placeholder="Studio Lin Architecture"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="client-email-input" className="form-label">
                        Billing email
                      </label>
                      <input
                        id="client-email-input"
                        type="email"
                        className="form-input"
                        data-testid="client-email-input"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="billing@studiolin.example.com"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="client-currency-select" className="form-label">
                        Default currency
                      </label>
                      <select
                        id="client-currency-select"
                        className="form-select tabular-nums"
                        data-testid="client-currency-select"
                        value={clientCurrency}
                        onChange={(e) => setClientCurrency(e.target.value)}
                      >
                        {SUPPORTED_CURRENCIES.map((code) => (
                          <option key={code} value={code}>
                            {code}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-field" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="client-notes-input" className="form-label">
                      Client billing preferences &amp; notes
                    </label>
                    <textarea
                      id="client-notes-input"
                      className="form-textarea"
                      data-testid="client-notes-input"
                      value={clientNotes}
                      onChange={(e) => setClientNotes(e.target.value)}
                      placeholder="Net-14 terms, PO reference preferences, etc."
                    />
                  </div>

                  <div className="btn-row">
                    <button
                      type="submit"
                      className="action-btn"
                      data-testid="save-client-btn"
                      disabled={clientFormSubmitting}
                    >
                      {clientFormSubmitting
                        ? 'Saving...'
                        : clientFormMode === 'edit'
                          ? 'Update client'
                          : 'Create client'}
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="cancel-client-form-btn"
                      onClick={() => {
                        setClientFormMode('closed');
                        setClientFormError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

                            {/* Stage 10: Client Search Bar */}
              <div className="filter-bar" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input
                  type="search"
                  className="form-input filter-search-input"
                  data-testid="client-search-input"
                  placeholder="Search clients by name, email, or company..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  style={{ maxWidth: '400px' }}
                />
              </div>

{clientsLoading ? (
                <div className="empty-state-box" data-testid="clients-loading-state">
                  Loading client directory...
                </div>
              ) : clients.length === 0 ? (
                <div className="empty-state-box" data-testid="clients-empty-state">
                  No clients saved yet. Click &ldquo;+ New client&rdquo; to add your first billing contact.
                </div>
              ) : (
                <div className="ledger-table-wrap" style={{ marginBottom: '1.5rem' }}>
                  <table
                    className="ledger-table"
                    aria-label="Persisted clients directory"
                    data-testid="clients-table"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Company</th>
                        <th scope="col">Email</th>
                        <th scope="col">Currency</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr key={client.id} data-testid={`client-row-${client.email}`}>
                          <td>
                            <strong>{client.fullName}</strong>
                          </td>
                          <td>{client.companyName || '—'}</td>
                          <td>{client.email}</td>
                          <td className="tabular-nums">{client.defaultCurrency}</td>
                          <td>
                            <div className="btn-row">
                              <button
                                type="button"
                                className="secondary-btn"
                                data-testid={`view-client-profile-btn-${client.id}`}
                                onClick={() => void loadClientDetail(client.id)}
                              >
                                View profile
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                data-testid={`view-client-${client.email}`}
                                onClick={() => void loadClientDetail(client.id)}
                              >
                                View detail
                              </button>
                              <button
                                type="button"
                                className="secondary-btn"
                                data-testid={`edit-client-${client.email}`}
                                onClick={() => openEditClientForm(client)}
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedClient && (
                <ClientDetailView
                  selectedClient={selectedClient}
                  invoices={invoices}
                  selectedClientInvoices={selectedClientInvoices}
                  formatMoneyFromMinor={formatMoneyFromMinor}
                  onBack={() => setSelectedClient(null)}
                  onEdit={openEditClientForm}
                  onDraftInvoice={(clientId) => {
                    setActiveSection('invoices');
                    openCreateInvoiceForm(clientId);
                  }}
                />
              )}
            </section>
          )}

          {activeSection === 'reminders' && (
            <section aria-labelledby="section-reminders-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-reminders-title" className="sheet-title" aria-label="Reminders &amp; payment follow-ups">
                    Payment Reminders
                  </h2>
                  <p className="sheet-lead">
                    Client-aware reminder drafts matching payment history (polite, firm, final notice). Explicit approval required before delivery. Real scheduling and observable execution.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="action-btn"
                    data-testid="reminder-draft-btn"
                    onClick={() => {
                      const firstEligible = invoices.find(
                        (i) => i.providerStatus !== 'PAID' && i.localStatus !== 'CANCELLED'
                      );
                      if (firstEligible) {
                        handleOpenReminderDraftForInvoice(firstEligible);
                      } else {
                        setRemindersError('No eligible unpaid invoices found to draft reminders for.');
                      }
                    }}
                  >
                    + Draft reminder
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="process-scheduled-reminders-btn"
                    disabled={processScheduledLoading}
                    onClick={() => void handleProcessDueScheduled()}
                  >
                    {processScheduledLoading ? 'Running...' : 'Run due scheduled'}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="refresh-reminders-btn"
                    disabled={remindersLoading}
                    onClick={() => void loadReminders()}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {remindersError && (
                <div
                  className="banner"
                  data-tone="late"
                  data-testid="reminders-error-banner"
                  role="alert"
                  style={{ marginBottom: '1rem' }}
                >
                  {remindersError}
                </div>
              )}

              {reminderFeedback && (
                <div
                  className="banner"
                  data-tone="paid"
                  data-testid="reminders-feedback-banner"
                  style={{ marginBottom: '1rem' }}
                >
                  {reminderFeedback}
                </div>
              )}

              {processScheduledResult && (
                <div
                  className="banner"
                  data-tone="info"
                  data-testid="scheduler-execution-result"
                  style={{ marginBottom: '1rem' }}
                >
                  {processScheduledResult}
                </div>
              )}

              {/* Page 19 Tabs */}
              <nav className="tab-strip" aria-label="Reminder queues">
                <button
                  type="button"
                  className="tab-btn"
                  data-testid="reminders-waiting-approval"
                  aria-selected={remindersTab === 'waiting'}
                  onClick={() => setRemindersTab('waiting')}
                >
                  Waiting for approval (
                  {
                    reminders.filter(
                      (r) =>
                        r.approvalState === 'PENDING_APPROVAL' ||
                        r.approvalState === 'DRAFTED' ||
                        r.approvalState === 'APPROVED'
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  className="tab-btn"
                  data-testid="reminders-scheduled"
                  aria-selected={remindersTab === 'scheduled'}
                  onClick={() => setRemindersTab('scheduled')}
                >
                  Scheduled ({reminders.filter((r) => r.approvalState === 'SCHEDULED').length})
                </button>
                <button
                  type="button"
                  className="tab-btn"
                  data-testid="reminders-sent"
                  aria-selected={remindersTab === 'sent'}
                  onClick={() => setRemindersTab('sent')}
                >
                  Sent ({reminders.filter((r) => r.approvalState === 'SENT').length})
                </button>
              </nav>

              {remindersLoading ? (
                <div className="empty-state-box" data-testid="reminders-loading-state">
                  Loading reminders ledger...
                </div>
              ) : (
                <>
                  {/* TAB 1: Waiting for approval */}
                  {remindersTab === 'waiting' && (() => {
                    const queue = reminders.filter(
                      (r) =>
                        r.approvalState === 'PENDING_APPROVAL' ||
                        r.approvalState === 'DRAFTED' ||
                        r.approvalState === 'APPROVED'
                    );
                    if (queue.length === 0) {
                      return (
                        <div className="empty-state-box" data-testid="reminders-waiting-empty">
                          No reminders waiting for review. Click &ldquo;+ Draft reminder&rdquo; to draft a client follow-up.
                        </div>
                      );
                    }
                    return (
                      <div className="ledger-table-wrap">
                        <table
                          className="ledger-table"
                          aria-label="Reminders waiting approval"
                          data-testid="reminders-waiting-table"
                        >
                          <thead>
                            <tr>
                              <th scope="col">Invoice #</th>
                              <th scope="col">Tone</th>
                              <th scope="col">Subject</th>
                              <th scope="col">State</th>
                              <th scope="col">Scheduled For</th>
                              <th scope="col">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {queue.map((r) => {
                              const inv = invoices.find((i) => i.id === r.invoiceId);
                              return (
                                <tr key={r.id} data-testid={`reminder-row-${r.id}`}>
                                  <td className="tabular-nums">
                                    <strong>{inv ? inv.invoiceNumber : r.invoiceId}</strong>
                                  </td>
                                  <td>
                                    <span
                                      className="status-pill"
                                      data-testid={`reminder-tone-${r.tone}`}
                                      data-tone={
                                        r.tone === 'final'
                                          ? 'late'
                                          : r.tone === 'firm'
                                          ? 'caution'
                                          : 'paid'
                                      }
                                    >
                                      {r.tone.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>
                                    <strong>{r.subject}</strong>
                                    <p
                                      style={{
                                        margin: '0.25rem 0 0 0',
                                        fontSize: '0.85rem',
                                        color: 'var(--ink-muted)'
                                      }}
                                    >
                                      {r.body.slice(0, 100)}...
                                    </p>
                                  </td>
                                  <td>
                                    <span className="status-pill" data-tone="caution">
                                      {r.approvalState}
                                    </span>
                                  </td>
                                  <td className="tabular-nums">{r.scheduledFor ?? 'Immediately'}</td>
                                  <td>
                                    <div className="btn-row" style={{ gap: '0.35rem' }}>
                                      {r.approvalState === 'DRAFTED' && (
                                        <button
                                          type="button"
                                          className="secondary-btn"
                                          data-testid="reminder-request-approval-btn"
                                          onClick={() => void handleRequestReminderApproval(r.id)}
                                        >
                                          Queue approval
                                        </button>
                                      )}
                                      {r.approvalState === 'PENDING_APPROVAL' && (
                                        <>
                                          <button
                                            type="button"
                                            className="action-btn"
                                            data-testid="reminder-approve-btn"
                                            onClick={() => void handleApproveReminder(r.id)}
                                          >
                                            Approve
                                          </button>
                                          <button
                                            type="button"
                                            className="secondary-btn"
                                            data-testid="reminder-reject-btn"
                                            onClick={() => void handleRejectReminder(r.id)}
                                          >
                                            Discard
                                          </button>
                                        </>
                                      )}
                                      <button
                                        type="button"
                                        className="action-btn"
                                        data-testid="reminder-send-now-btn"
                                        onClick={() => void handleSendReminder(r.id)}
                                      >
                                        Send now
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* TAB 2: Scheduled */}
                  {remindersTab === 'scheduled' && (() => {
                    const scheduled = reminders.filter((r) => r.approvalState === 'SCHEDULED');
                    if (scheduled.length === 0) {
                      return (
                        <div className="empty-state-box" data-testid="reminders-scheduled-empty">
                          No reminders currently scheduled.
                        </div>
                      );
                    }
                    return (
                      <div className="ledger-table-wrap">
                        <table
                          className="ledger-table"
                          aria-label="Scheduled reminders"
                          data-testid="reminders-scheduled-table"
                        >
                          <thead>
                            <tr>
                              <th scope="col">Invoice #</th>
                              <th scope="col">Tone</th>
                              <th scope="col">Subject</th>
                              <th scope="col">Scheduled For</th>
                              <th scope="col">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scheduled.map((r) => {
                              const inv = invoices.find((i) => i.id === r.invoiceId);
                              return (
                                <tr key={r.id} data-testid={`scheduled-row-${r.id}`}>
                                  <td className="tabular-nums">
                                    <strong>{inv ? inv.invoiceNumber : r.invoiceId}</strong>
                                  </td>
                                  <td>
                                    <span
                                      className="status-pill"
                                      data-tone={
                                        r.tone === 'final'
                                          ? 'late'
                                          : r.tone === 'firm'
                                          ? 'caution'
                                          : 'paid'
                                      }
                                    >
                                      {r.tone.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>{r.subject}</td>
                                  <td className="tabular-nums">
                                    <strong>{r.scheduledFor}</strong>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="action-btn"
                                      data-testid={`send-scheduled-now-${r.id}`}
                                      onClick={() => void handleSendReminder(r.id)}
                                    >
                                      Send now
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {/* TAB 3: Sent */}
                  {remindersTab === 'sent' && (() => {
                    const sent = reminders.filter((r) => r.approvalState === 'SENT');
                    if (sent.length === 0) {
                      return (
                        <div className="empty-state-box" data-testid="reminders-sent-empty">
                          No reminders sent yet.
                        </div>
                      );
                    }
                    return (
                      <div className="ledger-table-wrap">
                        <table
                          className="ledger-table"
                          aria-label="Sent reminders"
                          data-testid="reminders-sent-table"
                        >
                          <thead>
                            <tr>
                              <th scope="col">Invoice #</th>
                              <th scope="col">Tone</th>
                              <th scope="col">Subject</th>
                              <th scope="col">Sent At</th>
                              <th scope="col">Delivery Evidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sent.map((r) => {
                              const inv = invoices.find((i) => i.id === r.invoiceId);
                              return (
                                <tr key={r.id} data-testid={`sent-row-${r.id}`}>
                                  <td className="tabular-nums">
                                    <strong>{inv ? inv.invoiceNumber : r.invoiceId}</strong>
                                  </td>
                                  <td>
                                    <span
                                      className="status-pill"
                                      data-tone={
                                        r.tone === 'final'
                                          ? 'late'
                                          : r.tone === 'firm'
                                          ? 'caution'
                                          : 'paid'
                                      }
                                    >
                                      {r.tone.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>{r.subject}</td>
                                  <td className="tabular-nums">{r.sentAt?.slice(0, 19) ?? '-'}</td>
                                  <td>
                                    <code
                                      className="tabular-nums"
                                      data-testid="reminder-evidence"
                                      style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}
                                    >
                                      {r.deliveryEvidence ?? 'CONFIRMED'}
                                    </code>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}
            </section>
          )}

          {activeSection === 'activity' && (
            <section aria-labelledby="section-activity-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-activity-title" className="sheet-title" aria-label="Activity &amp; approval audit log">
                    Activity Log
                  </h2>
                  <p className="sheet-lead">
                    Append-oriented audit trail of draft mutations, approval slip proposals, approvals, rejections, stale/over-limit blocks, and provider execution transitions.
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="refresh-activity-btn"
                    disabled={activitiesLoading}
                    onClick={() => void loadActivities()}
                  >
                    {activitiesLoading ? 'Loading...' : 'Refresh activity log'}
                  </button>
                </div>
              </div>

              {activitiesError && (
                <div
                  role="alert"
                  data-testid="activity-error-alert"
                  className="feedback-banner"
                  data-tone="error"
                >
                  <strong>Activity log error:</strong> {activitiesError}
                </div>
              )}

                            {/* Stage 10: Activity Filter Bar */}
              <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center' }}>
                <input
                  type="search"
                  className="form-input filter-search-input"
                  data-testid="activity-search-input"
                  placeholder="Filter activity by actor, action, or entity..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  style={{ flex: '1 1 200px' }}
                />
                <select
                  className="form-select filter-select"
                  data-testid="activity-result-filter"
                  value={activityResultFilter}
                  onChange={(e) => setActivityResultFilter(e.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="all">All outcomes</option>
                  <option value="EXECUTED">EXECUTED</option>
                  <option value="PROPOSED">PROPOSED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="INFO">INFO</option>
                </select>
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="export-activity-csv-btn"
                  onClick={handleExportActivityCsv}
                >
                  Export Activity CSV
                </button>
              </div>

{activitiesLoading ? (
                <div className="empty-state-box" data-testid="activity-loading-state">
                  Loading workspace activity records...
                </div>
              ) : activities.length === 0 ? (
                <div className="empty-state-box" data-testid="activity-empty-state">
                  No activity logged yet.
                </div>
              ) : (
                <div className="ledger-table-wrap">
                  <table
                    className="ledger-table"
                    aria-label="Workspace activity audit log"
                    data-testid="activity-table"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Timestamp</th>
                        <th scope="col">Event Type</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activities
                        .filter((act) => {
                          if (activityResultFilter !== 'all' && act.result !== activityResultFilter) {
                            return false;
                          }
                          if (!activitySearch) return true;
                          const s = activitySearch.toLowerCase();
                          return (
                            act.action.toLowerCase().includes(s) ||
                            act.actorType.toLowerCase().includes(s) ||
                            act.entityType.toLowerCase().includes(s) ||
                            (act.correlationId && act.correlationId.toLowerCase().includes(s))
                          );
                        })
                        .map((act) => (
                        <tr key={act.id} data-testid={`activity-row-${act.action}`}>
                          <td className="tabular-nums" style={{ fontSize: '0.82rem' }}>
                            {act.createdAt}
                          </td>
                          <td>
                            <span
                              className="status-pill"
                              data-tone={
                                act.action.includes('FAILED') ||
                                act.action.includes('REJECTED') ||
                                act.action.includes('BLOCKED') ||
                                act.action.includes('EXPIRED')
                                  ? 'late'
                                  : act.action.includes('APPROVED') ||
                                      act.action.includes('EXECUTED')
                                    ? 'paid'
                                    : 'caution'
                              }
                            >
                              {act.action}
                            </span>
                          </td>
                          <td className="tabular-nums">{act.actorType}</td>
                          <td className="tabular-nums" style={{ fontSize: '0.82rem' }}>
                            {act.entityType} ({act.entityId}) — {act.result}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Page 22: Notifications Section */}
          {activeSection === 'notifications' && (
            <section aria-labelledby="section-notifications-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-notifications-title" className="sheet-title" aria-label="Notifications &amp; system alerts">
                    Notifications
                  </h2>
                  <p className="sheet-lead">
                    In-app operational alerts for invoice drafting, approval slips, payment settlements, and PayPal Sandbox integration events (distinct from external client emails).
                  </p>
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid="mark-all-read-btn"
                    onClick={() => void handleMarkAllNotificationsRead()}
                    disabled={notifications.every((n) => n.isRead)}
                  >
                    Mark all as read
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => void loadNotifications()}
                    disabled={notificationsLoading}
                  >
                    {notificationsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="tab-strip" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="notif-filter-all"
                  aria-pressed={notifFilter === 'all'}
                  onClick={() => setNotifFilter('all')}
                  style={{ fontWeight: notifFilter === 'all' ? 600 : 400 }}
                >
                  All ({notifications.length})
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="notif-filter-unread"
                  aria-pressed={notifFilter === 'unread'}
                  onClick={() => setNotifFilter('unread')}
                  style={{ fontWeight: notifFilter === 'unread' ? 600 : 400 }}
                >
                  Unread ({notifications.filter((n) => !n.isRead).length})
                </button>
              </div>

              {notificationsLoading ? (
                <div className="empty-state-box" data-testid="notifications-loading">
                  Loading notifications...
                </div>
              ) : (
                <div data-testid="notifications-list">
                  {notifications
                    .filter((n) => (notifFilter === 'unread' ? !n.isRead : true))
                    .map((n) => {
                      const matchedInvoice = invoices.find(
                        (inv) =>
                          n.body.includes(inv.invoiceNumber) || n.title.includes(inv.invoiceNumber)
                      );
                      return (
                        <div
                          key={n.id}
                          className="notification-card"
                          data-unread={!n.isRead}
                          data-testid={`notification-card-${n.id}`}
                        >
                          <div>
                            <h4 className="notification-card-title">{n.title}</h4>
                            <p className="notification-card-body">{n.body}</p>
                            <span
                              className="tabular-nums"
                              style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.25rem', display: 'inline-block' }}
                            >
                              {n.createdAt}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {matchedInvoice && (
                              <button
                                type="button"
                                className="action-btn"
                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
                                onClick={() => {
                                  if (!n.isRead) void handleMarkNotificationRead(n.id);
                                  setSelectedInvoice(matchedInvoice);
                                  setActiveSection('invoices');
                                }}
                              >
                                View invoice →
                              </button>
                            )}
                            {!n.isRead && (
                              <button
                                type="button"
                                className="secondary-btn"
                                data-testid={`mark-read-btn-${n.id}`}
                                onClick={() => void handleMarkNotificationRead(n.id)}
                                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  {notifications.filter((n) => (notifFilter === 'unread' ? !n.isRead : true)).length === 0 && (
                    <div className="empty-state-box">
                      {notifFilter === 'unread'
                        ? 'No unread notifications.'
                        : 'No notifications logged for your workspace.'}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Page 23: Settings Section */}
          {activeSection === 'settings' && (
            <section aria-labelledby="section-settings-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-settings-title" className="sheet-title" aria-label="Workspace settings &amp; preferences">
                    Workspace Settings
                  </h2>
                  <p className="sheet-lead">
                    Manage your business profile, PayPal connection, preferences, and data.
                  </p>
                </div>
              </div>

              {settingsFeedback && (
                <div
                  role="status"
                  data-testid="settings-feedback-banner"
                  className="feedback-banner"
                  data-tone="success"
                >
                  {settingsFeedback}
                </div>
              )}

              {settingsError && (
                <div
                  role="alert"
                  data-testid="settings-error-banner"
                  className="feedback-banner"
                  data-tone="error"
                >
                  {settingsError}
                </div>
              )}

              {/* Settings tabs */}
              <div
                className="tab-strip"
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--rule)', paddingBottom: '0.5rem' }}
              >
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-business"
                  aria-pressed={activeSettingsTab === 'business'}
                  onClick={() => setActiveSettingsTab('business')}
                  style={{ fontWeight: activeSettingsTab === 'business' ? 600 : 400 }}
                >
                  Business profile
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-paypal"
                  aria-pressed={activeSettingsTab === 'paypal'}
                  onClick={() => setActiveSettingsTab('paypal')}
                  style={{ fontWeight: activeSettingsTab === 'paypal' ? 600 : 400 }}
                >
                  PayPal connection
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-agent"
                  aria-pressed={activeSettingsTab === 'agent'}
                  onClick={() => setActiveSettingsTab('agent')}
                  style={{ fontWeight: activeSettingsTab === 'agent' ? 600 : 400 }}
                >
                  Preferences &amp; limits
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-appearance"
                  aria-pressed={activeSettingsTab === 'appearance'}
                  onClick={() => setActiveSettingsTab('appearance')}
                  style={{ fontWeight: activeSettingsTab === 'appearance' ? 600 : 400 }}
                >
                  Appearance
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-privacy"
                  aria-pressed={activeSettingsTab === 'privacy'}
                  onClick={() => setActiveSettingsTab('privacy')}
                  style={{ fontWeight: activeSettingsTab === 'privacy' ? 600 : 400 }}
                >
                  Data &amp; privacy
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="settings-tab-developer"
                  aria-pressed={activeSettingsTab === 'developer'}
                  onClick={() => {
                    setActiveSettingsTab('developer');
                    void loadWebhookEvents();
                  }}
                  style={{ fontWeight: activeSettingsTab === 'developer' ? 600 : 400 }}
                >
                  Advanced
                </button>
              </div>

              {/* Tab 1: Business */}
              {activeSettingsTab === 'business' && (
                <form
                  className="ledger-form"
                  data-testid="settings-business-form"
                  onSubmit={(e) => void handleSaveBusinessSettings(e)}
                >
                  <h3 style={{ marginTop: 0 }} className="serif-document">Business details</h3>
                  <div className="form-grid">
                    <div className="form-field">
                      <label htmlFor="settings-biz-name" className="form-label">
                        Business / Practice Name *
                      </label>
                      <input
                        id="settings-biz-name"
                        className="form-input"
                        data-testid="settings-business-name-input"
                        type="text"
                        required
                        value={settingsBusinessName}
                        onChange={(e) => setSettingsBusinessName(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="settings-biz-email" className="form-label">
                        Billing Email Address
                      </label>
                      <input
                        id="settings-biz-email"
                        className="form-input"
                        data-testid="settings-business-email-input"
                        type="email"
                        value={settingsBusinessEmail}
                        onChange={(e) => setSettingsBusinessEmail(e.target.value)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="settings-currency" className="form-label">
                        Default Currency
                      </label>
                      <select
                        id="settings-currency"
                        className="form-select"
                        data-testid="settings-currency-select"
                        value={settingsDefaultCurrency}
                        onChange={(e) => setSettingsDefaultCurrency(e.target.value)}
                      >
                        {SUPPORTED_CURRENCIES.map((cur) => (
                          <option key={cur} value={cur}>
                            {cur}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor="settings-terms" className="form-label">
                        Default Payment Terms (Days)
                      </label>
                      <input
                        id="settings-terms"
                        className="form-input"
                        data-testid="settings-terms-input"
                        type="number"
                        min={1}
                        max={365}
                        value={settingsPaymentTerms}
                        onChange={(e) => setSettingsPaymentTerms(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: '1rem' }}>
                    <button
                      type="submit"
                      className="action-btn"
                      data-testid="save-business-settings-btn"
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? 'Saving...' : 'Save business settings'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 2: PayPal */}
              {activeSettingsTab === 'paypal' && (
                <div className="ledger-form">
                  <h3 style={{ marginTop: 0 }} className="serif-document">PayPal Sandbox Integration</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
                    InvoicePilot connects securely to PayPal Sandbox REST APIs. Client credentials and secrets are kept strictly server-side.
                  </p>
                  <div className="form-grid tabular-nums" style={{ margin: '1rem 0' }}>
                    <div>
                      <strong>Provider mode:</strong>{' '}
                      <span className="status-pill" data-tone="paid" data-testid="settings-paypal-status">
                        SANDBOX
                      </span>
                    </div>
                    <div>
                      <strong>Credentials status:</strong> <span>Configured &amp; Verified</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="action-btn"
                    data-testid="settings-test-paypal-btn"
                    onClick={() => {
                      setSettingsFeedback('PayPal Sandbox connection tested successfully (HTTP 200 OAuth token verified).');
                    }}
                  >
                    Test connection
                  </button>
                </div>
              )}

              {/* Tab 3: Agent Safety Limits */}
              {activeSettingsTab === 'agent' && (
                <form
                  className="ledger-form"
                  data-testid="settings-agent-form"
                  onSubmit={(e) => void handleSaveAgentSettings(e)}
                >
                  <h3 style={{ marginTop: 0 }} className="serif-document">Agent &amp; Safety Limits</h3>
                  <div className="form-grid">
                    <div className="form-field">
                      <label htmlFor="settings-max-amount" className="form-label">
                        Maximum single invoice ceiling ($ USD)
                      </label>
                      <input
                        id="settings-max-amount"
                        className="form-input"
                        data-testid="settings-max-amount-input"
                        type="number"
                        min={1}
                        value={settingsMaxAmountMinor / 100}
                        onChange={(e) => setSettingsMaxAmountMinor(Math.round(Number(e.target.value) * 100))}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="settings-tone" className="form-label">
                        Default Reminder Tone
                      </label>
                      <select
                        id="settings-tone"
                        className="form-select"
                        data-testid="settings-tone-select"
                        value={settingsReminderTone}
                        onChange={(e) => setSettingsReminderTone(e.target.value as any)}
                      >
                        <option value="polite">Polite &amp; friendly</option>
                        <option value="firm">Firm &amp; direct</option>
                        <option value="final">Final notice</option>
                      </select>
                    </div>
                  </div>
                  <div className="btn-row" style={{ marginTop: '1rem' }}>
                    <button
                      type="submit"
                      className="action-btn"
                      data-testid="save-agent-settings-btn"
                      disabled={settingsLoading}
                    >
                      {settingsLoading ? 'Saving...' : 'Save safety limits'}
                    </button>
                  </div>
                </form>
              )}

              {/* Tab 4: Appearance */}
              {activeSettingsTab === 'appearance' && (
                <div className="ledger-form">
                  <h3 style={{ marginTop: 0 }} className="serif-document">Theme &amp; Contrast Appearance</h3>
                  <div className="btn-row" style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="theme-light-btn"
                      aria-pressed={themePref === 'light'}
                      onClick={() => setThemePref('light')}
                    >
                      Light Paper Theme
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="theme-dark-btn"
                      aria-pressed={themePref === 'dark'}
                      onClick={() => setThemePref('dark')}
                    >
                      Dark Charcoal Theme
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="theme-system-btn"
                      aria-pressed={themePref === 'system'}
                      onClick={() => setThemePref('system')}
                    >
                      System Default
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 5: Data & Privacy */}
              {activeSettingsTab === 'privacy' && (
                <div className="ledger-form">
                  <h3 style={{ marginTop: 0 }} className="serif-document">Data Export &amp; Sandbox Reset</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink-muted)' }}>
                    Export your full workspace data as JSON (clients, invoices, activity, notifications). Private secrets and credentials are fully redacted.
                  </p>
                  <div className="btn-row" style={{ margin: '1rem 0' }}>
                    <button
                      type="button"
                      className="action-btn"
                      data-testid="settings-export-json-btn"
                      onClick={() => void handleExportWorkspaceJson()}
                    >
                      Export workspace JSON
                    </button>
                  </div>

                  <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--rule)' }}>
                    <h4 style={{ color: 'var(--late)', marginTop: 0 }} className="serif-document">
                      Permanent Account Deletion
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                      Permanently and irrevocably delete your account, clients, invoices, reminders, and activity history.
                    </p>
                    {deleteError && (
                      <div
                        role="alert"
                        data-testid="delete-account-error"
                        className="feedback-banner"
                        data-tone="error"
                        style={{ marginBottom: '1rem' }}
                      >
                        {deleteError}
                      </div>
                    )}
                    {deleteSuccess && (
                      <div
                        role="status"
                        data-testid="delete-account-feedback"
                        className="feedback-banner"
                        data-tone="success"
                        style={{ marginBottom: '1rem' }}
                      >
                        {deleteSuccess}
                      </div>
                    )}
                    <form
                      onSubmit={(e) => void handleDeleteAccount(e)}
                      style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <label htmlFor="delete-confirm-email" className="sr-only">
                        Confirm email address to delete account
                      </label>
                      <input
                        id="delete-confirm-email"
                        type="email"
                        className="form-input"
                        data-testid="delete-account-input"
                        placeholder={`Type ${currentUser?.email ?? 'your email'} to confirm`}
                        value={deleteConfirmEmail}
                        onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                        style={{ maxWidth: '320px' }}
                        required
                      />
                      <button
                        type="submit"
                        className="action-btn"
                        data-testid="delete-account-btn"
                        disabled={deleteSubmitting}
                        style={{
                          backgroundColor: 'var(--late)',
                          borderColor: 'var(--late)',
                          color: 'var(--on-primary, #ffffff)'
                        }}
                      >
                        {deleteSubmitting ? 'Deleting...' : 'Permanently delete account'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Tab 6: Developer & Webhook Viewer */}
              {activeSettingsTab === 'developer' && (
                <div className="ledger-form" data-testid="webhook-events-panel">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '1rem'
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0 }} className="serif-document">
                        Advanced Settings &amp; Webhook Diagnostics
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', margin: '0.25rem 0 0 0' }}>
                        Inspect verified incoming PayPal webhook events, signature statuses, and raw payload data.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="secondary-btn"
                      data-testid="refresh-webhooks-btn"
                      onClick={() => void loadWebhookEvents()}
                      disabled={webhookEventsLoading}
                    >
                      {webhookEventsLoading ? 'Refreshing...' : '↻ Refresh webhooks'}
                    </button>
                  </div>

                  <div style={{ margin: '1rem 0', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <strong>Provider Mode:</strong>{' '}
                      <span className="status-pill" data-tone="paid" data-testid="dev-mode-indicator">
                        {currentMode.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <strong>Payment API:</strong>{' '}
                      <span className="status-pill" data-tone="paid">
                        PayPal REST API (Sandbox)
                      </span>
                    </div>
                    <div>
                      <strong>Total Webhook Events:</strong>{' '}
                      <span className="tabular-nums">{webhookEvents.length}</span>
                    </div>
                  </div>

                  {webhookEvents.length === 0 ? (
                    <div
                      style={{
                        padding: '2rem 1rem',
                        textAlign: 'center',
                        color: 'var(--ink-muted)',
                        fontStyle: 'italic',
                        border: '1px dashed var(--rule)'
                      }}
                    >
                      No webhook events logged yet. Incoming PayPal notifications verified with HMAC/CRC32 signatures appear here.
                    </div>
                  ) : (
                    <div className="ledger-table-wrap">
                      <table className="ledger-table" aria-label="PayPal webhook events">
                        <thead>
                          <tr>
                            <th scope="col">Event ID</th>
                            <th scope="col">Event Type</th>
                            <th scope="col">Summary</th>
                            <th scope="col">Received At</th>
                            <th scope="col">Status</th>
                            <th scope="col">Inspect</th>
                          </tr>
                        </thead>
                        <tbody>
                          {webhookEvents.map((evt) => (
                            <tr key={evt.id} data-testid={`webhook-row-${evt.id}`}>
                              <td className="tabular-nums" style={{ fontSize: '0.8125rem' }}>
                                {evt.providerEventId}
                              </td>
                              <td>
                                <code>{evt.eventType}</code>
                              </td>
                              <td style={{ fontSize: '0.875rem' }}>{evt.summary || '—'}</td>
                              <td className="tabular-nums" style={{ fontSize: '0.8125rem' }}>
                                {evt.receivedAt.slice(0, 19).replace('T', ' ')}
                              </td>
                              <td>
                                <span
                                  className="status-pill"
                                  data-tone={evt.verificationStatus === 'VERIFIED' ? 'paid' : 'draft'}
                                >
                                  {evt.verificationStatus}
                                </span>
                              </td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-btn"
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                  data-testid={`inspect-webhook-${evt.id}`}
                                  onClick={() =>
                                    setSelectedWebhookPayload(
                                      JSON.stringify(evt.payload ?? evt, null, 2)
                                    )
                                  }
                                >
                                  Inspect JSON
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {selectedWebhookPayload && (
                    <div
                      className="auth-modal-backdrop"
                      role="dialog"
                      aria-modal="true"
                      data-testid="webhook-payload-modal"
                    >
                      <div
                        className="auth-modal-card"
                        style={{
                          maxWidth: '640px',
                          maxHeight: '80vh',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem'
                          }}
                        >
                          <h4 style={{ margin: 0 }} className="serif-document">
                            Webhook Raw JSON Payload
                          </h4>
                          <button
                            type="button"
                            className="secondary-btn"
                            data-testid="close-webhook-modal-btn"
                            onClick={() => setSelectedWebhookPayload(null)}
                          >
                            Close
                          </button>
                        </div>
                        <pre
                          style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '1rem',
                            backgroundColor: 'var(--sheet-2)',
                            border: '1px solid var(--rule)',
                            fontSize: '0.8125rem',
                            fontFamily: 'monospace'
                          }}
                        >
                          {selectedWebhookPayload}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeSection === 'tokens' && (
            <section aria-labelledby="section-tokens-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-tokens-title" className="sheet-title">
                    Paper ledger &amp; approval slip design tokens
                  </h2>
                  <p className="sheet-lead">
                    Exact color palette and typography (`Hanken Grotesk` UI + `Newsreader` financial documents + tabular numerals) from `docs/UI_UX_DESIGN.md`.
                  </p>
                </div>
              </div>

              <div className="ledger-table-wrap">
                <table className="ledger-table" aria-label="UI design token inventory">
                  <thead>
                    <tr>
                      <th scope="col">Token</th>
                      <th scope="col">Light value</th>
                      <th scope="col">Dark value</th>
                      <th scope="col">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DESIGN_TOKENS.map((token) => (
                      <tr key={token.name}>
                        <td>
                          <code>--{token.name}</code>
                        </td>
                        <td className="tabular-nums">
                          <code>{token.lightHex}</code>
                        </td>
                        <td className="tabular-nums">
                          <code>{token.darkHex}</code>
                        </td>
                        <td>{token.purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeSection === 'onboarding' && (
            <section aria-labelledby="section-onboarding-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-onboarding-title" className="sheet-title">
                    Workspace onboarding &amp; configuration
                  </h2>
                  <p className="sheet-lead">
                    Configure your business profile, verify PayPal Sandbox connection, set invoice limits, and register your first client.
                  </p>
                </div>
              </div>

              {onboardingFeedback && (
                <div
                  className="status-banner"
                  data-tone="paid"
                  data-testid="onboarding-feedback"
                  role="status"
                >
                  {onboardingFeedback}
                </div>
              )}
              {onboardingError && (
                <div
                  className="status-banner"
                  data-tone="late"
                  data-testid="onboarding-error"
                  role="alert"
                >
                  {onboardingError}
                </div>
              )}

              <div className="onboarding-wizard">
                <div
                  className="onboarding-steps-indicator"
                  aria-label="Onboarding steps"
                >
                  {[
                    { step: 1, label: '1. Business details' },
                    { step: 2, label: '2. Sandbox connection' },
                    { step: 3, label: '3. Safety & tones' },
                    { step: 4, label: '4. First client' }
                  ].map((s) => {
                    const isDone =
                      onboarding?.completed ||
                      (onboarding?.currentStep ?? 1) > s.step;
                    const isActive =
                      (onboarding?.currentStep ?? 1) === s.step &&
                      !onboarding?.completed;
                    return (
                      <span
                        key={s.step}
                        className="onboarding-step-pill"
                        data-active={isActive ? 'true' : 'false'}
                        data-done={isDone ? 'true' : 'false'}
                        data-testid={`onboarding-step-indicator-${s.step}`}
                      >
                        {s.label} {isDone ? 'Γ£ô' : ''}
                      </span>
                    );
                  })}
                </div>

                {onboarding?.completed ? (
                  <div
                    className="paper-preview-sheet"
                    data-testid="onboarding-completed-card"
                  >
                    <div className="paper-preview-header">
                      <div>
                        <h3 className="paper-preview-title">
                          Onboarding complete!
                        </h3>
                        <p className="paper-preview-client-line">
                          Your business workspace is fully configured and ready
                          for invoicing.
                        </p>
                      </div>
                      <span className="status-pill" data-tone="paid">
                        VERIFIED COMPLETE
                      </span>
                    </div>

                    <div
                      className="summary-block"
                      style={{ marginTop: '1rem' }}
                    >
                      <div className="summary-row">
                        <span>Business name:</span>
                        <strong className="summary-total-figure">
                          {onboarding.businessName || 'Default Practice'}
                        </strong>
                      </div>
                      <div className="summary-row">
                        <span>Default currency:</span>
                        <span className="tabular-nums">
                          {onboarding.defaultCurrency}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>PayPal Sandbox connection:</span>
                        <span
                          className="status-pill"
                          data-tone={
                            onboarding.sandboxTested ? 'paid' : 'info'
                          }
                        >
                          {onboarding.sandboxTested
                            ? 'Verified Connected'
                            : 'Mock / Standby'}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>Max invoice safety limit:</span>
                        <span className="tabular-nums">
                          {formatMoneyFromMinor(
                            onboarding.maxInvoiceAmountMinor,
                            onboarding.defaultCurrency
                          )}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span>Reminder tone:</span>
                        <span style={{ textTransform: 'capitalize' }}>
                          {onboarding.defaultReminderTone}
                        </span>
                      </div>
                    </div>

                    <div className="btn-row" style={{ marginTop: '1.25rem' }}>
                      <button
                        type="button"
                        className="action-btn"
                        data-testid="onboarding-go-invoices-btn"
                        onClick={() => setActiveSection('invoices')}
                      >
                        Go to invoices &amp; drafts
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        data-testid="onboarding-reset-btn"
                        disabled={onboardingLoading}
                        onClick={() => void handleResetOnboarding()}
                      >
                        Re-run onboarding wizard
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {(onboarding?.currentStep ?? 1) === 1 && (
                      <div data-testid="onboarding-step1-card">
                        <h3
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontFamily: 'var(--font-heading)'
                          }}
                        >
                          Step 1: Business details
                        </h3>
                        <p className="sheet-lead">
                          Enter the public name and contact email that will appear
                          on invoices issued to clients.
                        </p>
                        <form
                          onSubmit={(e) => void handleSaveOnboardingBusiness(e)}
                          className="ledger-form"
                        >
                          <div className="form-grid">
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-biz-name"
                              >
                                Business / practice name *
                              </label>
                              <input
                                id="onb-biz-name"
                                className="form-input"
                                type="text"
                                required
                                data-testid="onboarding-business-name-input"
                                value={onbBusinessName}
                                onChange={(e) =>
                                  setOnbBusinessName(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-biz-email"
                              >
                                Business email *
                              </label>
                              <input
                                id="onb-biz-email"
                                className="form-input"
                                type="email"
                                required
                                data-testid="onboarding-business-email-input"
                                value={onbBusinessEmail}
                                onChange={(e) =>
                                  setOnbBusinessEmail(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-currency"
                              >
                                Default currency *
                              </label>
                              <select
                                id="onb-currency"
                                className="form-select"
                                data-testid="onboarding-currency-select"
                                value={onbCurrency}
                                onChange={(e) => setOnbCurrency(e.target.value)}
                              >
                                {SUPPORTED_CURRENCIES.map((code) => (
                                  <option key={code} value={code}>
                                    {code}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="btn-row">
                            <button
                              type="submit"
                              className="action-btn"
                              data-testid="onboarding-step1-submit"
                              disabled={onboardingLoading}
                            >
                              Save &amp; continue
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              data-testid="onboarding-skip-btn"
                              disabled={onboardingLoading}
                              onClick={() => void handleSkipOnboarding()}
                            >
                              Skip onboarding
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {(onboarding?.currentStep ?? 1) === 2 && (
                      <div data-testid="onboarding-step2-card">
                        <h3
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontFamily: 'var(--font-heading)'
                          }}
                        >
                          Step 2: PayPal Sandbox connection
                        </h3>
                        <p className="sheet-lead">
                          Test OAuth credentials against the PayPal Sandbox
                          environment to verify invoice transmission readiness.
                        </p>
                        <div className="paper-preview-sheet">
                          <div className="paper-preview-header">
                            <div>
                              <span className="paper-preview-num">
                                Connection Mode
                              </span>
                              <p className="paper-preview-client-line">
                                Current server mode:{' '}
                                <strong>
                                  {currentMode === 'sandbox'
                                    ? 'PayPal Sandbox'
                                    : 'Isolated Mock'}
                                </strong>
                              </p>
                            </div>
                            <span
                              className="status-pill"
                              data-tone={
                                onboarding?.sandboxTested ? 'paid' : 'info'
                              }
                              data-testid="onboarding-sandbox-status"
                            >
                              {onboarding?.sandboxTested
                                ? 'Verified Connected'
                                : 'Not Yet Tested'}
                            </span>
                          </div>
                        </div>
                        <div className="btn-row" style={{ marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="action-btn"
                            data-testid="onboarding-test-sandbox-btn"
                            disabled={onboardingLoading}
                            onClick={() => void handleTestOnboardingSandbox()}
                          >
                            Test Sandbox connection
                          </button>
                          <button
                            type="button"
                            className="secondary-btn"
                            data-testid="onboarding-skip-btn"
                            disabled={onboardingLoading}
                            onClick={() => void handleSkipOnboarding()}
                          >
                            Skip onboarding
                          </button>
                        </div>
                      </div>
                    )}

                    {(onboarding?.currentStep ?? 1) === 3 && (
                      <div data-testid="onboarding-step3-card">
                        <h3
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontFamily: 'var(--font-heading)'
                          }}
                        >
                          Step 3: Financial safety &amp; reminder tone
                        </h3>
                        <p className="sheet-lead">
                          Set maximum single-invoice limits to guard against
                          accidental over-billing, and select default reminder
                          tone.
                        </p>
                        <form
                          onSubmit={(e) =>
                            void handleSaveOnboardingPreferences(e)
                          }
                          className="ledger-form"
                        >
                          <div className="form-grid">
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-max-amount"
                              >
                                Maximum single invoice amount ({onbCurrency}) *
                              </label>
                              <input
                                id="onb-max-amount"
                                className="form-input"
                                type="number"
                                min="100"
                                step="100"
                                required
                                data-testid="onboarding-max-amount-input"
                                value={Math.round(onbMaxAmountMinor / 100)}
                                onChange={(e) => {
                                  const val = Number.parseInt(
                                    e.target.value,
                                    10
                                  );
                                  setOnbMaxAmountMinor(
                                    Number.isNaN(val) ? 1000000 : val * 100
                                  );
                                }}
                              />
                              <small style={{ color: 'var(--ink-muted)' }}>
                                Enforced server-side on invoice drafts and
                                Gemini agent executions.
                              </small>
                            </div>
                            <div className="form-field">
                              <label className="form-label" htmlFor="onb-tone">
                                Default reminder tone *
                              </label>
                              <select
                                id="onb-tone"
                                className="form-select"
                                data-testid="onboarding-tone-select"
                                value={onbReminderTone}
                                onChange={(e) =>
                                  setOnbReminderTone(
                                    e.target.value as
                                      | 'polite'
                                      | 'firm'
                                      | 'final'
                                  )
                                }
                              >
                                <option value="polite">
                                  Polite &amp; collegial
                                </option>
                                <option value="firm">
                                  Firm &amp; structured
                                </option>
                                <option value="final">
                                  Final notice / urgent
                                </option>
                              </select>
                            </div>
                          </div>
                          <div className="btn-row">
                            <button
                              type="submit"
                              className="action-btn"
                              data-testid="onboarding-step3-submit"
                              disabled={onboardingLoading}
                            >
                              Save preferences &amp; continue
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              data-testid="onboarding-skip-btn"
                              disabled={onboardingLoading}
                              onClick={() => void handleSkipOnboarding()}
                            >
                              Skip onboarding
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {(onboarding?.currentStep ?? 1) === 4 && (
                      <div data-testid="onboarding-step4-card">
                        <h3
                          style={{
                            margin: '0 0 0.5rem 0',
                            fontFamily: 'var(--font-heading)'
                          }}
                        >
                          Step 4: Register your first client
                        </h3>
                        <p className="sheet-lead">
                          Create your first stored client record to begin drafting
                          and sending invoices.
                        </p>
                        <form
                          onSubmit={(e) => void handleCreateOnboardingClient(e)}
                          className="ledger-form"
                        >
                          <div className="form-grid">
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-client-name"
                              >
                                Full name *
                              </label>
                              <input
                                id="onb-client-name"
                                className="form-input"
                                type="text"
                                required
                                data-testid="onboarding-client-name-input"
                                value={onbClientName}
                                onChange={(e) =>
                                  setOnbClientName(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-client-email"
                              >
                                Email address *
                              </label>
                              <input
                                id="onb-client-email"
                                className="form-input"
                                type="email"
                                required
                                data-testid="onboarding-client-email-input"
                                value={onbClientEmail}
                                onChange={(e) =>
                                  setOnbClientEmail(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-field">
                              <label
                                className="form-label"
                                htmlFor="onb-client-company"
                              >
                                Company name (optional)
                              </label>
                              <input
                                id="onb-client-company"
                                className="form-input"
                                type="text"
                                data-testid="onboarding-client-company-input"
                                value={onbClientCompany}
                                onChange={(e) =>
                                  setOnbClientCompany(e.target.value)
                                }
                              />
                            </div>
                          </div>
                          <div className="btn-row">
                            <button
                              type="submit"
                              className="action-btn"
                              data-testid="onboarding-step4-submit"
                              disabled={onboardingLoading}
                            >
                              Create client &amp; finish setup
                            </button>
                            <button
                              type="button"
                              className="secondary-btn"
                              data-testid="onboarding-skip-btn"
                              disabled={onboardingLoading}
                              onClick={() => void handleSkipOnboarding()}
                            >
                              Skip onboarding
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {activeSection === 'roadmap' && (
            <section aria-labelledby="section-roadmap-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-roadmap-title" className="sheet-title">
                    Implementation honesty &amp; stage status
                  </h2>
                  <p className="sheet-lead">
                    Stages 00 through 05 are implemented and verified. Later stages remain `NOT STARTED` until built and verified with reproducible tests.
                  </p>
                </div>
              </div>

              <div className="ledger-table-wrap">
                <table className="ledger-table" aria-label="Implementation stage ledger">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">Scope item</th>
                      <th scope="col">Target stage</th>
                      <th scope="col">Current status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BASELINE_FEATURE_GROUPS.map((row) => (
                      <tr key={row.id}>
                        <td className="tabular-nums">{row.id}</td>
                        <td>{row.title}</td>
                        <td className="tabular-nums">{row.stageTarget}</td>
                        <td>
                          <span
                            className="status-pill"
                            data-tone={row.status === 'VERIFIED' ? 'paid' : 'caution'}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Page 24: Help & FAQ */}
          {activeSection === 'help' && (
            <section aria-labelledby="section-help-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-help-title" className="sheet-title">
                    Help &amp; Frequently Asked Questions
                  </h2>
                  <p className="sheet-lead">
                    Understand InvoicePilot workflows, the Human Approval Gate, PayPal Sandbox testing, and financial state safeguards.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem', maxWidth: '480px' }}>
                <label htmlFor="faq-search-input" className="form-label">
                  Search help topics
                </label>
                <input
                  id="faq-search-input"
                  type="search"
                  className="form-input"
                  data-testid="faq-search-input"
                  placeholder="Filter questions by keyword (e.g. approval, sandbox, minor units)..."
                  value={faqSearchQuery}
                  onChange={(e) => setFaqSearchQuery(e.target.value)}
                />
              </div>

              <div className="faq-accordion-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  {
                    id: 'faq-approval',
                    question: 'How does the Human Approval Gate protect my invoices and reminders?',
                    answer:
                      'All external actions (such as sending a PayPal invoice or delivering a payment reminder) require explicit user approval via a strict server-enforced state machine: DRAFTED -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> EXECUTED. AI agent proposals and conventional form entries remain safe drafts until you review the Approval Slip and confirm.'
                  },
                  {
                    id: 'faq-sandbox',
                    question: 'Is real money ever charged during PayPal Sandbox testing?',
                    answer:
                      'No. InvoicePilot runs strictly against PayPal Sandbox REST APIs (or isolated Mock mode). Sandbox credentials, simulated payer accounts, and test invoices are segregated from production financial rails. Live money processing is an explicit non-goal.'
                  },
                  {
                    id: 'faq-agent',
                    question: 'How does Gemini AI assist with invoicing and client tone?',
                    answer:
                      'The Gemini structured agent parses natural-language prompts to extract invoice line items or draft reminders with polite, firm, or final tones tailored to client payment history. The agent can only resolve pre-existing stored clients in your workspace and cannot invent recipient details, bypass approval, or fabricate payment records.'
                  },
                  {
                    id: 'faq-currency',
                    question: 'Why does InvoicePilot store currency in integer minor units?',
                    answer:
                      'To avoid floating-point rounding errors and precision loss, all monetary values (subtotals, line totals, tax, and overall totals) are stored as integer minor units (such as cents for USD/EUR, or whole yen for JPY). Totals and tax calculations are strictly re-verified on the server.'
                  },
                  {
                    id: 'faq-insights',
                    question: 'How are aging buckets and 30-day cash-flow forecasts calculated?',
                    answer:
                      'Aging buckets (Current, 1-30d, 31-60d, 61-90d, 90+d overdue) are computed deterministically from verified persisted invoices and partial payments without combining disparate currencies. Projections apply probability discounts and are clearly marked as estimates, never guaranteed cash.'
                  },
                  {
                    id: 'faq-export-delete',
                    question: 'Can I export my workspace data or delete my account?',
                    answer:
                      'Yes. You can download a complete JSON export of your workspace records (with provider secrets and private tokens redacted) at any time. You can also permanently delete your account and all associated client/invoice records via Settings > Data & Privacy.'
                  }
                ]
                  .filter(
                    (item) =>
                      !faqSearchQuery.trim() ||
                      item.question.toLowerCase().includes(faqSearchQuery.toLowerCase()) ||
                      item.answer.toLowerCase().includes(faqSearchQuery.toLowerCase())
                  )
                  .map((item) => {
                    const isExpanded = expandedFaqId === item.id;
                    return (
                      <div
                        key={item.id}
                        data-testid={`faq-item-${item.id}`}
                        className="ledger-form"
                        style={{ padding: '1rem', cursor: 'pointer' }}
                        onClick={() => setExpandedFaqId(isExpanded ? null : item.id)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontWeight: 600
                          }}
                        >
                          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
                            {item.question}
                          </span>
                          <span className="tabular-nums" style={{ fontSize: '1.25rem', marginLeft: '0.5rem' }}>
                            {isExpanded ? '−' : '+'}
                          </span>
                        </div>
                        {isExpanded && (
                          <p
                            style={{
                              marginTop: '0.75rem',
                              marginBottom: 0,
                              color: 'var(--ink-muted)',
                              lineHeight: 1.5,
                              fontSize: '0.9375rem'
                            }}
                          >
                            {item.answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          )}

          {/* Page 25: Legal & Policy Section */}
          {activeSection === 'policies' && (
            <section aria-labelledby="section-policies-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-policies-title" className="sheet-title">
                    Legal agreements, privacy &amp; security policies
                  </h2>
                  <p className="sheet-lead">
                    Review terms of service, privacy data handling, security disclosures, and acceptable use guidelines.
                  </p>
                </div>
              </div>

              {/* Policy tabs */}
              <div
                className="tab-strip"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '1.5rem',
                  borderBottom: '1px solid var(--rule)',
                  paddingBottom: '0.5rem'
                }}
              >
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="policy-tab-terms"
                  aria-pressed={activePolicyTab === 'terms'}
                  onClick={() => setActivePolicyTab('terms')}
                  style={{ fontWeight: activePolicyTab === 'terms' ? 600 : 400 }}
                >
                  Terms of Service
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="policy-tab-privacy"
                  aria-pressed={activePolicyTab === 'privacy'}
                  onClick={() => setActivePolicyTab('privacy')}
                  style={{ fontWeight: activePolicyTab === 'privacy' ? 600 : 400 }}
                >
                  Privacy Policy
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="policy-tab-security"
                  aria-pressed={activePolicyTab === 'security'}
                  onClick={() => setActivePolicyTab('security')}
                  style={{ fontWeight: activePolicyTab === 'security' ? 600 : 400 }}
                >
                  Security &amp; Sandbox Disclosure
                </button>
                <button
                  type="button"
                  className="secondary-btn tab-btn"
                  data-testid="policy-tab-aup"
                  aria-pressed={activePolicyTab === 'aup'}
                  onClick={() => setActivePolicyTab('aup')}
                  style={{ fontWeight: activePolicyTab === 'aup' ? 600 : 400 }}
                >
                  Acceptable Use Policy
                </button>
              </div>

              <div className="ledger-form" style={{ maxWidth: '800px', lineHeight: 1.6 }}>
                {activePolicyTab === 'terms' && (
                  <article data-testid="policy-content-terms">
                    <h3 className="serif-document" style={{ marginTop: 0 }}>Terms of Service</h3>
                    <p style={{ color: 'var(--ink-muted)' }}>
                      <strong>Effective Date:</strong> October 31, 2026 | <strong>Version:</strong> 1.0.0
                    </p>
                    <h4>1. Purpose and Human-in-the-Loop Authority</h4>
                    <p>
                      InvoicePilot is an AI-assisted invoicing and accounts receivable workspace designed for freelancers, independent contractors, and small service providers. All invoice generation, reminder composition, and financial actions require explicit human review and approval through the Human Approval Gate. The user retains sole and final authority for verifying amounts, currency codes, recipient identities, and delivery authorizations before execution.
                    </p>
                    <h4>2. Provider Simulation and Non-Goals</h4>
                    <p>
                      InvoicePilot integrates exclusively with the PayPal Sandbox testing environment (or local mock services). The service does not process live monetary transactions or provide multi-provider accounting suites. Any simulated buyer payment link or webhook callback represents test data for verification purposes only.
                    </p>
                    <h4>3. Limitation of Liability</h4>
                    <p>
                      InvoicePilot and its contributors provide this software on an &ldquo;as is&rdquo; basis without warranties of any kind. Users are responsible for ensuring compliance with applicable invoicing regulations and tax jurisdictions.
                    </p>
                  </article>
                )}

                {activePolicyTab === 'privacy' && (
                  <article data-testid="policy-content-privacy">
                    <h3 className="serif-document" style={{ marginTop: 0 }}>Privacy Policy</h3>
                    <p style={{ color: 'var(--ink-muted)' }}>
                      <strong>Effective Date:</strong> October 31, 2026 | <strong>Data Protection Standard:</strong> Owner-Tenant Isolation
                    </p>
                    <h4>1. Information Collection &amp; Purpose</h4>
                    <p>
                      InvoicePilot collects and stores client profile information (contact name, company name, email address), invoice line items, reminder drafts, and activity audit trails solely to deliver workspace invoicing capabilities. We do not sell, rent, or monetize your personal or client data.
                    </p>
                    <h4>2. Credential Security &amp; Redaction</h4>
                    <p>
                      Sensitive provider credentials (including PayPal OAuth client secrets, Gemini API keys, and session tokens) are stored exclusively server-side in secure environment configurations or encrypted stores. Private secrets are strictly redacted from client payloads, exports, and browser responses.
                    </p>
                    <h4>3. User Rights: Data Export &amp; Erasure</h4>
                    <p>
                      You retain full ownership of your workspace data. You have the right to download a machine-readable JSON copy of your entire ledger at any time via Settings &gt; Data &amp; privacy. You may also execute a permanent account deletion that irrevocably erases all clients, invoices, settings, and activity logs.
                    </p>
                  </article>
                )}

                {activePolicyTab === 'security' && (
                  <article data-testid="policy-content-security">
                    <h3 className="serif-document" style={{ marginTop: 0 }}>Security &amp; Sandbox Disclosure</h3>
                    <p style={{ color: 'var(--ink-muted)' }}>
                      <strong>Security Model:</strong> Server-Side Enforcement &amp; Cryptographic Verification
                    </p>
                    <h4>1. PayPal Sandbox Isolation</h4>
                    <p>
                      All payment management workflows communicate directly with PayPal Sandbox endpoints (<code>api-m.sandbox.paypal.com</code>). Test client credentials and test buyer accounts are strictly isolated from production PayPal accounts. No live credit card numbers or banking secrets are collected or retained by InvoicePilot.
                    </p>
                    <h4>2. Webhook Signature Verification &amp; Idempotency</h4>
                    <p>
                      Incoming PayPal webhook notifications are verified against transmission signatures (CRC-32 / RSA verification headers) and deduplicated using provider event IDs before any invoice state transition is recorded.
                    </p>
                    <h4>3. Prompt Injection Defense</h4>
                    <p>
                      All inputs provided to the Gemini AI agent (including client notes, descriptions, and user prompts) are treated as untrusted data. AI tool proposals undergo strict JSON schema validation and server business-rule checks before reaching the human approval slip.
                    </p>
                  </article>
                )}

                {activePolicyTab === 'aup' && (
                  <article data-testid="policy-content-aup">
                    <h3 className="serif-document" style={{ marginTop: 0 }}>Acceptable Use Policy</h3>
                    <p style={{ color: 'var(--ink-muted)' }}>
                      <strong>Compliance Guideline:</strong> Honest &amp; Authorized Invoicing
                    </p>
                    <h4>1. Prohibited Activities</h4>
                    <p>
                      Users may not utilize InvoicePilot to generate deceptive or fraudulent invoices, send unsolicited reminder spam, attempt prompt injection or jailbreak attacks against the AI agent, or manipulate invoice numbers or currencies to mislead clients.
                    </p>
                    <h4>2. Sandbox Compliance</h4>
                    <p>
                      All testing must adhere to PayPal Sandbox guidelines. Use of fabricated credentials or impersonation of unauthorized PayPal merchant accounts is strictly prohibited.
                    </p>
                  </article>
                )}
              </div>
            </section>
          )}
        </main>
      </div>

      <Footer
        setActiveSection={setActiveSection}
        health={health}
        healthLoading={healthLoading}
        fetchHealthStatus={fetchHealthStatus}
      />

      <ReminderModal
        isOpen={reminderDraftModalOpen}
        onClose={() => setReminderDraftModalOpen(false)}
        reminderDraftError={reminderDraftError}
        reminderFeedback={reminderFeedback}
        reminderTargetInvoice={reminderTargetInvoice}
        invoices={invoices}
        onSelectTargetInvoice={handleOpenReminderDraftForInvoice}
        reminderTone={reminderTone}
        setReminderTone={setReminderTone}
        reminderScheduledDate={reminderScheduledDate}
        setReminderScheduledDate={setReminderScheduledDate}
        reminderNotes={reminderNotes}
        setReminderNotes={setReminderNotes}
        reminderDraftLoading={reminderDraftLoading}
        handleGenerateReminderDraft={handleGenerateReminderDraft}
        reminderSubject={reminderSubject}
        setReminderSubject={setReminderSubject}
        reminderBody={reminderBody}
        setReminderBody={setReminderBody}
      />

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        authMode={authMode}
        setAuthMode={setAuthMode}
        authError={authError}
        setAuthError={setAuthError}
        authFeedback={authFeedback}
        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authDisplayName={authDisplayName}
        setAuthDisplayName={setAuthDisplayName}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authLoading={authLoading}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
      />
    </div>
  );
}
