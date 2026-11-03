import React from 'react';
import type { ClientDto, InvoiceDto } from '../types';

export interface ClientDetailViewProps {
  selectedClient: ClientDto;
  invoices: InvoiceDto[];
  selectedClientInvoices: InvoiceDto[];
  formatMoneyFromMinor: (minor: number, currency: string) => string;
  onBack: () => void;
  onEdit: (client: ClientDto) => void;
  onDraftInvoice: (clientId: string) => void;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({
  selectedClient,
  invoices,
  selectedClientInvoices,
  formatMoneyFromMinor,
  onBack,
  onEdit,
  onDraftInvoice,
}) => {
  const clientInvs = invoices.filter((i) => i.clientId === selectedClient.id);
  const billed = clientInvs
    .filter((i) => i.localStatus !== 'CANCELLED')
    .reduce((sum, i) => sum + i.totalMinor, 0);
  const paid = clientInvs
    .filter((i) => i.providerStatus === 'PAID')
    .reduce((sum, i) => sum + i.totalMinor, 0);
  const outstanding = billed - paid;

  const todayStr = new Date().toISOString().slice(0, 10);
  const hasLate = clientInvs.some(
    (i) => i.dueDate < todayStr && i.localStatus !== 'DRAFT' && i.providerStatus !== 'PAID'
  );
  const reliability =
    clientInvs.length === 0
      ? 'New client'
      : hasLate
      ? 'Sometimes late'
      : 'Pays on time';

  return (
    <section
      className="paper-preview-sheet"
      aria-label="Client profile detail"
      data-testid="client-detail-panel"
    >
      <div className="paper-preview-header">
        <div>
          <span className="approval-slip-highlight">CLIENT PROFILE RECORD</span>
          <h3
            style={{ margin: '0.25rem 0' }}
            className="serif-document"
            data-testid="detail-client-name"
          >
            {selectedClient.fullName}
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }} data-testid="detail-client-meta">
            {selectedClient.companyName ? `${selectedClient.companyName} • ` : ''}
            {selectedClient.email} • Default Currency: {selectedClient.defaultCurrency}
          </p>

          <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <span
              className="status-pill"
              data-testid="client-reliability-badge"
              data-tone={reliability === 'Pays on time' ? 'paid' : reliability === 'Sometimes late' ? 'late' : 'caution'}
            >
              Reliability: {reliability}
            </span>
            <span className="tabular-nums" data-testid="client-metric-billed" style={{ fontSize: '0.875rem' }}>
              Total billed: <strong>{formatMoneyFromMinor(billed, selectedClient.defaultCurrency)}</strong>
            </span>
            <span className="tabular-nums" data-testid="client-metric-paid" style={{ fontSize: '0.875rem' }}>
              Total paid: <strong>{formatMoneyFromMinor(paid, selectedClient.defaultCurrency)}</strong>
            </span>
            <span className="tabular-nums" data-testid="client-metric-outstanding" style={{ fontSize: '0.875rem' }}>
              Outstanding: <strong>{formatMoneyFromMinor(outstanding, selectedClient.defaultCurrency)}</strong>
            </span>
          </div>
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="secondary-btn"
            data-testid="back-to-clients-btn"
            onClick={onBack}
          >
            &larr; Back to clients
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="detail-edit-client-btn"
            onClick={() => onEdit(selectedClient)}
          >
            Edit client
          </button>
          <button
            type="button"
            className="action-btn"
            data-testid="client-draft-invoice-btn"
            onClick={() => onDraftInvoice(selectedClient.id)}
          >
            Draft new invoice
          </button>
          <button
            type="button"
            className="action-btn"
            data-testid="draft-for-client-btn"
            onClick={() => onDraftInvoice(selectedClient.id)}
          >
            Draft invoice for client
          </button>
        </div>
      </div>

      {selectedClient.notes && (
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }} data-testid="detail-client-notes">
          <strong>Notes:</strong> {selectedClient.notes}
        </p>
      )}

      <h4 style={{ margin: '0.75rem 0 0.5rem 0', fontSize: '0.9rem' }}>
        Invoices for {selectedClient.fullName} ({selectedClientInvoices.length})
      </h4>
      {selectedClientInvoices.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
          No invoices recorded for this client yet.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
          {selectedClientInvoices.map((inv) => (
            <li key={inv.id} className="tabular-nums">
              <strong>{inv.invoiceNumber}</strong> —{' '}
              {formatMoneyFromMinor(inv.totalMinor, inv.currencyCode)} ({inv.localStatus})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

