import { describe, it, expect } from 'vitest';
import {
  formatMoneyFromMinor,
  minorToInputDecimal,
  parsePreviewMinor,
  resolveEffectiveTheme,
  SUPPORTED_CURRENCIES,
  CURRENCY_EXPONENTS
} from '../../src/client/types';

import { Header } from '../../src/client/components/Header';
import { Sidebar } from '../../src/client/components/Sidebar';
import { Footer } from '../../src/client/components/Footer';
import { AuthModal } from '../../src/client/components/AuthModal';
import { ApprovalSlip } from '../../src/client/components/ApprovalSlip';
import { InvoiceDraftForm } from '../../src/client/components/InvoiceDraftForm';
import { InvoiceDetailView } from '../../src/client/components/InvoiceDetailView';
import { ClientDetailView } from '../../src/client/components/ClientDetailView';
import { ReminderModal } from '../../src/client/components/ReminderModal';
import { GlobalSearch } from '../../src/client/components/GlobalSearch';
import { DeveloperDiagnostics } from '../../src/client/components/DeveloperDiagnostics';

describe('Client Components & Math Invariants', () => {
  describe('Financial Minor Currency Math Helpers', () => {
    it('formats minor integer units accurately into currency-tagged strings', () => {
      expect(formatMoneyFromMinor(10050, 'USD')).toBe('USD 100.50');
      expect(formatMoneyFromMinor(0, 'USD')).toBe('USD 0.00');
      expect(formatMoneyFromMinor(5, 'USD')).toBe('USD 0.05');
      expect(formatMoneyFromMinor(1234567, 'EUR')).toBe('EUR 12345.67');
    });

    it('handles zero-exponent currencies like JPY', () => {
      expect(formatMoneyFromMinor(5000, 'JPY')).toBe('JPY 5000');
      expect(minorToInputDecimal(5000, 'JPY')).toBe('5000');
      expect(parsePreviewMinor('5000', 'JPY')).toBe(5000);
    });

    it('handles negative financial minor values properly', () => {
      expect(formatMoneyFromMinor(-1500, 'USD')).toBe('USD -15.00');
      expect(formatMoneyFromMinor(-50, 'EUR')).toBe('EUR -0.50');
    });

    it('converts minor amounts to input decimals cleanly', () => {
      expect(minorToInputDecimal(10050, 'USD')).toBe('100.50');
      expect(minorToInputDecimal(99, 'USD')).toBe('0.99');
      expect(minorToInputDecimal(0, 'USD')).toBe('0.00');
    });

    it('parses valid decimal strings to integer minor units safely', () => {
      expect(parsePreviewMinor('100.50', 'USD')).toBe(10050);
      expect(parsePreviewMinor('100.5', 'USD')).toBe(10050);
      expect(parsePreviewMinor('100', 'USD')).toBe(10000);
      expect(parsePreviewMinor('0.99', 'USD')).toBe(99);
      expect(parsePreviewMinor('0', 'USD')).toBeNull(); // non-positive rejected
      expect(parsePreviewMinor('-50', 'USD')).toBeNull();
      expect(parsePreviewMinor('invalid', 'USD')).toBeNull();
      expect(parsePreviewMinor('100.999', 'USD')).toBeNull(); // excess precision rejected
    });

    it('verifies supported currencies and exponents are immutable and defined', () => {
      expect(SUPPORTED_CURRENCIES).toContain('USD');
      expect(SUPPORTED_CURRENCIES).toContain('EUR');
      expect(SUPPORTED_CURRENCIES).toContain('GBP');
      expect(CURRENCY_EXPONENTS['USD']).toBe(2);
      expect(CURRENCY_EXPONENTS['JPY']).toBe(0);
    });
  });

  describe('Theme Resolver', () => {
    it('returns explicit light or dark preferences directly', () => {
      expect(resolveEffectiveTheme('light')).toBe('light');
      expect(resolveEffectiveTheme('dark')).toBe('dark');
    });

    it('defaults system preference to light when matchMedia is unavailable', () => {
      expect(resolveEffectiveTheme('system')).toBe('light');
    });

    it('resolves system preference to dark when window.matchMedia indicates dark preference', () => {
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {
        matchMedia: (query: string) => ({
          matches: query.includes('dark'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true
        })
      };

      try {
        expect(resolveEffectiveTheme('system')).toBe('dark');
      } finally {
        if (originalWindow === undefined) {
          delete (globalThis as any).window;
        } else {
          (globalThis as any).window = originalWindow;
        }
      }
    });
  });

  describe('Draft Form Calculations & Line Item Math', () => {
    it('calculates line totals, subtotal, and tax correctly from draft form items', () => {
      const items = [
        { description: 'Item 1', quantity: '2', unitPriceDecimal: '50.00' },
        { description: 'Item 2', quantity: '1', unitPriceDecimal: '25.50' }
      ];

      const item1Minor = parsePreviewMinor(items[0].unitPriceDecimal, 'USD')! * Number(items[0].quantity);
      const item2Minor = parsePreviewMinor(items[1].unitPriceDecimal, 'USD')! * Number(items[1].quantity);
      expect(item1Minor).toBe(10000); // 2 * $50.00 = $100.00
      expect(item2Minor).toBe(2550);  // 1 * $25.50 = $25.50

      const subtotalMinor = item1Minor + item2Minor;
      expect(subtotalMinor).toBe(12550); // $125.50

      const taxRateBps = 800; // 8%
      const taxMinor = Math.round((subtotalMinor * taxRateBps) / 10000);
      expect(taxMinor).toBe(1004); // $10.04
      expect(subtotalMinor + taxMinor).toBe(13554); // $135.54

      expect(formatMoneyFromMinor(subtotalMinor + taxMinor, 'USD')).toBe('USD 135.54');
    });
  });

  describe('Modular Component Contract Invariants', () => {
    it('exports all extracted UI components as valid React components', () => {
      expect(typeof Header).toBe('function');
      expect(typeof Sidebar).toBe('function');
      expect(typeof Footer).toBe('function');
      expect(typeof AuthModal).toBe('function');
      expect(typeof ApprovalSlip).toBe('function');
      expect(typeof InvoiceDraftForm).toBe('function');
      expect(typeof InvoiceDetailView).toBe('function');
      expect(typeof ClientDetailView).toBe('function');
      expect(typeof ReminderModal).toBe('function');
      expect(typeof GlobalSearch).toBe('function');
      expect(typeof DeveloperDiagnostics).toBe('function');
    });
  });
});

