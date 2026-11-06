import React, { useState } from 'react';
import type { ThemePreference } from '../types';

export interface StartPageProps {
  currentMode: 'sandbox' | 'mock';
  themePref: ThemePreference;
  setThemePref: (theme: ThemePreference) => void;
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, pass: string, displayName: string) => Promise<void>;
  authLoading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  authFeedback: string | null;
  setAuthFeedback: (fb: string | null) => void;
  health: { status: string; service: string; stage: string; paypalMode: string } | null;
  healthLoading: boolean;
}

export const StartPage: React.FC<StartPageProps> = ({
  currentMode,
  themePref,
  setThemePref,
  onLogin,
  onRegister,
  authLoading,
  authError,
  setAuthError,
  authFeedback,
  setAuthFeedback,
  health,
  healthLoading
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthFeedback(null);
    if (tab === 'login') {
      await onLogin(email, password);
    } else {
      if (password.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return;
      }
      await onRegister(email, password, displayName);
    }
  };

  return (
    <div className="start-page-wrapper">
      {/* Top utility bar */}
      <header className="start-page-header">
        <div className="start-page-header-inner">
          <div className="brand-group">
            <svg
              className="brand-logo-icon"
              viewBox="0 0 28 28"
              width="28"
              height="28"
              fill="none"
              aria-hidden="true"
            >
              <rect width="28" height="28" rx="6" fill="var(--primary)" />
              <path
                d="M7 6C7 5.45 7.45 5 8 5H16L20 9V22C20 22.55 19.55 23 19 23H8C7.45 23 7 22.55 7 22V6Z"
                fill="rgba(255,255,255,0.22)"
              />
              <path
                d="M16 5V9H20"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
              <line
                x1="9"
                y1="12"
                x2="14"
                y2="12"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="15"
                x2="13"
                y2="15"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <polygon points="12,10 22,6 18,20 15,15" fill="#F59E0B" />
              <polygon points="15,15 22,6 12,10" fill="#FDE68A" fillOpacity="0.85" />
            </svg>
            <div>
              <h1 className="brand-title" style={{ fontSize: '1.25rem' }}>
                InvoicePilot
              </h1>
              <span className="brand-subtitle">Financial Workspace</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="mode-badge"
              data-mode={currentMode}
              data-testid="provider-mode-badge"
              role="status"
              aria-live="polite"
            >
              <span>{currentMode === 'sandbox' ? 'Mode: PayPal Sandbox' : 'Mode: PayPal Mock'}</span>
            </div>

            <div
              className="theme-toggle-group"
              role="group"
              aria-label="Theme preference"
              style={{ display: 'flex', gap: '0.2rem' }}
            >
              <button
                type="button"
                className={`theme-pill ${themePref === 'light' ? 'is-active' : ''}`}
                data-testid="theme-btn-light"
                onClick={() => setThemePref('light')}
                aria-pressed={themePref === 'light'}
                aria-label="Light theme"
                title="Light theme"
              >
                Light
              </button>
              <button
                type="button"
                className={`theme-pill ${themePref === 'dark' ? 'is-active' : ''}`}
                data-testid="theme-btn-dark"
                onClick={() => setThemePref('dark')}
                aria-pressed={themePref === 'dark'}
                aria-label="Dark theme"
                title="Dark theme"
              >
                Dark
              </button>
              <button
                type="button"
                className={`theme-pill ${themePref === 'system' ? 'is-active' : ''}`}
                data-testid="theme-btn-system"
                onClick={() => setThemePref('system')}
                aria-pressed={themePref === 'system'}
                aria-label="System theme"
                title="System theme"
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main hero & auth container */}
      <main className="start-page-main">
        <div className="start-page-content">
          <div className="start-page-hero">
            <span className="status-badge" style={{ marginBottom: '0.75rem', display: 'inline-block' }}>
              PayPal AI Hackathon 2026
            </span>
            <h2 className="start-page-headline">
              Prepare invoices with AI. Send only after your approval.
            </h2>
            <p className="start-page-lead">
              Built for freelancers and small service teams. Draft invoices with Gemini, review every
              detail, and send through PayPal Sandbox.
            </p>

            <div className="start-page-features-grid">
              <div className="feature-mini-card">
                <span className="feature-mini-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 2l6 3v5c0 4.5-3 7.5-6 8.5C7 17.5 4 14.5 4 10V5l6-3z" />
                    <path d="M7.5 10l2 2 3.5-3.5" />
                  </svg>
                </span>
                <div>
                  <strong>Human-in-the-Loop Gate</strong>
                  <p>AI tools propose; you review and authorize. Consequential sends never happen autonomously.</p>
                </div>
              </div>
              <div className="feature-mini-card">
                <span className="feature-mini-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 2L4 11h6l-1 7 7-9h-6l1-7z" />
                  </svg>
                </span>
                <div>
                  <strong>Official PayPal Invoicing v2</strong>
                  <p>Real Sandbox OAuth, draft preparation, buyer links, and signature-verified webhooks.</p>
                </div>
              </div>
              <div className="feature-mini-card">
                <span className="feature-mini-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </span>
                <div>
                  <strong>Verified Invoicing & Strict Owner Isolation</strong>
                  <p>Deterministic minor-unit accounting, timing-safe scrypt sessions, and complete tenant data isolation.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated authentication card */}
          <div className="start-page-auth-container">
            <div className="card start-auth-card" data-testid="auth-card">
              <div className="start-auth-tabs" role="tablist" aria-label="Authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'login'}
                  className={`start-auth-tab ${tab === 'login' ? 'is-active' : ''}`}
                  data-testid="auth-tab-login"
                  onClick={() => {
                    setTab('login');
                    setAuthError(null);
                    setAuthFeedback(null);
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'register'}
                  className={`start-auth-tab ${tab === 'register' ? 'is-active' : ''}`}
                  data-testid="auth-tab-register"
                  onClick={() => {
                    setTab('register');
                    setAuthError(null);
                    setAuthFeedback(null);
                  }}
                >
                  Create account
                </button>
              </div>

              {authError && (
                <div
                  className="alert-box alert-error"
                  role="alert"
                  data-testid="auth-error-alert"
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.8125rem',
                    background: 'var(--late-bg)',
                    border: '1px solid var(--late)',
                    color: 'var(--late)'
                  }}
                >
                  {authError}
                </div>
              )}

              {authFeedback && (
                <div
                  className="alert-box alert-success"
                  role="status"
                  data-testid="auth-feedback-alert"
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '1rem',
                    fontSize: '0.8125rem',
                    background: 'var(--paid-bg)',
                    border: '1px solid var(--paid)',
                    color: 'var(--paid)'
                  }}
                >
                  {authFeedback}
                </div>
              )}

              <form onSubmit={handleSubmit} data-testid="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                <div>
                  <label htmlFor="auth-email-input" className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Email address
                  </label>
                  <input
                    id="auth-email-input"
                    type="email"
                    autoComplete="email"
                    className="form-input"
                    data-testid="auth-email-input"
                    placeholder="you@yourdomain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                {tab === 'register' && (
                  <div>
                    <label htmlFor="auth-displayname-input" className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Business or Freelancer Name
                    </label>
                    <input
                      id="auth-displayname-input"
                      type="text"
                      autoComplete="organization"
                      className="form-input"
                      data-testid="auth-displayname-input"
                      placeholder="e.g. Vance UX & Systems"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-password-input" className="form-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Password
                  </label>
                  <input
                    id="auth-password-input"
                    type="password"
                    autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                    className="form-input"
                    data-testid="auth-password-input"
                    placeholder={tab === 'register' ? 'At least 8 characters' : 'Enter password'}
                    minLength={tab === 'register' ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  {tab === 'register' && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '0.25rem', display: 'block' }}>
                      Minimum 8 characters. Hashed server-side using timing-safe scrypt.
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="action-btn"
                  data-testid="auth-submit-btn"
                  disabled={authLoading}
                  style={{ width: '100%', marginTop: '0.4rem', padding: '0.7rem' }}
                >
                  {authLoading
                    ? (tab === 'login' ? 'Signing in...' : 'Creating workspace...')
                    : (tab === 'login' ? 'Sign in to Workspace' : 'Create Free Account')}
                </button>

                <div style={{ textAlign: 'center', marginTop: '0.35rem' }}>
                  {tab === 'login' ? (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setTab('register');
                        setAuthError(null);
                        setAuthFeedback(null);
                      }}
                      style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      Don&apos;t have an account yet? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Create account</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setTab('login');
                        setAuthError(null);
                        setAuthFeedback(null);
                      }}
                      style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem' }}
                    >
                      Already have an account? <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</span>
                    </button>
                  )}
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--rule)',
                    paddingTop: '0.85rem',
                    marginTop: '0.5rem',
                    textAlign: 'center',
                    fontSize: '0.72rem',
                    color: 'var(--ink-muted)'
                  }}
                >
                  🔒 Encrypted timing-safe sessions • Complete owner isolation
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Start page footer */}
      <footer className="start-page-footer">
        <div className="start-page-footer-inner">
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              System: <span data-testid="health-status-value">{healthLoading ? 'Loading...' : health ? `${health.service} (${health.stage})` : 'online'}</span>
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              Environment: <span data-testid="health-mode-value">PayPal Sandbox Mode (No Live Money)</span>
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
            InvoicePilot © 2026. PayPal AI Hackathon submission.
          </div>
        </div>
      </footer>
    </div>
  );
};
