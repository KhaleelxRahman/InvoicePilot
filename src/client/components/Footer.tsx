import React from 'react';
import type { HealthPayload, ShellSection } from '../types';

export interface FooterProps {
  health: HealthPayload | null;
  healthLoading: boolean;
  fetchHealthStatus: () => Promise<void>;
  setActiveSection: (sec: ShellSection) => void;
}

export const Footer: React.FC<FooterProps> = ({
  health,
  healthLoading,
  fetchHealthStatus,
  setActiveSection
}) => {
  return (
    <footer className="shell-footer">
      <div className="shell-footer-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>InvoicePilot &copy; 2026 &mdash; Financial Workspace for Freelancers</span>
          <span style={{ color: 'var(--rule)' }}>&bull;</span>
          <button
            type="button"
            className="footer-link-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
            onClick={() => setActiveSection('help')}
          >
            Help &amp; FAQ
          </button>
          <button
            type="button"
            className="footer-link-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline'
            }}
            onClick={() => setActiveSection('policies')}
          >
            Legal &amp; Policies
          </button>
        </div>

        <div
          className="footer-status-strip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            flexWrap: 'wrap',
            fontSize: '0.78rem',
            color: 'var(--ink-muted)'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: health?.status === 'ok' ? 'var(--paid)' : 'var(--caution)'
              }}
            />
            <span className="tabular-nums" data-testid="health-status-value">
              {healthLoading
                ? 'Loading...'
                : health
                ? `${health.service} (${health.stage})`
                : 'Unavailable'}
            </span>
          </span>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <span data-testid="health-mode-value" style={{ fontWeight: 500 }}>
            {health?.modeLabel ?? 'PayPal Sandbox Mode (No Live Money)'}
          </span>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <button
            type="button"
            className="footer-link-btn"
            data-testid="refresh-health-btn"
            disabled={healthLoading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.78rem'
            }}
            onClick={() => void fetchHealthStatus()}
          >
            {healthLoading ? 'Checking...' : 'Check Status'}
          </button>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <button
            type="button"
            className="footer-link-btn"
            data-testid="nav-tokens"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.78rem'
            }}
            onClick={() => setActiveSection('tokens')}
          >
            Design Tokens
          </button>
          <span style={{ color: 'var(--rule)' }}>|</span>
          <button
            type="button"
            className="footer-link-btn"
            data-testid="nav-roadmap"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.78rem'
            }}
            onClick={() => setActiveSection('roadmap')}
          >
            Verification Ledger
          </button>
        </div>
      </div>
    </footer>
  );
};

