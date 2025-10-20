/**
 * Test file for currency-utils.js
 * Run with: npm test -- currency-utils.test.js
 */

import { formatCurrency } from './currency-utils';

describe('formatCurrency', () => {
  describe('Decimal handling', () => {
    test('should not show decimals for whole dollar amounts', () => {
      expect(formatCurrency(100)).toBe('$100');
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(1234)).toBe('$1,234');
    });

    test('should show decimals when cents are present', () => {
      expect(formatCurrency(100.50)).toBe('$100.50');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0.99)).toBe('$0.99');
      expect(formatCurrency(12345.67)).toBe('$12,345.67');
    });

    test('should handle zero correctly', () => {
      expect(formatCurrency(0)).toBe('$0');
    });

    test('should handle small decimal amounts', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.10)).toBe('$0.10');
    });
  });

  describe('Thousands separators', () => {
    test('should add commas for thousands', () => {
      expect(formatCurrency(1000)).toBe('$1,000');
      expect(formatCurrency(10000)).toBe('$10,000');
      expect(formatCurrency(100000)).toBe('$100,000');
      expect(formatCurrency(1000000)).toBe('$1,000,000');
    });

    test('should add commas with decimals', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(12345.67)).toBe('$12,345.67');
    });
  });

  describe('Symbol handling', () => {
    test('should show symbol by default', () => {
      expect(formatCurrency(100)).toBe('$100');
    });

    test('should hide symbol when showSymbol is false', () => {
      expect(formatCurrency(100, 'USD', false)).toBe('100');
      expect(formatCurrency(100.50, 'USD', false)).toBe('100.50');
    });
  });

  describe('Negative amounts', () => {
    test('should handle negative whole amounts', () => {
      expect(formatCurrency(-100)).toBe('-$100');
      expect(formatCurrency(-1234)).toBe('-$1,234');
    });

    test('should handle negative decimal amounts', () => {
      expect(formatCurrency(-100.50)).toBe('-$100.50');
      expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
    });
  });

  describe('Invalid input handling', () => {
    test('should handle NaN', () => {
      expect(formatCurrency('invalid')).toBe('$0');
    });

    test('should handle null/undefined', () => {
      expect(formatCurrency(null)).toBe('$0');
      expect(formatCurrency(undefined)).toBe('$0');
    });
  });

  describe('Multi-currency support', () => {
    test('should format EUR correctly without decimals', () => {
      expect(formatCurrency(1000, 'EUR')).toBe('1.000€');
    });

    test('should format EUR correctly with decimals', () => {
      expect(formatCurrency(1234.56, 'EUR')).toBe('1.234,56€');
    });

    test('should format GBP correctly without decimals', () => {
      expect(formatCurrency(1000, 'GBP')).toBe('£1,000');
    });

    test('should format GBP correctly with decimals', () => {
      expect(formatCurrency(1234.56, 'GBP')).toBe('£1,234.56');
    });

    test('should format JPY correctly (no decimals for JPY)', () => {
      expect(formatCurrency(1000, 'JPY')).toBe('¥1,000');
      expect(formatCurrency(1234.56, 'JPY')).toBe('¥1,235'); // Rounds
    });
  });
});
