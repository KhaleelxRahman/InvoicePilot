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
  onMarkCompleted: (invId: string) => Promise<void>;
  providerRefreshing: boolean;
  slipLoading: boolean;
  completeSubmitting?: boolean;
  completeError?: string | null;
  completeSuccess?: string | null;
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
  onMarkCompleted,
  providerRefreshing,
  slipLoading,
  completeSubmitting = false,
  completeError = null,
  completeSuccess = null,
  partialPaymentAmount,
  setPartialPaymentAmount,
  partialPaymentSubmitting,
  partialPaymentError,
  partialPaymentSuccess,
  handleRecordPartialPayment
}) => {
  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState<boolean>(false);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const token = window.localStorage.getItem('invoicepilot-session-token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/invoices/${selectedInvoice.id}/pdf`, {
        headers,
        credentials: 'same-origin'
      });
      if (!res.ok) {
        throw new Error(`Failed to generate invoice PDF (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice-${(selectedInvoice.invoiceNumber || selectedInvoice.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }

  const isPaid = selectedInvoice.providerStatus === 'PAID';
  const isCancelled = selectedInvoice.localStatus === 'CANCELLED';
  const isSent = selectedInvoice.localStatus === 'SENT' || !!selectedInvoice.providerInvoiceId;
  const isCompleted = Boolean(selectedInvoice.isCompleted);
  const paidAmount = selectedInvoice.paidAmountMinor ?? (isPaid ? selectedInvoice.totalMinor : 0);
  const outstandingAmount = isPaid ? 0 : Math.max(0, selectedInvoice.totalMinor - paidAmount);

  return (
    <section
      className="paper-preview-sheet"
      aria-label="Invoice record detail"
      data-testid="invoice-detail-panel"
    >
      {/* Header Bar */}
      <div className="paper-preview-header">
        <div>
          <span className="status-pill" data-tone={isCompleted ? 'paid' : 'draft'}>
            Invoice #{selectedInvoice.invoiceNumber}
          </span>
          <h3 style={{ margin: '0.35rem 0 0.15rem 0' }} className="serif-document">
            {selectedInvoiceClient ? selectedInvoiceClient.fullName : 'Invoice Details'}
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
            Client:{' '}
            <strong data-testid="detail-invoice-client" style={{ color: 'var(--ink)' }}>
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
            ← Back to invoices
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="download-pdf-btn"
            disabled={downloadingPdf}
            onClick={() => void handleDownloadPdf()}
            title="Download official PDF copy"
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="print-invoice-btn"
            onClick={() => window.print()}
          >
            Print
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="close-invoice-detail-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {/* Primary Action Toolbar */}
      <div
        className="invoice-actions-toolbar"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: 'var(--sheet-2)',
          border: '1px solid var(--rule)',
          borderRadius: '4px',
          marginBottom: '1rem',
          alignItems: 'center'
        }}
      >
        {!isSent && (
          <>
            <button
              type="button"
              className="action-btn"
              data-testid="detail-prepare-approval-btn"
              disabled={slipLoading}
              onClick={() => void onRequestApprovalSlip(selectedInvoice.id)}
            >
              {slipLoading ? 'Preparing...' : 'Review approval slip'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              data-testid="detail-edit-draft-btn"
              onClick={() => onEditDraft(selectedInvoice)}
            >
              Edit draft
            </button>
          </>
        )}

        {/* Operational Completion Action */}
        {!isCancelled && !isCompleted && (
          <button
            type="button"
            className="secondary-btn"
            data-testid="mark-completed-btn"
            disabled={completeSubmitting}
            onClick={() => setConfirmCompleteOpen(true)}
            title="Mark operational work or deliverables as fulfilled"
          >
            {completeSubmitting ? 'Marking completed...' : '✓ Mark as completed'}
          </button>
        )}

        {isCompleted && (
          <span
            className="status-pill"
            data-tone="paid"
            style={{ fontWeight: 600 }}
            title={selectedInvoice.completedAt ? `Completed on ${selectedInvoice.completedAt}` : 'Work completed'}
          >
            ✓ Work Completed
          </span>
        )}

        {!isPaid && !isCancelled && (
          <button
            type="button"
            className="action-btn"
            data-testid="invoice-remind-btn"
            onClick={() => onOpenReminderDraft(selectedInvoice)}
          >
            Draft reminder
          </button>
        )}

        {selectedInvoice.providerInvoiceId && (
          <button
            type="button"
            className="secondary-btn"
            data-testid="detail-refresh-provider-btn"
            disabled={providerRefreshing}
            onClick={() => void onRefreshProviderStatus(selectedInvoice.id)}
          >
            {providerRefreshing ? 'Refreshing...' : '↻ Refresh PayPal status'}
          </button>
        )}

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
          data-testid="toolbar-download-pdf-btn"
          disabled={downloadingPdf}
          onClick={() => void handleDownloadPdf()}
        >
          {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
        </button>
      </div>

      {/* Confirmation Modal for Marking as Completed */}
      {confirmCompleteOpen && (
        <div
          className="auth-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-complete-title"
          data-testid="confirm-complete-dialog"
        >
          <div className="auth-modal-sheet" style={{ maxWidth: '440px' }}>
            <h3 id="confirm-complete-title" className="serif-document" style={{ marginTop: 0 }}>
              Mark Invoice #{selectedInvoice.invoiceNumber} Completed?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
              This flags the invoice as <strong>operationally completed</strong>, confirming that all deliverables and services have been fulfilled.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', background: 'var(--sheet-2)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--rule)' }}>
              <strong>Note:</strong> Operational completion is separate from payment. Unpaid invoices remain tracked until settled.
            </p>
            <div className="btn-row" style={{ marginTop: '1.25rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setConfirmCompleteOpen(false)}
                disabled={completeSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="action-btn"
                data-testid="confirm-mark-completed-btn"
                disabled={completeSubmitting}
                onClick={async () => {
                  await onMarkCompleted(selectedInvoice.id);
                  setConfirmCompleteOpen(false);
                }}
              >
                {completeSubmitting ? 'Completing...' : 'Confirm Completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Feedback & Error Banners */}
      {completeSuccess && (
        <div
          role="status"
          data-testid="complete-invoice-feedback"
          className="feedback-banner"
          data-tone="success"
          style={{ marginBottom: '1rem' }}
        >
          {completeSuccess}
        </div>
      )}
      {completeError && (
        <div
          role="alert"
          data-testid="complete-invoice-error"
          className="feedback-banner"
          data-tone="error"
          style={{ marginBottom: '1rem' }}
        >
          {completeError}
        </div>
      )}

      {/* Lifecycle Timeline */}
      <div
        className="timeline-strip"
        data-testid="invoice-timeline"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '0.625rem 0.875rem',
          background: 'var(--sheet-2)',
          border: '1px solid var(--rule)',
          borderRadius: '4px',
          marginBottom: '1rem',
          fontSize: '0.8125rem'
        }}
      >
        <div className="timeline-step" data-done="true">
          ✓ <strong>Created:</strong> {selectedInvoice.createdAt.slice(0, 10)}
        </div>
        <div className="timeline-step" data-done={isSent}>
          {isSent ? '✓' : '○'} <strong>Sent:</strong> {selectedInvoice.providerInvoiceId ? 'PayPal' : isSent ? 'Sent' : 'Draft'}
        </div>
        <div
          className="timeline-step"
          data-done={selectedInvoice.providerStatus === 'VIEWED' || isPaid}
        >
          {selectedInvoice.providerStatus === 'VIEWED' || isPaid ? '✓' : '○'}{' '}
          <strong>Viewed:</strong> {selectedInvoice.providerStatus === 'VIEWED' ? 'Yes' : isPaid ? 'Yes' : 'Awaiting'}
        </div>
        <div className="timeline-step" data-done={isPaid}>
          {isPaid ? '✓' : '○'} <strong>Payment:</strong> {isPaid ? 'Settled' : paidAmount > 0 ? 'Partial' : 'Unpaid'}
        </div>
        <div className="timeline-step" data-done={isCompleted}>
          {isCompleted ? '✓' : '○'} <strong>Work:</strong> {isCompleted ? 'Completed' : 'In Progress'}
        </div>
      </div>

      {/* Status Overview Grid */}
      <div
        className="form-grid tabular-nums"
        style={{
          marginBottom: '1.25rem',
          padding: '0.875rem',
          background: 'var(--sheet-2)',
          border: '1px solid var(--rule)',
          borderRadius: '4px',
          gap: '0.75rem 1rem'
        }}
      >
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Lifecycle Status</span>
          <span
            data-testid="detail-local-status"
            className="status-pill"
            data-tone={isSent ? 'paid' : isCancelled ? 'late' : 'draft'}
          >
            {selectedInvoice.localStatus}
          </span>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Payment Settlement</span>
          <span
            data-testid="detail-provider-status"
            className="status-pill"
            data-tone={isPaid ? 'paid' : paidAmount > 0 ? 'caution' : 'draft'}
          >
            {selectedInvoice.providerStatus}
          </span>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Operational Work</span>
          <span
            data-testid="detail-operational-status"
            className="status-pill"
            data-tone={isCompleted ? 'paid' : 'draft'}
          >
            {isCompleted ? 'COMPLETED' : 'IN PROGRESS'}
          </span>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Issue Date</span>
          <span data-testid="detail-issue-date" style={{ fontWeight: 500 }}>
            {selectedInvoice.issueDate}
          </span>
        </div>
        <div>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Due Date</span>
          <span data-testid="detail-due-date" style={{ fontWeight: 500 }}>
            {selectedInvoice.dueDate}
          </span>
        </div>
        {selectedInvoice.providerInvoiceId && (
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>PayPal Invoice ID</span>
            <code data-testid="detail-provider-invoice-id" style={{ fontSize: '0.8125rem' }}>
              {selectedInvoice.providerInvoiceId}
            </code>
          </div>
        )}
        {selectedInvoice.lastProviderSyncAt && (
          <div>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Last Provider Sync</span>
            <span data-testid="detail-provider-sync-at" style={{ fontSize: '0.8125rem' }}>
              {selectedInvoice.lastProviderSyncAt.slice(0, 19).replace('T', ' ')}
            </span>
          </div>
        )}
        {selectedInvoice.providerRecipientViewUrl && (
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>PayPal Payment Link</span>
            <a
              href={selectedInvoice.providerRecipientViewUrl}
              target="_blank"
              rel="noreferrer"
              data-testid="detail-recipient-view-url"
              style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}
            >
              {selectedInvoice.providerRecipientViewUrl}
            </a>
          </div>
        )}
      </div>

      {/* Line Items Table */}
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
                  <strong>{formatMoneyFromMinor(it.lineTotalMinor, it.currencyCode)}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedInvoice.notes && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }} data-testid="detail-invoice-notes">
          <strong>Notes:</strong> {selectedInvoice.notes}
        </p>
      )}

      {/* Totals Summary */}
      <div className="totals-summary tabular-nums" style={{ marginTop: '1rem' }}>
        <div className="totals-row">
          <span>Subtotal:</span>
          <span data-testid="detail-invoice-subtotal">
            {formatMoneyFromMinor(selectedInvoice.subtotalMinor, selectedInvoice.currencyCode)}
          </span>
        </div>
        <div className="totals-row">
          <span>Tax ({(selectedInvoice.taxRateBps / 100).toFixed(2)}%):</span>
          <span data-testid="detail-invoice-tax">
            {formatMoneyFromMinor(selectedInvoice.taxMinor, selectedInvoice.currencyCode)}
          </span>
        </div>
        <div className="totals-row totals-row-grand">
          <span>Total Billed:</span>
          <span data-testid="detail-invoice-total">
            {formatMoneyFromMinor(selectedInvoice.totalMinor, selectedInvoice.currencyCode)}
          </span>
        </div>

        {paidAmount > 0 && (
          <div className="totals-row">
            <span>Paid to Date:</span>
            <span data-testid="detail-invoice-paid" style={{ color: 'var(--paid)' }}>
              {formatMoneyFromMinor(paidAmount, selectedInvoice.currencyCode)}
            </span>
          </div>
        )}

        <div className="totals-row">
          <span>Balance Outstanding:</span>
          <span
            data-testid="detail-invoice-outstanding"
            style={{
              fontWeight: 'bold',
              color: isPaid ? 'var(--paid)' : 'var(--primary)'
            }}
          >
            {formatMoneyFromMinor(outstandingAmount, selectedInvoice.currencyCode)}
          </span>
        </div>
      </div>

      {/* Record Manual / Partial Payment */}
      {!isPaid && (
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
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9375rem' }}>
            Record Manual or Partial Payment
          </h4>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
            Enter payment received in {selectedInvoice.currencyCode}. Verified server-side and recorded in minor units.
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
              style={{ color: 'var(--late)', fontSize: '0.8125rem', margin: '0.5rem 0 0 0' }}
              data-testid="partial-payment-error"
            >
              {partialPaymentError}
            </p>
          )}
        </div>
      )}
      {partialPaymentSuccess && (
        <p
          style={{ color: 'var(--paid)', fontSize: '0.8125rem', margin: '0.75rem 0 0 0' }}
          data-testid="partial-payment-success"
        >
          {partialPaymentSuccess}
        </p>
      )}
    </section>
  );
};
