import React from 'react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  authFeedback: string | null;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authDisplayName: string;
  setAuthDisplayName: (name: string) => void;
  authPassword: string;
  setAuthPassword: (pwd: string) => void;
  authLoading: boolean;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleRegister: (e: React.FormEvent) => Promise<void>;
  handleDemoLogin: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  authMode,
  setAuthMode,
  authError,
  setAuthError,
  authFeedback,
  authEmail,
  setAuthEmail,
  authDisplayName,
  setAuthDisplayName,
  authPassword,
  setAuthPassword,
  authLoading,
  handleLogin,
  handleRegister,
  handleDemoLogin
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="auth-modal-card" data-testid="auth-modal">
        <div className="auth-tab-row">
          <button
            type="button"
            className="auth-tab-btn"
            aria-selected={authMode === 'login'}
            data-testid="auth-tab-login"
            onClick={() => {
              setAuthMode('login');
              setAuthError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className="auth-tab-btn"
            aria-selected={authMode === 'register'}
            data-testid="auth-tab-register"
            onClick={() => {
              setAuthMode('register');
              setAuthError(null);
            }}
          >
            Create account
          </button>
        </div>

        <h3
          id="auth-modal-title"
          style={{ marginTop: 0, fontFamily: 'var(--font-heading)' }}
        >
          {authMode === 'login'
            ? 'Sign in to InvoicePilot'
            : 'Register new account'}
        </h3>

        {authError && (
          <div
            className="status-banner"
            data-tone="late"
            data-testid="auth-error"
            role="alert"
            style={{ marginBottom: '1rem' }}
          >
            {authError}
          </div>
        )}
        {authFeedback && (
          <div
            className="status-banner"
            data-tone="paid"
            data-testid="auth-feedback"
            role="status"
            style={{ marginBottom: '1rem' }}
          >
            {authFeedback}
          </div>
        )}

        <form
          onSubmit={(e) =>
            void (authMode === 'login'
              ? handleLogin(e)
              : handleRegister(e))
          }
        >
          <div className="form-field" style={{ marginBottom: '0.75rem' }}>
            <label className="form-label" htmlFor="auth-email">
              Email address *
            </label>
            <input
              id="auth-email"
              className="form-input"
              type="email"
              required
              data-testid="auth-email-input"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="user@example.com"
            />
          </div>

          {authMode === 'register' && (
            <div className="form-field" style={{ marginBottom: '0.75rem' }}>
              <label className="form-label" htmlFor="auth-display-name">
                Full name / business name *
              </label>
              <input
                id="auth-display-name"
                className="form-input"
                type="text"
                required
                data-testid="auth-displayname-input"
                value={authDisplayName}
                onChange={(e) => setAuthDisplayName(e.target.value)}
                placeholder="Jane Doe Consulting"
              />
            </div>
          )}

          <div className="form-field" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="auth-password">
              Password * (minimum 8 characters)
            </label>
            <input
              id="auth-password"
              className="form-input"
              type="password"
              required
              minLength={8}
              data-testid="auth-password-input"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
            />
          </div>

          <div
            className="btn-row"
            style={{ justifyContent: 'space-between' }}
          >
            <div className="btn-row">
              <button
                type="submit"
                className="action-btn"
                data-testid="auth-submit-btn"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
              </button>
              <button
                type="button"
                className="secondary-btn"
                data-testid="auth-close-btn"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
            <button
              type="button"
              className="secondary-btn"
              data-testid="auth-demo-btn"
              disabled={authLoading}
              onClick={() => void handleDemoLogin()}
            >
              Continue as demo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

