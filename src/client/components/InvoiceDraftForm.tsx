import React from 'react';
import type { ClientDto, DraftFormItem, TemplatePresetDto } from '../types';
import { formatMoneyFromMinor, SUPPORTED_CURRENCIES } from '../types';

export interface InvoiceDraftFormProps {
  invoiceFormMode: 'create' | 'edit';
  draftInvoiceNumber: string;
  setDraftInvoiceNumber: (num: string) => void;
  draftClientId: string;
  setDraftClientId: (id: string) => void;
  draftCurrency: string;
  setDraftCurrency: (curr: string) => void;
  draftTaxPercent: string;
  setDraftTaxPercent: (tax: string) => void;
  draftIssueDate: string;
  setDraftIssueDate: (date: string) => void;
  draftDueDate: string;
  setDraftDueDate: (date: string) => void;
  draftNotes: string;
  setDraftNotes: (notes: string) => void;
  draftItems: DraftFormItem[];
  handleAddDraftItem: () => void;
  handleUpdateDraftItem: (index: number, patch: Partial<DraftFormItem>) => void;
  handleRemoveDraftItem: (index: number) => void;
  handleSelectTemplatePreset: (templateId: string) => void;
  handleSaveInvoiceDraft: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  invoiceFormError: string | null;
  invoiceFormSubmitting: boolean;
  clients: ClientDto[];
  templates: TemplatePresetDto[];
  previewCalc: {
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    itemLineMinors: Array<number | null>;
  };
}

