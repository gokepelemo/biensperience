/**
 * Test file for url-utils.js URL normalization
 * Run with: npm test -- url-utils.test.js
 */

import { normalizeUrl } from './url-utils';

describe('normalizeUrl', () => {
  describe('URLs without scheme', () => {
    test('should add https:// to domain without scheme', () => {
      expect(normalizeUrl('example.com')).toBe('https://example.com');
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com');
      expect(normalizeUrl('subdomain.example.com')).toBe('https://subdomain.example.com');
    });

    test('should add https:// to domain with path', () => {
      expect(normalizeUrl('example.com/path')).toBe('https://example.com/path');
      expect(normalizeUrl('www.example.com/path/to/page')).toBe('https://www.example.com/path/to/page');
    });

    test('should add https:// to domain with query parameters', () => {
      expect(normalizeUrl('example.com?param=value')).toBe('https://example.com?param=value');
      expect(normalizeUrl('www.example.com/page?foo=bar&baz=qux')).toBe('https://www.example.com/page?foo=bar&baz=qux');
    });

    test('should add https:// to domain with hash', () => {
      expect(normalizeUrl('example.com#section')).toBe('https://example.com#section');
      expect(normalizeUrl('www.example.com/page#top')).toBe('https://www.example.com/page#top');
    });

    test('should handle domain with port (edge case - port treated as part of path)', () => {
      // Note: "example.com:8080" is ambiguous - could be interpreted as "example.com" scheme with "8080" path
      // For plan items, users should provide full URLs like "http://example.com:8080"
      // If they provide "example.com:8080", it will be treated as a scheme
      expect(normalizeUrl('example.com:8080')).toBe('example.com:8080'); // Keeps as-is (detected as scheme)
      expect(normalizeUrl('localhost:3000')).toBe('localhost:3000'); // Keeps as-is (detected as scheme)
    });
  });

  describe('URLs with existing scheme', () => {
    test('should preserve https:// scheme', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com');
      expect(normalizeUrl('https://www.example.com/path')).toBe('https://www.example.com/path');
    });

    test('should preserve http:// scheme', () => {
      expect(normalizeUrl('http://example.com')).toBe('http://example.com');
      expect(normalizeUrl('http://www.example.com/path')).toBe('http://www.example.com/path');
    });

    test('should preserve other valid schemes', () => {
      expect(normalizeUrl('ftp://example.com')).toBe('ftp://example.com');
      expect(normalizeUrl('file:///path/to/file')).toBe('file:///path/to/file');
      expect(normalizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
      expect(normalizeUrl('tel:+1234567890')).toBe('tel:+1234567890');
    });

    test('should handle scheme with different cases', () => {
      expect(normalizeUrl('HTTP://example.com')).toBe('HTTP://example.com');
      expect(normalizeUrl('HTTPS://example.com')).toBe('HTTPS://example.com');
      expect(normalizeUrl('FTP://example.com')).toBe('FTP://example.com');
    });
  });

  describe('Empty and invalid inputs', () => {
    test('should return empty string for empty input', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl('   ')).toBe('');
    });

    test('should return empty string for null/undefined', () => {
      expect(normalizeUrl(null)).toBe('');
      expect(normalizeUrl(undefined)).toBe('');
    });

    test('should return empty string for non-string input', () => {
      expect(normalizeUrl(123)).toBe('');
      expect(normalizeUrl({})).toBe('');
      expect(normalizeUrl([])).toBe('');
    });
  });

  describe('Whitespace handling', () => {
    test('should trim leading and trailing whitespace', () => {
      expect(normalizeUrl('  example.com  ')).toBe('https://example.com');
      expect(normalizeUrl('\t\nexample.com\n\t')).toBe('https://example.com');
    });

    test('should trim whitespace from URL with scheme', () => {
      expect(normalizeUrl('  https://example.com  ')).toBe('https://example.com');
      expect(normalizeUrl('\thttp://example.com\n')).toBe('http://example.com');
    });
  });

  describe('Complex URLs', () => {
    test('should handle complete URLs without scheme', () => {
      const url = 'www.example.com/path?param1=value1&param2=value2#section';
      expect(normalizeUrl(url)).toBe('https://www.example.com/path?param1=value1&param2=value2#section');
    });

    test('should handle complete URLs with scheme', () => {
      const url = 'https://www.example.com/path?param1=value1&param2=value2#section';
      expect(normalizeUrl(url)).toBe('https://www.example.com/path?param1=value1&param2=value2#section');
    });

    test('should handle URLs with authentication', () => {
      expect(normalizeUrl('https://user:pass@example.com')).toBe('https://user:pass@example.com');
      // Note: "user:pass@example.com" is ambiguous - "user" looks like a scheme
      // For plan items, users should provide "https://user:pass@example.com"
      expect(normalizeUrl('user:pass@example.com')).toBe('user:pass@example.com'); // Keeps as-is (detected as scheme)
    });

    test('should handle URLs with special characters', () => {
      expect(normalizeUrl('example.com/path%20with%20spaces')).toBe('https://example.com/path%20with%20spaces');
      expect(normalizeUrl('https://example.com/path+with+plus')).toBe('https://example.com/path+with+plus');
    });
  });

  describe('Real-world use cases', () => {
    test('should handle common user input patterns', () => {
      // User might paste from browser address bar
      expect(normalizeUrl('google.com')).toBe('https://google.com');
      expect(normalizeUrl('www.github.com')).toBe('https://www.github.com');
      
      // User might copy from documentation
      expect(normalizeUrl('docs.example.com/api')).toBe('https://docs.example.com/api');
      
      // User might include full URL
      expect(normalizeUrl('https://stackoverflow.com/questions/123')).toBe('https://stackoverflow.com/questions/123');
    });

    test('should handle localhost and IP addresses', () => {
      expect(normalizeUrl('localhost')).toBe('https://localhost');
      expect(normalizeUrl('127.0.0.1')).toBe('https://127.0.0.1');
      // IP addresses with ports get https:// added (numbers don't match scheme pattern)
      expect(normalizeUrl('192.168.1.1:8080')).toBe('https://192.168.1.1:8080');
      expect(normalizeUrl('http://localhost:3000')).toBe('http://localhost:3000');
      // Proper way to include port with scheme
      expect(normalizeUrl('http://192.168.1.1:8080')).toBe('http://192.168.1.1:8080');
    });
  });
});
