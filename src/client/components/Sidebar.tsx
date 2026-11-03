import React from 'react';
import type { ShellSection } from '../types';

export interface SidebarProps {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  activeSection: ShellSection;
  setActiveSection: (sec: ShellSection) => void;
  invoicesCount: number;
  clientsCount: number;
  remindersCount: number;
  activitiesCount: number;
  unreadNotificationsCount: number;
  onboardingStatusText: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileNavOpen,
  setMobileNavOpen,
  activeSection,
  setActiveSection,
  invoicesCount,
  clientsCount,
  remindersCount,
  activitiesCount,
  unreadNotificationsCount,
  onboardingStatusText
}) => {
  return (
    <>
      {mobileNavOpen && (
        <div
          className="nav-backdrop"
          data-testid="mobile-nav-backdrop"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}
      <nav
        className={`ledger-nav ${mobileNavOpen ? 'is-open' : ''}`}
        aria-label="Workspace sections"
      >
        <div className="mobile-drawer-header">
          <span className="mobile-drawer-title">Navigation</span>
          <button
            type="button"
            className="mobile-drawer-close"
            data-testid="mobile-drawer-close"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
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
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Group 1: Main Workspace */}
        <div className="nav-group">
          <h2 className="ledger-nav-heading">Main Workspace</h2>
          <ul className="ledger-nav-list">
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'overview' ? 'page' : undefined}
                data-testid="nav-overview"
                onClick={() => {
                  setActiveSection('overview');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  </svg>
                  <span>Overview</span>
                </span>
                <span className="nav-badge-pill tabular-nums">01</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'invoices' ? 'page' : undefined}
                data-testid="nav-invoices"
                onClick={() => {
                  setActiveSection('invoices');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <span>Invoices &amp; drafts</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-invoices-count">
                  {invoicesCount}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'clients' ? 'page' : undefined}
                data-testid="nav-clients"
                onClick={() => {
                  setActiveSection('clients');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span>Clients directory</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-clients-count">
                  {clientsCount}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'reminders' ? 'page' : undefined}
                data-testid="nav-reminders"
                onClick={() => {
                  setActiveSection('reminders');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>Reminders</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-reminders-count">
                  {remindersCount}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {/* Group 2: Tools & Audit */}
        <div className="nav-group">
          <h2 className="ledger-nav-heading">Tools &amp; Audit</h2>
          <ul className="ledger-nav-list">
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'agent' ? 'page' : undefined}
                data-testid="nav-agent"
                onClick={() => {
                  setActiveSection('agent');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                  </svg>
                  <span>AI Agent assistant</span>
                </span>
                <span className="nav-badge-pill tabular-nums">AI</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'activity' ? 'page' : undefined}
                data-testid="nav-activity"
                onClick={() => {
                  setActiveSection('activity');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                  </svg>
                  <span>Activity &amp; audit log</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-activity-count">
                  {activitiesCount}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'notifications' ? 'page' : undefined}
                data-testid="nav-notifications"
                onClick={() => {
                  setActiveSection('notifications');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
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
                  <span>Notifications</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-notifications-count">
                  {unreadNotificationsCount}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {/* Group 3: Workspace & Support */}
        <div className="nav-group">
          <h2 className="ledger-nav-heading">Workspace &amp; Support</h2>
          <ul className="ledger-nav-list">
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'settings' ? 'page' : undefined}
                data-testid="nav-settings"
                onClick={() => {
                  setActiveSection('settings');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>Settings</span>
                </span>
                <span className="nav-badge-pill tabular-nums">23</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'onboarding' ? 'page' : undefined}
                data-testid="nav-onboarding"
                onClick={() => {
                  setActiveSection('onboarding');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                  </svg>
                  <span>Getting started</span>
                </span>
                <span className="nav-badge-pill tabular-nums" data-testid="nav-onboarding-status">
                  {onboardingStatusText}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'help' ? 'page' : undefined}
                data-testid="nav-help"
                onClick={() => {
                  setActiveSection('help');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  <span>Help &amp; FAQ</span>
                </span>
                <span className="nav-badge-pill tabular-nums">?</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="ledger-nav-btn"
                aria-current={activeSection === 'policies' ? 'page' : undefined}
                data-testid="nav-policies"
                onClick={() => {
                  setActiveSection('policies');
                  setMobileNavOpen(false);
                }}
              >
                <span className="nav-btn-label">
                  <svg
                    className="nav-btn-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  <span>Legal &amp; policies</span>
                </span>
                <span className="nav-badge-pill tabular-nums">§</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
};

