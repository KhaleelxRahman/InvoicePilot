import React from 'react';
import type { ApprovalSlipDto, PendingActionDto } from '../types';
import { formatMoneyFromMinor } from '../types';

export interface ApprovalSlipProps {
  activeAction: PendingActionDto;
  activeSlip: ApprovalSlipDto;
  slipFeedback: string | null;
  slipError: string | null;
  slipLoading: boolean;
  onEditDraft: () => void;
  onRejectSlip: () => Promise<void>;
  onApproveSlip: () => Promise<void>;
  onExecuteApprovedSlip: () => Promise<void>;
  onClose: () => void;
}

export const ApprovalSlip: React.FC<ApprovalSlipProps> = ({
  activeAction,
  activeSlip,
  slipFeedback,
  slipError,
  slipLoading,
  onEditDraft,
  onRejectSlip,
  onApproveSlip,
  onExecuteApprovedSlip,
  onClose
}) => {
  return (
    <section
      className="approval-slip-sheet"
      aria-label="Paper approval slip"
      data-testid="approval-slip-panel"
    >
      <div className="approval-slip-top">
        <div>
          <span className="approval-slip-highlight">HUMAN APPROVAL SLIP</span>
          <h3
            style={{ margin: '0.25rem 0' }}
            className="serif-document"
            data-testid="slip-invoice-heading"
          >
            Approval Slip for Invoice {activeSlip.invoiceNumber}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }} data-testid="slip-client-summary">
            Client: <strong>{activeSlip.clientFullName}</strong>
            {activeSlip.clientCompanyName ? ` (${activeSlip.clientCompanyName})` : ''} &bull;{' '}
            {activeSlip.clientEmail}
          </p>
          <p
            style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--ink-muted)' }}
            className="tabular-nums"
          >
            Action ID: <code data-testid="slip-action-id">{activeAction.id}</code> | Fresh until:{' '}
            <span data-testid="slip-expires-at">{activeAction.expiresAt}</span>
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            className="approval-stamp"
            data-state={activeAction.state}
            data-testid="approval-slip-state"
          >
            {activeAction.state}
          </div>
        </div>
      </div>

      {slipFeedback && (
        <div
          role="status"
          data-testid="slip-feedback-banner"
          className="feedback-banner"
          data-tone="success"
        >
          {slipFeedback}
        </div>
      )}

      {slipError && (
        <div
          role="alert"
          data-testid="slip-error-alert"
          className="feedback-banner"
          data-tone="error"
        >
          {slipError}
        </div>
      )}

      <div className="form-grid tabular-nums" style={{ marginBottom: '1rem' }}>
        <div>
          <strong>Currency:</strong>{' '}
          <span data-testid="slip-currency">{activeSlip.currencyCode}</span>
        </div>
        <div>
          <strong>Issue date:</strong>{' '}
          <span data-testid="slip-issue-date">{activeSlip.issueDate}</span>
        </div>
        <div>
          <strong>Due date:</strong>{' '}
          <span data-testid="slip-due-date">{activeSlip.dueDate}</span>
        </div>
        <div>
          <strong>Provider target:</strong>{' '}
          <span data-testid="slip-provider-mode">
            {activeSlip.providerMode === 'sandbox' ? 'PayPal Sandbox' : 'Local Mock Adapter'}
          </span>
        </div>
      </div>

      <div className="ledger-table-wrap">
        <table
          className="ledger-table serif-document"
          aria-label="Approval slip line items"
          data-testid="slip-items-table"
        >
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
            {activeSlip.items.map((it, idx) => (
              <tr key={idx}>
                <td className="tabular-nums">{idx + 1}</td>
                <td>{it.description}</td>
                <td className="tabular-nums">{it.quantity}</td>
                <td className="tabular-nums">
                  {formatMoneyFromMinor(it.unitAmountMinor, activeSlip.currencyCode)}
                </td>
                <td className="tabular-nums">
                  <strong>
                    {formatMoneyFromMinor(it.lineTotalMinor, activeSlip.currencyCode)}
                  </strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals-summary tabular-nums serif-document">
        <div className="totals-row">
          <span>Subtotal:</span>
          <span data-testid="slip-subtotal">
            {formatMoneyFromMinor(activeSlip.subtotalMinor, activeSlip.currencyCode)}
          </span>
        </div>
        <div className="totals-row">
          <span>Tax ({(activeSlip.taxRateBps / 100).toFixed(2)}%):</span>
          <span data-testid="slip-tax">
            {formatMoneyFromMinor(activeSlip.taxMinor, activeSlip.currencyCode)}
          </span>
        </div>
        <div className="totals-row totals-row-grand">
          <span>Total Amount to Send:</span>
          <span data-testid="slip-total">
            {formatMoneyFromMinor(activeSlip.totalMinor, activeSlip.currencyCode)}
          </span>
        </div>
      </div>

      <div className="slip-warning-box" data-testid="slip-warnings-box">
        <strong style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem' }}>
          Safety &amp; Review Warnings
        </strong>
        <ul
          style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem' }}
          data-testid="slip-warnings-list"
        >
          {activeSlip.warnings.map((w, idx) => (
            <li key={idx}>{w}</li>
          ))}
        </ul>
      </div>

      <div className="slip-consequence-box" data-testid="slip-what-will-happen">
        <strong>What will happen upon approval &amp; execution:</strong>{' '}
        {activeSlip.whatWillHappen}
      </div>

      <div className="btn-row" style={{ marginTop: '1rem' }}>
        {activeAction.state !== 'EXECUTED' && (
          <button
            type="button"
            className="secondary-btn"
            data-testid="slip-edit-draft-btn"
            disabled={slipLoading}
            onClick={onEditDraft}
          >
            Edit draft
          </button>
        )}

        {(activeAction.state === 'PENDING_APPROVAL' ||
          activeAction.state === 'APPROVED') && (
          <button
            type="button"
            className="danger-btn"
            data-testid="slip-reject-btn"
            disabled={slipLoading}
            onClick={() => void onRejectSlip()}
          >
            Reject / discard slip
          </button>
        )}

        {activeAction.state === 'PENDING_APPROVAL' && (
          <button
            type="button"
            className="action-btn"
            data-testid="slip-approve-btn"
            disabled={slipLoading}
            onClick={() => void onApproveSlip()}
          >
            {slipLoading ? 'Processing...' : 'Approve slip'}
          </button>
        )}

        {activeAction.state === 'APPROVED' && (
          <button
            type="button"
            className="action-btn"
            data-testid="slip-execute-btn"
            disabled={slipLoading}
            onClick={() => void onExecuteApprovedSlip()}
          >
            {slipLoading ? 'Executing send...' : 'Execute approved send'}
          </button>
        )}

        <button
          type="button"
          className="secondary-btn"
          data-testid="slip-close-btn"
          onClick={onClose}
        >
          Close slip
        </button>
      </div>
    </section>
  );
};

