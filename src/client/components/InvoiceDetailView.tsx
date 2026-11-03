import React from 'react';
import type { ClientDto, InvoiceDto } from '../types';
import { formatMoneyFromMinor } from '../types';

export interface InvoiceDetailViewProps {
  selectedInvoice: InvoiceDto;
  selectedInvoiceClient?: ClientDto | null;
  onClose: () => void;
  onDuplicate: (inv: InvoiceDto) => void;
  onEditDraft: (inv: InvoiceDto) => void;
  onRequestApprovalSlip: (invId: string) => Promise<void>;
  onRefreshProviderStatus: (invId: string) => Promise<void>;
  onOpenReminderDraft: (inv: InvoiceDto) => void;
  providerRefreshing: boolean;
  slipLoading: boolean;
  partialPaymentAmount: string;
  setPartialPaymentAmount: (amount: string) => void;
  partialPaymentSubmitting: boolean;
  partialPaymentError: string | null;
  partialPaymentSuccess: string | null;
  handleRecordPartialPayment: (invId: string, currency: string) => Promise<void>;
}

export const InvoiceDetailView: React.FC<InvoiceDetailViewProps> = ({
  selectedInvoice,
  selectedInvoiceClient,
  onClose,
  onDuplicate,
  onEditDraft,
  onRequestApprovalSlip,
  onRefreshProviderStatus,
  onOpenReminderDraft,
  providerRefreshing,
  slipLoading,
  partialPaymentAmount,
  setPartialPaymentAmount,
  partialPaymentSubmitting,
  partialPaymentError,
  partialPaymentSuccess,
  handleRecordPartialPayment
}) => {
  return (
    <section
      className="paper-preview-sheet"
      aria-label="Persisted invoice detail"
      data-testid="invoice-detail-panel"
    >
      {/* Document Lifecycle Timeline */}
      <div
        className="timeline-strip"
        data-testid="invoice-timeline"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          padding: '0.75rem 1rem',
          background: 'var(--sheet-2)',
          border: '1px solid var(--rule)',
          marginBottom: '1rem',
          fontSize: '0.875rem'
        }}
      >
        <div className="timeline-step" data-done="true">
          &check; <strong>Created:</strong> {selectedInvoice.createdAt.slice(0, 10)}
        </div>
        <div
          className="timeline-step"
          data-done={selectedInvoice.localStatus === 'SENT' || !!selectedInvoice.providerInvoiceId}
        >
          {selectedInvoice.localStatus === 'SENT' || selectedInvoice.providerInvoiceId ? '✓' : '○'}{' '}
          <strong>Sent:</strong> {selectedInvoice.providerInvoiceId ? 'PayPal' : 'Pending'}
        </div>
        <div
          className="timeline-step"
          data-done={
            selectedInvoice.providerStatus === 'VIEWED' ||
            selectedInvoice.providerStatus === 'PAID'
          }
        >
          {selectedInvoice.providerStatus === 'VIEWED' ||
          selectedInvoice.providerStatus === 'PAID'
            ? '✓'
            : '○'}{' '}
          <strong>Viewed:</strong>{' '}
          {selectedInvoice.providerStatus === 'VIEWED' ? 'Yes' : 'Awaiting'}
        </div>
        <div
          className="timeline-step"
          data-done={selectedInvoice.providerStatus === 'PAID'}
        >
          {selectedInvoice.providerStatus === 'PAID' ? '✓' : '○'}{' '}
          <strong>Paid:</strong> {selectedInvoice.providerStatus === 'PAID' ? 'Settled' : 'Unpaid'}
        </div>
      </div>

      <div className="paper-preview-header">
        <div>
          <span className="approval-slip-highlight">INVOICE RECORD &amp; TIMELINE</span>
          <h3 style={{ margin: '0.25rem 0' }} className="serif-document">
            Invoice {selectedInvoice.invoiceNumber}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            Client:{' '}
            <strong data-testid="detail-invoice-client">
              {selectedInvoiceClient
                ? `${selectedInvoiceClient.fullName} (${selectedInvoiceClient.email})`
                : selectedInvoice.clientId}
            </strong>
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="secondary-btn"
            data-testid="back-to-invoices-btn"
            onClick={onClose}
          >
            &larr; Back to invoices
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="duplicate-invoice-btn"
            onClick={() => onDuplicate(selectedInvoice)}
          >
            Duplicate draft
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="print-invoice-btn"
            onClick={() => window.print()}
          >
            Print / PDF
          </button>
          {selectedInvoice.providerInvoiceId && (
            <button
              type="button"
              className="action-btn"
              data-testid="detail-refresh-provider-btn"
              disabled={providerRefreshing}
              onClick={() => void onRefreshProviderStatus(selectedInvoice.id)}
            >
              {providerRefreshing ? 'Refreshing...' : 'Refresh PayPal status'}
            </button>
          )}
          {selectedInvoice.localStatus !== 'SENT' && !selectedInvoice.providerInvoiceId && (
            <>
              <button
                type="button"
                className="secondary-btn"
                data-testid="detail-edit-draft-btn"
                onClick={() => onEditDraft(selectedInvoice)}
              >
                Edit draft
              </button>
              <button
                type="button"
                className="action-btn"
                data-testid="detail-prepare-approval-btn"
                disabled={slipLoading}
                onClick={() => void onRequestApprovalSlip(selectedInvoice.id)}
              >
                Review approval slip
              </button>
            </>
          )}
          {selectedInvoice.providerStatus !== 'PAID' &&
            selectedInvoice.localStatus !== 'CANCELLED' && (
              <button
                type="button"
                className="action-btn"
                data-testid="invoice-remind-btn"
                onClick={() => onOpenReminderDraft(selectedInvoice)}
              >
                Draft reminder
              </button>
            )}
          <button
            type="button"
            className="secondary-btn"
            data-testid="close-invoice-detail-btn"
            onClick={onClose}
          >
            Close detail
          </button>
        </div>
      </div>

      <div className="form-grid tabular-nums" style={{ marginBottom: '1rem' }}>
        <div>
          <strong>Issue date:</strong>{' '}
          <span data-testid="detail-issue-date">{selectedInvoice.issueDate}</span>
        </div>
        <div>
          <strong>Due date:</strong>{' '}
          <span data-testid="detail-due-date">{selectedInvoice.dueDate}</span>
        </div>
        <div>
          <strong>Local status:</strong>{' '}
          <span data-testid="detail-local-status">{selectedInvoice.localStatus}</span>
        </div>
        <div>
          <strong>Provider status:</strong>{' '}
          <span data-testid="detail-provider-status">{selectedInvoice.providerStatus}</span>
        </div>
        {selectedInvoice.providerInvoiceId && (
          <div>
            <strong>Provider invoice ID:</strong>{' '}
            <code data-testid="detail-provider-invoice-id">
              {selectedInvoice.providerInvoiceId}
            </code>
          </div>
        )}
        {selectedInvoice.lastProviderSyncAt && (
          <div>
            <strong>Last provider sync:</strong>{' '}
            <span data-testid="detail-provider-sync-at">
              {selectedInvoice.lastProviderSyncAt}
            </span>
          </div>
        )}
        {selectedInvoice.providerRecipientViewUrl && (
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Recipient payment link:</strong>{' '}
            <a
              href={selectedInvoice.providerRecipientViewUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="detail-recipient-view-url"
            >
              {selectedInvoice.providerRecipientViewUrl}
            </a>
          </div>
        )}
      </div>

      <div className="ledger-table-wrap">
        <table className="ledger-table" aria-label="Invoice line items detail">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Description</th>
              <th scope="col">Qty</th>
              <th scope="col">Unit Price</th>
              <th scope="col">Line Total</th>
            </tr>
          </thead>
          <tbody>
            {selectedInvoice.items.map((it, idx) => (
              <tr key={it.id}>
                <td className="tabular-nums">{idx + 1}</td>
                <td>{it.description}</td>
                <td className="tabular-nums">{it.quantity}</td>
                <td className="tabular-nums">
                  {formatMoneyFromMinor(it.unitAmountMinor, it.currencyCode)}
                </td>
                <td className="tabular-nums">
                  <strong>
                    {formatMoneyFromMinor(it.lineTotalMinor, it.currencyCode)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInvoice.notes && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.9rem' }} data-testid="detail-invoice-notes">
          <strong>Notes:</strong> {selectedInvoice.notes}
        </p>
      )}

      <div className="totals-summary tabular-nums">
        <div className="totals-row">
          <span>Subtotal:</span>
          <span data-testid="detail-invoice-subtotal">
            {formatMoneyFromMinor(
              selectedInvoice.subtotalMinor,
              selectedInvoice.currencyCode
            )}
          </span>
        </div>
        <div className="totals-row">
          <span>
            Tax ({(selectedInvoice.taxRateBps / 100).toFixed(2)}%):
          </span>
          <span data-testid="detail-invoice-tax">
            {formatMoneyFromMinor(
              selectedInvoice.taxMinor,
              selectedInvoice.currencyCode
            )}
          </span>
        </div>
        <div className="totals-row totals-row-grand">
          <span>Total Due:</span>
          <span data-testid="detail-invoice-total">
            {formatMoneyFromMinor(
              selectedInvoice.totalMinor,
              selectedInvoice.currencyCode
            )}
          </span>
        </div>

        {(selectedInvoice.paidAmountMinor ?? 0) > 0 && (
          <div className="totals-row">
            <span>Paid amount:</span>
            <span data-testid="detail-invoice-paid" style={{ color: 'var(--paid)' }}>
              {formatMoneyFromMinor(
                selectedInvoice.paidAmountMinor ?? 0,
                selectedInvoice.currencyCode
              )}
            </span>
          </div>
        )}

        <div className="totals-row">
          <span>Outstanding balance:</span>
          <span
            data-testid="detail-invoice-outstanding"
            style={{
              fontWeight: 'bold',
              color:
                selectedInvoice.providerStatus === 'PAID'
                  ? 'var(--paid)'
                  : 'var(--primary)'
            }}
          >
            {formatMoneyFromMinor(
              selectedInvoice.providerStatus === 'PAID'
                ? 0
                : Math.max(
                    0,
                    selectedInvoice.totalMinor - (selectedInvoice.paidAmountMinor ?? 0)
                  ),
              selectedInvoice.currencyCode
            )}
          </span>
        </div>
      </div>

      {/* Record Manual / Partial Payment */}
      {selectedInvoice.providerStatus !== 'PAID' && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '1rem',
            background: 'var(--sheet-2)',
            border: '1px solid var(--rule)',
            borderRadius: '4px'
          }}
          data-testid="partial-payment-section"
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
            Record Manual or Partial Payment
          </h4>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
            Enter the amount received in {selectedInvoice.currencyCode} (major units, e.g. 250.00). It will be validated server-side and recorded in minor units.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              className="ledger-input"
              data-testid="record-partial-payment-input"
              placeholder="e.g. 250.00"
              value={partialPaymentAmount}
              onChange={(e) => setPartialPaymentAmount(e.target.value)}
              style={{ maxWidth: '160px' }}
            />
            <button
              type="button"
              className="action-btn"
              data-testid="record-partial-payment-btn"
              disabled={partialPaymentSubmitting || !partialPaymentAmount.trim()}
              onClick={() =>
                void handleRecordPartialPayment(
                  selectedInvoice.id,
                  selectedInvoice.currencyCode
                )
              }
            >
              {partialPaymentSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
          {partialPaymentError && (
            <p
              style={{ color: 'var(--late)', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}
              data-testid="partial-payment-error"
            >
              {partialPaymentError}
            </p>
          )}
        </div>
      )}
      {partialPaymentSuccess && (
        <p
          style={{ color: 'var(--paid)', fontSize: '0.85rem', margin: '0.75rem 0 0 0' }}
          data-testid="partial-payment-success"
        >
          {partialPaymentSuccess}
        </p>
      )}
    </section>
  );
};

