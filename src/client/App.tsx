import React, { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ShellSection = 'overview' | 'tokens' | 'roadmap';

export interface HealthPayload {
  status: string;
  service: string;
  stage: string;
  environment: string;
  paypalMode: 'sandbox' | 'mock';
  modeLabel: string;
  approvalGateEnforced: boolean;
  timestamp: string;
}

interface TokenDefinition {
  name: string;
  lightHex: string;
  darkHex: string;
  purpose: string;
}

const DESIGN_TOKENS: TokenDefinition[] = [
  { name: 'desk', lightHex: '#EEF0F3', darkHex: '#0F151C', purpose: 'Workspace background desk surface' },
  { name: 'sheet', lightHex: '#FFFFFF', darkHex: '#17202A', purpose: 'Paper invoice & ledger sheet surface' },
  { name: 'sheet-2', lightHex: '#E4E8ED', darkHex: '#1F2A36', purpose: 'Secondary recessed ledger surface' },
  { name: 'ink', lightHex: '#151A21', darkHex: '#E7ECF1', purpose: 'Primary typography & ledger figures' },
  { name: 'ink-muted', lightHex: '#566070', darkHex: '#98A5B5', purpose: 'Secondary labels & metadata' },
  { name: 'rule', lightHex: '#D3D8DF', darkHex: '#2C3947', purpose: 'Fine ledger & table rules' },
  { name: 'primary', lightHex: '#0E5A6B', darkHex: '#5CC3D0', purpose: 'Primary interactive control' },
  { name: 'on-primary', lightHex: '#FFFFFF', darkHex: '#07161A', purpose: 'Contrast text on primary surface' },
  { name: 'highlight', lightHex: '#F4D35E', darkHex: '#E9C441', purpose: 'Restrained yellow approval review highlight' },
  { name: 'paid', lightHex: '#1B7F4B', darkHex: '#4FD38E', purpose: 'Verified paid status accent' },
  { name: 'late', lightHex: '#B3362B', darkHex: '#FF7A6E', purpose: 'Overdue / error status accent' },
  { name: 'caution', lightHex: '#9A6200', darkHex: '#F0B450', purpose: 'Pending approval / mock warning accent' },
  { name: 'info', lightHex: '#2F5FA8', darkHex: '#7FAEF0', purpose: 'Sandbox environment & informational accent' }
];

interface StageGroupRow {
  id: string;
  title: string;
  stageTarget: string;
  status: string;
}

const BASELINE_FEATURE_GROUPS: StageGroupRow[] = [
  { id: 'Stage 01', title: 'App/repo foundation, design tokens, responsive shell, health check', stageTarget: 'Stage 1', status: 'ACTIVE FOUNDATION' },
  { id: 'F-007 / Stage 02-03', title: 'Independent PayPal Sandbox proof & isolated adapter (sandbox vs. mock)', stageTarget: 'Stages 2–3', status: 'NOT STARTED' },
  { id: 'F-004 / F-006', title: 'SQLite persistence, owner isolation, Clients & conventional Invoices CRUD', stageTarget: 'Stages 4–5', status: 'NOT STARTED' },
  { id: 'F-005 / F-010', title: 'Signature Approval Slip state machine & append-oriented Activity log', stageTarget: 'Stage 6', status: 'NOT STARTED' },
  { id: 'F-003', title: 'Constrained Gemini AI invoice draft agent with form fallback', stageTarget: 'Stage 7', status: 'NOT STARTED' },
  { id: 'F-008 / F-009', title: 'Client-aware reminder drafts & grounded aging/cash-flow insights', stageTarget: 'Stages 11–12', status: 'NOT STARTED' }
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
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

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

  useEffect(() => {
    void fetchHealthStatus();
  }, []);

  const currentMode = health?.paypalMode ?? 'sandbox';

  return (
    <div className="app-shell">
      <a href="#main-workspace" className="skip-link">
        Skip to main workspace
      </a>

      <header className="shell-header">
        <div className="shell-header-inner">
          <div className="brand-group">
            <h1 className="brand-title">InvoicePilot</h1>
            <span className="brand-subtitle">
              AI-assisted invoicing &amp; payment workspace
            </span>
          </div>

          <div className="header-controls">
            <div
              className="mode-badge"
              data-mode={currentMode}
              data-testid="provider-mode-badge"
              role="status"
              aria-live="polite"
            >
              <span>
                {currentMode === 'sandbox'
                  ? 'Mode: PayPal Sandbox'
                  : 'Mode: Isolated Mock'}
              </span>
            </div>

            <fieldset className="theme-fieldset" aria-label="Appearance theme">
              <legend className="theme-legend">Appearance theme</legend>
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="theme-btn"
                  aria-pressed={themePref === mode}
                  data-testid={`theme-btn-${mode}`}
                  onClick={() => setThemePref(mode)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </fieldset>
          </div>
        </div>
      </header>

      <div className="shell-body">
        <nav className="ledger-nav" aria-label="Workspace sections">
          <h2 className="ledger-nav-heading">Stage 01 Shell</h2>
          <ul className="ledger-nav-list">
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'overview' ? 'page' : undefined}
                data-testid="nav-overview"
                onClick={() => setActiveSection('overview')}
              >
                <span>System health &amp; mode</span>
                <span className="tabular-nums">01</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'tokens' ? 'page' : undefined}
                data-testid="nav-tokens"
                onClick={() => setActiveSection('tokens')}
              >
                <span>Ledger design tokens</span>
                <span className="tabular-nums">13</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'roadmap' ? 'page' : undefined}
                data-testid="nav-roadmap"
                onClick={() => setActiveSection('roadmap')}
              >
                <span>Stage verification ledger</span>
                <span className="tabular-nums">06</span>
              </button>
            </li>
          </ul>
        </nav>

        <main id="main-workspace" className="ledger-sheet" tabIndex={-1}>
          {activeSection === 'overview' && (
            <section aria-labelledby="section-overview-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-overview-title" className="sheet-title">
                    Application foundation &amp; server health
                  </h2>
                  <p className="sheet-lead">
                    Stage 1 verified baseline: paper-ledger shell, explicit Sandbox vs. Mock mode separation, and live server health status.
                  </p>
                </div>
                <button
                  type="button"
                  className="action-btn"
                  data-testid="refresh-health-btn"
                  disabled={healthLoading}
                  onClick={() => void fetchHealthStatus()}
                >
                  {healthLoading ? 'Checking server...' : 'Refresh health check'}
                </button>
              </div>

              <div className="approval-slip-callout" role="note" aria-label="Approval gate policy">
                <span className="approval-slip-highlight">
                  HUMAN APPROVAL GATE INVARIANT
                </span>
                <p style={{ margin: 0 }} className="serif-document">
                  Consequential financial actions require explicit human review and approval (`DRAFTED -&gt; PENDING_APPROVAL -&gt; APPROVED -&gt; EXECUTING -&gt; EXECUTED`). No external PayPal Sandbox or Gemini API calls are claimed in Stage 1.
                </p>
              </div>

              {healthError && (
                <div
                  role="alert"
                  data-testid="health-error-alert"
                  style={{
                    padding: '0.75rem 1rem',
                    border: '1px solid var(--late)',
                    backgroundColor: 'var(--sheet-2)',
                    marginBottom: '1rem'
                  }}
                >
                  <strong>Server health error:</strong> {healthError}
                </div>
              )}

              <div className="ledger-table-wrap">
                <table className="ledger-table" aria-label="Server health diagnostics">
                  <thead>
                    <tr>
                      <th scope="col">Check item</th>
                      <th scope="col">Verified value</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Application API server (`/api/health`)</td>
                      <td className="tabular-nums" data-testid="health-status-value">
                        {healthLoading
                          ? 'Loading...'
                          : health
                            ? `${health.service} (${health.stage})`
                            : 'Unavailable'}
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          data-tone={health?.status === 'ok' ? 'paid' : 'late'}
                        >
                          {health?.status === 'ok' ? 'VERIFIED OK' : 'CHECK REQUIRED'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Provider environment mode (`PAYPAL_MODE`)</td>
                      <td className="tabular-nums" data-testid="health-mode-value">
                        {health?.modeLabel ?? 'PayPal Sandbox Mode (Default)'}
                      </td>
                      <td>
                        <span
                          className="status-pill"
                          data-tone={currentMode === 'sandbox' ? 'paid' : 'caution'}
                        >
                          {currentMode.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Active appearance theme</td>
                      <td className="tabular-nums" data-testid="active-theme-value">
                        Preference: {themePref} (Resolved: {effectiveTheme})
                      </td>
                      <td>
                        <span className="status-pill" data-tone="paid">
                          ACTIVE
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Last health check timestamp</td>
                      <td className="tabular-nums" data-testid="health-timestamp-value">
                        {health?.timestamp ?? 'Pending'}
                      </td>
                      <td>
                        <span className="status-pill" data-tone="caution">
                          STAGE 01
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
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

          {activeSection === 'roadmap' && (
            <section aria-labelledby="section-roadmap-title">
              <div className="sheet-header">
                <div>
                  <h2 id="section-roadmap-title" className="sheet-title">
                    Implementation honesty &amp; stage status
                  </h2>
                  <p className="sheet-lead">
                    Only Stage 00 and Stage 01 are implemented. Later stages remain `NOT STARTED` until built and verified with reproducible tests.
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
                            data-tone={row.status === 'ACTIVE FOUNDATION' ? 'paid' : 'caution'}
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
        </main>
      </div>

      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <span>InvoicePilot — PayPal AI Hackathon Workspace</span>
          <span className="tabular-nums">
            Provider Mode: {currentMode.toUpperCase()} | Stage 01 Foundation
          </span>
        </div>
      </footer>
    </div>
  );
}
