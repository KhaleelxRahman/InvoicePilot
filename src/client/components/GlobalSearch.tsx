import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { InvoiceDto, ClientDto } from '../App';
import { formatMoneyFromMinor } from '../App';

export interface GlobalSearchProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  invoices: InvoiceDto[];
  clients: ClientDto[];
  onSelectInvoice: (invoice: InvoiceDto) => void;
  onSelectClient: (client: ClientDto) => void;
  formatMoney?: (amountMinor: number, currencyCode: string) => string;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  searchQuery,
  onSearchChange,
  invoices,
  clients,
  onSelectInvoice,
  onSelectClient,
  formatMoney = formatMoneyFromMinor
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = searchQuery.trim().toLowerCase();

  const matchingInvoices = useMemo(() => {
    if (!trimmed) return [];
    return invoices
      .filter((inv) => {
        const client = clients.find((c) => c.id === inv.clientId);
        return (
          inv.invoiceNumber.toLowerCase().includes(trimmed) ||
          (client?.fullName.toLowerCase().includes(trimmed) ?? false) ||
          (client?.companyName?.toLowerCase().includes(trimmed) ?? false) ||
          inv.localStatus.toLowerCase().includes(trimmed) ||
          inv.currencyCode.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 5);
  }, [invoices, clients, trimmed]);

  const matchingClients = useMemo(() => {
    if (!trimmed) return [];
    return clients
      .filter((c) => {
        return (
          c.fullName.toLowerCase().includes(trimmed) ||
          (c.companyName?.toLowerCase().includes(trimmed) ?? false) ||
          c.email.toLowerCase().includes(trimmed) ||
          (c.notes?.toLowerCase().includes(trimmed) ?? false)
        );
      })
      .slice(0, 5);
  }, [clients, trimmed]);

  const flatResults = useMemo(() => {
    const list: Array<
      | { type: 'invoice'; item: InvoiceDto }
      | { type: 'client'; item: ClientDto }
    > = [];
    matchingInvoices.forEach((inv) => list.push({ type: 'invoice', item: inv }));
    matchingClients.forEach((cl) => list.push({ type: 'client', item: cl }));
    return list;
  }, [matchingInvoices, matchingClients]);

  // Global / and Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && trimmed) {
        setIsOpen(true);
      } else if (flatResults.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % flatResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatResults.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length);
      }
    } else if (e.key === 'Enter') {
      if (isOpen && selectedIndex >= 0 && selectedIndex < flatResults.length) {
        e.preventDefault();
        const selected = flatResults[selectedIndex];
        if (selected.type === 'invoice') {
          onSelectInvoice(selected.item);
        } else {
          onSelectClient(selected.item);
        }
        setIsOpen(false);
      }
    }
  };

  const showDropdown = isOpen && trimmed.length > 0;

  return (
    <div className="header-search-wrap" ref={containerRef} style={{ position: 'relative' }}>
      <svg
        className="header-search-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>

      <input
        ref={inputRef}
        type="search"
        className="header-search-input"
        data-testid="header-search-input"
        placeholder="Search invoices, clients, activities... (/ to focus)"
        value={searchQuery}
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-controls="global-search-results"
        onFocus={() => {
          if (trimmed.length > 0) setIsOpen(true);
        }}
        onChange={(e) => {
          onSearchChange(e.target.value);
          setIsOpen(true);
          setSelectedIndex(-1);
        }}
        onKeyDown={handleKeyDown}
      />

      {searchQuery.length > 0 ? (
        <button
          type="button"
          className="header-search-clear"
          data-testid="header-search-clear-btn"
          aria-label="Clear search"
          onClick={() => {
            onSearchChange('');
            setIsOpen(false);
            setSelectedIndex(-1);
            inputRef.current?.focus();
          }}
        >
          ✕
        </button>
      ) : (
        <kbd className="header-search-kbd">/</kbd>
      )}

      {showDropdown && (
        <div
          id="global-search-results"
          className="header-search-dropdown"
          data-testid="global-search-dropdown"
          role="listbox"
        >
          {flatResults.length === 0 ? (
            <div className="header-search-empty" data-testid="global-search-empty">
              No invoices or clients matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <>
              {matchingInvoices.length > 0 && (
                <div className="search-group">
                  <div className="search-group-title">Invoices</div>
                  {matchingInvoices.map((inv) => {
                    const client = clients.find((c) => c.id === inv.clientId);
                    const globalIdx = flatResults.findIndex(
                      (r) => r.type === 'invoice' && r.item.id === inv.id
                    );
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <div
                        key={inv.id}
                        role="option"
                        aria-selected={isSelected}
                        className={`header-search-item ${isSelected ? 'is-selected' : ''}`}
                        data-testid={`search-result-invoice-${inv.id}`}
                        onClick={() => {
                          onSelectInvoice(inv);
                          setIsOpen(false);
                        }}
                      >
                        <div className="search-item-primary">
                          <span className="search-item-title font-medium">{inv.invoiceNumber}</span>
                          <span className="search-item-subtitle">
                            {client?.fullName || 'Unknown Client'}
                          </span>
                        </div>
                        <div className="search-item-meta">
                          <span className="status-pill" data-tone={inv.localStatus === 'PAID' ? 'paid' : 'caution'}>
                            {inv.localStatus}
                          </span>
                          <span className="search-item-amount tabular-nums">
                            {formatMoney(inv.totalMinor, inv.currencyCode)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {matchingClients.length > 0 && (
                <div className="search-group">
                  <div className="search-group-title">Clients</div>
                  {matchingClients.map((cl) => {
                    const globalIdx = flatResults.findIndex(
                      (r) => r.type === 'client' && r.item.id === cl.id
                    );
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <div
                        key={cl.id}
                        role="option"
                        aria-selected={isSelected}
                        className={`header-search-item ${isSelected ? 'is-selected' : ''}`}
                        data-testid={`search-result-client-${cl.id}`}
                        onClick={() => {
                          onSelectClient(cl);
                          setIsOpen(false);
                        }}
                      >
                        <div className="search-item-primary">
                          <span className="search-item-title font-medium">{cl.fullName}</span>
                          {cl.companyName && (
                            <span className="search-item-subtitle">{cl.companyName}</span>
                          )}
                        </div>
                        <div className="search-item-meta">
                          <span className="search-item-email">{cl.email}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

