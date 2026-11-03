import React from 'react';
import type {
  ClientDto,
  InvoiceDto,
  NotificationDto,
  ShellSection,
  ThemePreference,
  UserDto
} from '../types';
import { GlobalSearch } from './GlobalSearch';

export interface HeaderProps {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  headerSearchQuery: string;
  setHeaderSearchQuery: (q: string) => void;
  setInvoiceSearch: (q: string) => void;
  setClientSearch: (q: string) => void;
  setActivitySearch: (q: string) => void;
  invoices: InvoiceDto[];
  clients: ClientDto[];
  setSelectedInvoice: (inv: InvoiceDto | null) => void;
  setSelectedClient: (cl: ClientDto | null) => void;
  setInvoiceFormMode: (mode: 'create' | 'edit' | 'closed') => void;
  setActiveSection: (sec: ShellSection) => void;
  notificationDropdownOpen: boolean;
  setNotificationDropdownOpen: (open: boolean) => void;
  notifications: NotificationDto[];
  handleMarkAllNotificationsRead: () => Promise<void>;
  handleMarkNotificationRead: (id: string) => Promise<void>;
  currentUser: UserDto | null;
  authLoading: boolean;
  handleDemoReset: () => Promise<void>;
  setAuthModalOpen: (open: boolean) => void;
  setAuthError: (err: string | null) => void;
  handleLogout: () => Promise<void>;
  currentMode: 'sandbox' | 'mock';
  themePref: ThemePreference;
  setThemePref: (theme: ThemePreference) => void;
}

export const Header: React.FC<HeaderProps> = ({
  mobileNavOpen,
  setMobileNavOpen,
  headerSearchQuery,
  setHeaderSearchQuery,
  setInvoiceSearch,
  setClientSearch,
  setActivitySearch,
  invoices,
  clients,
  setSelectedInvoice,
  setSelectedClient,
  setInvoiceFormMode,
  setActiveSection,
  notificationDropdownOpen,
  setNotificationDropdownOpen,
  notifications,
  handleMarkAllNotificationsRead,
  handleMarkNotificationRead,
  currentUser,
  authLoading,
  handleDemoReset,
  setAuthModalOpen,
  setAuthError,
  handleLogout,
  currentMode,
  themePref,
  setThemePref
}) => {
  return (
    <header className="shell-header">
      <div className="shell-header-inner">
        <div className="brand-group">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileNavOpen}
            data-testid="mobile-menu-toggle"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <svg
            className="brand-logo-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="12 2 19 21 12 17 5 21 12 2"></polygon>
          </svg>
          <div>
            <h1 className="brand-title">InvoicePilot</h1>
            <span className="brand-subtitle">Financial Workspace</span>
          </div>
        </div>

        <GlobalSearch
          searchQuery={headerSearchQuery}
          onSearchChange={(q) => {
            setHeaderSearchQuery(q);
            setInvoiceSearch(q);
            setClientSearch(q);
            setActivitySearch(q);
          }}
          invoices={invoices}
          clients={clients}
          onSelectInvoice={(inv) => {
            setSelectedInvoice(inv);
            setActiveSection('invoices');
          }}
          onSelectClient={(cl) => {
            setSelectedClient(cl);
            setActiveSection('clients');
          }}
        />

        <div className="header-controls">
          {/* Prominent Create invoice CTA */}
          <button
            type="button"
            className="header-create-btn"
            data-testid="header-create-invoice-btn"
            onClick={() => {
              setSelectedInvoice(null);
              setInvoiceFormMode('create');
              setActiveSection('invoices');
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Create invoice</span>
          </button>

          {/* Notification Bell with working dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="header-bell-btn"
              data-testid="header-notifications-bell"
              aria-label="View notifications"
              onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {notifications.filter((n) => !n.isRead).length > 0 && (
                <span
                  className="bell-badge-pill tabular-nums"
                  data-testid="notifications-unread-badge"
                >
                  {notifications.filter((n) => !n.isRead).length}
                </span>
              )}
            </button>

            {notificationDropdownOpen && (
              <div
                className="header-notifications-popover"
                role="dialog"
                aria-label="Notifications panel"
              >
                <div className="notifications-popover-header">
                  <span className="notifications-popover-title">
                    Notifications ({notifications.filter((n) => !n.isRead).length} unread)
                  </span>
                  <button
                    type="button"
                    className="secondary-btn"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                    onClick={async () => {
                      await handleMarkAllNotificationsRead();
                    }}
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="notifications-popover-list">
                  {notifications.length === 0 ? (
                    <li
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        color: 'var(--ink-muted)',
                        fontSize: '0.8rem'
                      }}
                    >
                      No notifications yet.
                    </li>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <li
                        key={n.id}
                        className="notifications-popover-item"
                        data-unread={!n.isRead}
                        onClick={() => {
                          if (!n.isRead) void handleMarkNotificationRead(n.id);
                          setActiveSection('notifications');
                          setNotificationDropdownOpen(false);
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--ink)',
                            marginBottom: '0.15rem'
                          }}
                        >
                          {n.title}
                        </div>
                        <div style={{ color: 'var(--ink-muted)', fontSize: '0.75rem' }}>
                          {n.body}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
                <div className="notifications-popover-footer">
                  <button
                    type="button"
                    className="action-btn"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '0.35rem 0.6rem' }}
                    onClick={() => {
                      setActiveSection('notifications');
                      setNotificationDropdownOpen(false);
                    }}
                  >
                    View all notifications ({notifications.length})
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className="user-status-badge"
            data-demo={currentUser?.isDemo ? 'true' : 'false'}
            data-testid="current-user-badge"
            role="status"
          >
            <div className="user-avatar-circle">
              {currentUser?.displayName
                ? currentUser.displayName
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'GU'}
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              {currentUser ? currentUser.displayName : 'Guest'}
            </span>
            {currentUser?.isDemo && (
              <span
                className="status-pill"
                data-tone="caution"
                style={{ fontSize: '0.65rem', padding: '0.05rem 0.35rem' }}
              >
                Demo
              </span>
            )}
          </div>

          {currentUser?.isDemo && (
            <button
              type="button"
              className="secondary-btn"
              data-testid="reset-demo-btn"
              disabled={authLoading}
              onClick={() => void handleDemoReset()}
            >
              Reset demo
            </button>
          )}

          <button
            type="button"
            className="secondary-btn"
            data-testid="auth-modal-btn"
            onClick={() => {
              setAuthModalOpen(true);
              setAuthError(null);
            }}
          >
            {currentUser && !currentUser.isDemo ? 'Account' : 'Sign in'}
          </button>

          {currentUser && (
            <button
              type="button"
              className="secondary-btn"
              data-testid="logout-btn"
              disabled={authLoading}
              onClick={() => void handleLogout()}
            >
              Log out
            </button>
          )}

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
  );
};

