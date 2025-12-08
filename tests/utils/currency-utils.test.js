/**
 * Test file for currency-utils.js
 * Run with: npm test -- currency-utils.test.js
 *
 * New format: {code}{symbol}{amount} (e.g., USD$100, AUD$50, JPY¥1,000)
 */

import { formatCurrency } from './currency-utils';

describe('formatCurrency', () => {
  describe('Decimal handling', () => {
    test('should not show decimals for whole dollar amounts', () => {
      expect(formatCurrency(100)).toBe('USD$100');
      expect(formatCurrency(1000)).toBe('USD$1,000');
      expect(formatCurrency(1234)).toBe('USD$1,234');
    });

    test('should show decimals when cents are present', () => {
      expect(formatCurrency(100.50)).toBe('USD$100.50');
      expect(formatCurrency(1234.56)).toBe('USD$1,234.56');
      expect(formatCurrency(0.99)).toBe('USD$0.99');
      expect(formatCurrency(12345.67)).toBe('USD$12,345.67');
    });

    test('should handle zero correctly', () => {
      expect(formatCurrency(0)).toBe('USD$0');
    });

    test('should handle small decimal amounts', () => {
      expect(formatCurrency(0.01)).toBe('USD$0.01');
      expect(formatCurrency(0.10)).toBe('USD$0.10');
    });
  });

  describe('Thousands separators', () => {
    test('should add commas for thousands', () => {
      expect(formatCurrency(1000)).toBe('USD$1,000');
      expect(formatCurrency(10000)).toBe('USD$10,000');
      expect(formatCurrency(100000)).toBe('USD$100,000');
      expect(formatCurrency(1000000)).toBe('USD$1,000,000');
    });

    test('should add commas with decimals', () => {
      expect(formatCurrency(1234.56)).toBe('USD$1,234.56');
      expect(formatCurrency(12345.67)).toBe('USD$12,345.67');
    });
  });

  describe('Symbol and code handling', () => {
    test('should show code and symbol by default', () => {
      expect(formatCurrency(100)).toBe('USD$100');
    });

    test('should hide symbol when showSymbol is false', () => {
      expect(formatCurrency(100, 'USD', false)).toBe('USD100');
      expect(formatCurrency(100.50, 'USD', false)).toBe('USD100.50');
    });

    test('should hide code when showCode is false', () => {
      expect(formatCurrency(100, 'USD', true, false)).toBe('$100');
      expect(formatCurrency(100.50, 'USD', true, false)).toBe('$100.50');
    });

    test('should hide both symbol and code when both are false', () => {
      expect(formatCurrency(100, 'USD', false, false)).toBe('100');
      expect(formatCurrency(100.50, 'USD', false, false)).toBe('100.50');
    });
  });

  describe('Negative amounts', () => {
    test('should handle negative whole amounts', () => {
      expect(formatCurrency(-100)).toBe('-USD$100');
      expect(formatCurrency(-1234)).toBe('-USD$1,234');
    });

    test('should handle negative decimal amounts', () => {
      expect(formatCurrency(-100.50)).toBe('-USD$100.50');
      expect(formatCurrency(-1234.56)).toBe('-USD$1,234.56');
    });
  });

  describe('Invalid input handling', () => {
    test('should handle NaN', () => {
      expect(formatCurrency('invalid')).toBe('USD$0');
    });

    test('should handle null/undefined', () => {
      expect(formatCurrency(null)).toBe('USD$0');
      expect(formatCurrency(undefined)).toBe('USD$0');
    });
  });

  describe('Multi-currency support', () => {
    test('should format EUR correctly without decimals', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('EUR1.000€');
    });

    test('should format EUR correctly with decimals', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('EUR1.234,56€');
    });

    test('should format GBP correctly without decimals', () => {
      expect(formatCurrency(1000, 'GBP')).toBe('GBP£1,000');
    });

    test('should format GBP correctly with decimals', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('GBP£1,234.56');
    });

    test('should format JPY correctly (no decimals for JPY)', () => {
      expect(formatCurrency(1000, 'JPY')).toBe('JPY¥1,000');
      expect(formatCurrency(1234.56, 'JPY')).toBe('JPY¥1,235'); // Rounds
    });

    test('should format AUD correctly', () => {
      expect(formatCurrency(100, 'AUD')).toBe('AUD$100');
      expect(formatCurrency(1234.56, 'AUD')).toBe('AUD$1,234.56');
    });

    test('should format CAD correctly', () => {
      expect(formatCurrency(100, 'CAD')).toBe('CAD$100');
      expect(formatCurrency(1234.56, 'CAD')).toBe('CAD$1,234.56');
    });

    test('should format INR correctly', () => {
      expect(formatCurrency(100, 'INR')).toBe('INR₹100');
      expect(formatCurrency(1234.56, 'INR')).toBe('INR₹1,234.56');
    });

    test('should format KRW correctly (no decimals)', () => {
      expect(formatCurrency(1000, 'KRW')).toBe('KRW₩1,000');
      expect(formatCurrency(1234.56, 'KRW')).toBe('KRW₩1,235'); // Rounds
    });
  });
});