export const InvoiceDraftForm: React.FC<InvoiceDraftFormProps> = ({
  invoiceFormMode,
  draftInvoiceNumber,
  setDraftInvoiceNumber,
  draftClientId,
  setDraftClientId,
  draftCurrency,
  setDraftCurrency,
  draftTaxPercent,
  setDraftTaxPercent,
  draftIssueDate,
  setDraftIssueDate,
  draftDueDate,
  setDraftDueDate,
  draftNotes,
  setDraftNotes,
  draftItems,
  handleAddDraftItem,
  handleUpdateDraftItem,
  handleRemoveDraftItem,
  handleSelectTemplatePreset,
  handleSaveInvoiceDraft,
  onCancel,
  invoiceFormError,
  invoiceFormSubmitting,
  clients,
  templates,
  previewCalc
}) => {
  const previewClient = clients.find((c) => c.id === draftClientId);

  return (
    <div>
      <form
        className="ledger-form"
        data-testid="invoice-draft-form"
        onSubmit={(e) => void handleSaveInvoiceDraft(e)}
        noValidate
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }} className="serif-document">
          {invoiceFormMode === 'edit'
            ? `Edit local invoice draft (${draftInvoiceNumber})`
            : 'Create local invoice draft (Non-AI conventional form)'}
        </h3>

        {invoiceFormError && (
          <div
            role="alert"
            data-testid="invoice-form-error"
            className="feedback-banner"
            data-tone="error"
          >
            {invoiceFormError}
          </div>
        )}

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="invoice-client-select" className="form-label">
              Client
            </label>
            <select
              id="invoice-client-select"
              className="form-select"
              data-testid="invoice-client-select"
              value={draftClientId}
              onChange={(e) => setDraftClientId(e.target.value)}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} {c.companyName ? `(${c.companyName})` : ''} &mdash; {c.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="invoice-number-input" className="form-label">
              Invoice number
            </label>
            <input
              id="invoice-number-input"
              type="text"
              className="form-input tabular-nums"
              data-testid="invoice-number-input"
              value={draftInvoiceNumber}
              onChange={(e) => setDraftInvoiceNumber(e.target.value)}
              placeholder="INV-2026-1002"
            />
          </div>

          <div className="form-field">
            <label htmlFor="invoice-currency-select" className="form-label">
              Currency (ISO-4217)
            </label>
            <select
              id="invoice-currency-select"
              className="form-select tabular-nums"
              data-testid="invoice-currency-select"
              value={draftCurrency}
              onChange={(e) => setDraftCurrency(e.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="invoice-tax-input" className="form-label">
              Tax rate (%)
            </label>
            <input
              id="invoice-tax-input"
              type="text"
              className="form-input tabular-nums"
              data-testid="invoice-tax-input"
              value={draftTaxPercent}
              onChange={(e) => setDraftTaxPercent(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="form-field">
            <label htmlFor="invoice-issue-date-input" className="form-label">
              Issue date (YYYY-MM-DD)
            </label>
            <input
              id="invoice-issue-date-input"
              type="text"
              className="form-input tabular-nums"
              data-testid="invoice-issue-date-input"
              value={draftIssueDate}
              onChange={(e) => setDraftIssueDate(e.target.value)}
              placeholder="2026-10-31"
            />
          </div>

          <div className="form-field">
            <label htmlFor="invoice-due-date-input" className="form-label">
              Due date (YYYY-MM-DD)
            </label>
            <input
              id="invoice-due-date-input"
              type="text"
              className="form-input tabular-nums"
              data-testid="invoice-due-date-input"
              value={draftDueDate}
              onChange={(e) => setDraftDueDate(e.target.value)}
              placeholder="2026-11-14"
            />
          </div>
        </div>

        <div className="line-items-section">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.5rem'
            }}
          >
            <span className="form-label">Line items</span>
            <button
              type="button"
              className="secondary-btn"
              data-testid="add-line-item-btn"
              onClick={handleAddDraftItem}
            >
              + Add line item
            </button>
          </div>

          {templates.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              <label
                htmlFor="template-preset-select"
                className="form-label"
                style={{ margin: 0, fontSize: '0.8125rem' }}
              >
                Template preset:
              </label>
              <select
                id="template-preset-select"
                data-testid="template-preset-select"
                className="form-select"
                style={{ maxWidth: '320px', padding: '0.3rem 0.5rem', fontSize: '0.8125rem' }}
                defaultValue=""
                onChange={(e) => {
                  handleSelectTemplatePreset(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">-- Insert item from preset --</option>
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name} ({formatMoneyFromMinor(tmpl.unitPriceMinor, tmpl.currencyCode)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {draftItems.map((item, idx) => {
            const previewLineMinor = previewCalc.itemLineMinors[idx];
            return (
              <div key={idx} className="line-item-row" data-testid={`draft-item-row-${idx}`}>
                <div className="form-field">
                  <label htmlFor={`item-desc-${idx}`} className="form-label">
                    Description #{idx + 1}
                  </label>
                  <input
                    id={`item-desc-${idx}`}
                    type="text"
                    className="form-input"
                    data-testid={`item-desc-${idx}`}
                    value={item.description}
                    onChange={(e) =>
                      handleUpdateDraftItem(idx, { description: e.target.value })
                    }
                    placeholder="Deliverable or service description"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`item-qty-${idx}`} className="form-label">
                    Qty
                  </label>
                  <input
                    id={`item-qty-${idx}`}
                    type="text"
                    className="form-input tabular-nums"
                    data-testid={`item-qty-${idx}`}
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateDraftItem(idx, { quantity: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor={`item-price-${idx}`} className="form-label">
                    Unit price ({draftCurrency})
                  </label>
                  <input
                    id={`item-price-${idx}`}
                    type="text"
                    className="form-input tabular-nums"
                    data-testid={`item-price-${idx}`}
                    value={item.unitPriceDecimal}
                    onChange={(e) =>
                      handleUpdateDraftItem(idx, { unitPriceDecimal: e.target.value })
                    }
                  />
                </div>

                <div className="form-field">
                  <span className="form-label">Line preview</span>
                  <div
                    className="tabular-nums"
                    data-testid={`item-line-preview-${idx}`}
                    style={{ padding: '0.45rem 0', fontWeight: 600 }}
                  >
                    {previewLineMinor !== null
                      ? formatMoneyFromMinor(previewLineMinor, draftCurrency)
                      : 'Invalid'}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className="secondary-btn"
                    data-testid={`remove-item-${idx}`}
                    disabled={draftItems.length <= 1}
                    onClick={() => handleRemoveDraftItem(idx)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-field" style={{ marginBottom: '1rem' }}>
          <label htmlFor="invoice-notes-input" className="form-label">
            Invoice notes / payment terms
          </label>
          <textarea
            id="invoice-notes-input"
            className="form-textarea"
            data-testid="invoice-notes-input"
            value={draftNotes}
            onChange={(e) => setDraftNotes(e.target.value)}
            placeholder="Optional scope notes or payment instructions"
          />
        </div>

        <div className="btn-row">
          <button
            type="submit"
            className="action-btn"
            data-testid="save-invoice-draft-btn"
            disabled={invoiceFormSubmitting}
          >
            {invoiceFormSubmitting
              ? 'Saving draft...'
              : invoiceFormMode === 'edit'
              ? 'Update local draft'
              : 'Save local draft'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            data-testid="cancel-invoice-form-btn"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>

      <aside
        className="paper-preview-sheet serif-document"
        aria-label="Live paper invoice preview"
        data-testid="invoice-paper-preview"
      >
        <div className="paper-preview-header">
          <div>
            <span className="approval-slip-highlight">
              BROWSER PREVIEW ONLY &mdash; SERVER RECALCULATES ON SAVE
            </span>
            <h3 style={{ margin: '0.25rem 0' }}>
              Invoice Preview: {draftInvoiceNumber || 'Untitled Draft'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Bill to:{' '}
              <strong>
                {previewClient
                  ? `${previewClient.fullName}${
                      previewClient.companyName ? ` (${previewClient.companyName})` : ''
                    }`
                  : 'Unselected client'}
              </strong>
            </p>
          </div>
          <div className="tabular-nums" style={{ textAlign: 'right', fontSize: '0.9rem' }}>
            <div>Issue: {draftIssueDate || '—'}</div>
            <div>Due: {draftDueDate || '—'}</div>
            <div>Status: LOCAL DRAFT (Not Sent to PayPal)</div>
          </div>
        </div>

        <div className="totals-summary tabular-nums">
          <div className="totals-row">
            <span>Preview subtotal:</span>
            <span data-testid="preview-subtotal">
              {formatMoneyFromMinor(previewCalc.subtotalMinor, draftCurrency)}
            </span>
          </div>
          <div className="totals-row">
            <span>Preview tax ({draftTaxPercent || '0'}%):</span>
            <span data-testid="preview-tax">
              {formatMoneyFromMinor(previewCalc.taxMinor, draftCurrency)}
            </span>
          </div>
          <div className="totals-row totals-row-grand">
            <span>Preview total:</span>
            <span data-testid="preview-total">
              {formatMoneyFromMinor(previewCalc.totalMinor, draftCurrency)}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
};

