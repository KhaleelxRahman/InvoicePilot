import React from 'react';
import type { InvoiceDto, ReminderTone } from '../types';
import { formatMoneyFromMinor } from '../types';

export interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminderDraftError: string | null;
  reminderFeedback: string | null;
  reminderTargetInvoice: InvoiceDto | null;
  invoices: InvoiceDto[];
  onSelectTargetInvoice: (inv: InvoiceDto) => void;
  reminderTone: ReminderTone;
  setReminderTone: (tone: ReminderTone) => void;
  reminderScheduledDate: string;
  setReminderScheduledDate: (date: string) => void;
  reminderNotes: string;
  setReminderNotes: (notes: string) => void;
  reminderDraftLoading: boolean;
  handleGenerateReminderDraft: () => Promise<void>;
  reminderSubject: string;
  setReminderSubject: (subject: string) => void;
  reminderBody: string;
  setReminderBody: (body: string) => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  reminderDraftError,
  reminderFeedback,
  reminderTargetInvoice,
  invoices,
  onSelectTargetInvoice,
  reminderTone,
  setReminderTone,
  reminderScheduledDate,
  setReminderScheduledDate,
  reminderNotes,
  setReminderNotes,
  reminderDraftLoading,
  handleGenerateReminderDraft,
  reminderSubject,
  setReminderSubject,
  reminderBody,
  setReminderBody
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="auth-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reminder-modal-title"
      data-testid="reminder-draft-modal"
    >
      <div className="auth-modal-card" style={{ maxWidth: '580px' }}>
        <h3
          id="reminder-modal-title"
          style={{ marginTop: 0, fontFamily: 'var(--font-heading)' }}
        >
          Draft Client Payment Reminder
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
          Tone is derived from client payment history or explicit selection. Strict server validation ensures zero invented financial claims.
        </p>

        {reminderDraftError && (
          <div
            className="banner"
            data-tone="late"
            data-testid="reminder-draft-error"
            role="alert"
            style={{ marginBottom: '1rem' }}
          >
            {reminderDraftError}
          </div>
        )}

        {reminderFeedback && (
          <div
            className="banner"
            data-tone="paid"
            data-testid="reminder-draft-feedback"
            style={{ marginBottom: '1rem' }}
          >
            {reminderFeedback}
          </div>
        )}

        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="reminder-invoice-select">Target invoice:</label>
          <select
            id="reminder-invoice-select"
            className="form-input"
            data-testid="reminder-invoice-select"
            value={reminderTargetInvoice?.id ?? ''}
            onChange={(e) => {
              const inv = invoices.find((i) => i.id === e.target.value);
              if (inv) onSelectTargetInvoice(inv);
            }}
          >
            {invoices
              .filter((i) => i.providerStatus !== 'PAID' && i.localStatus !== 'CANCELLED')
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} &mdash; {formatMoneyFromMinor(i.totalMinor, i.currencyCode)} (Due {i.dueDate})
                </option>
              ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="reminder-tone-select">Reminder tone:</label>
          <select
            id="reminder-tone-select"
            className="form-input"
            data-testid="reminder-tone-select"
            value={reminderTone}
            onChange={(e) => setReminderTone(e.target.value as ReminderTone)}
          >
            <option value="polite">Polite &mdash; Friendly courtesy reminder</option>
            <option value="firm">Firm &mdash; Direct follow-up for overdue balance</option>
            <option value="final">Final &mdash; Formal final notice (30+ days overdue)</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="reminder-schedule-input">Scheduled date (optional):</label>
          <input
            id="reminder-schedule-input"
            type="date"
            className="form-input"
            data-testid="reminder-schedule-input"
            value={reminderScheduledDate}
            onChange={(e) => setReminderScheduledDate(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label htmlFor="reminder-notes-input">Instructions or client context (optional):</label>
          <input
            id="reminder-notes-input"
            type="text"
            className="form-input"
            data-testid="reminder-notes-input"
            placeholder="e.g. Please mention our project milestones"
            value={reminderNotes}
            onChange={(e) => setReminderNotes(e.target.value)}
          />
        </div>

        <div className="btn-row" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="action-btn"
            data-testid="reminder-generate-draft-btn"
            disabled={reminderDraftLoading}
            onClick={() => void handleGenerateReminderDraft()}
          >
            {reminderDraftLoading ? 'Drafting wording...' : 'Generate wording'}
          </button>
        </div>

        {reminderSubject && (
          <div style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="reminder-subject-input">Subject line:</label>
              <input
                id="reminder-subject-input"
                type="text"
                className="form-input"
                data-testid="reminder-subject-input"
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
              <label htmlFor="reminder-body-input">Email body:</label>
              <textarea
                id="reminder-body-input"
                className="form-input"
                data-testid="reminder-body-input"
                rows={6}
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="secondary-btn"
            data-testid="close-reminder-modal-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

