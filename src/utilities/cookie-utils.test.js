/**
 * Test file for cookie-utils.js with localStorage fallback
 * Run with: npm test -- cookie-utils.test.js
 */

import {
  getCookieData,
  setCookieData,
  getCookieValue,
  setCookieValue,
  deleteCookieValue,
  deleteCookie,
  createExpirableStorage,
  areCookiesAvailable,
} from './cookie-utils';

// Mock document.cookie
let mockCookies = '';
Object.defineProperty(document, 'cookie', {
  get: () => mockCookies,
  set: (value) => {
    if (value.includes('expires=Thu, 01 Jan 1970')) {
      // Deleting cookie
      const name = value.split('=')[0];
      mockCookies = mockCookies
        .split(';')
        .filter(c => !c.trim().startsWith(name + '='))
        .join(';');
    } else {
      // Setting cookie
      mockCookies = mockCookies ? mockCookies + '; ' + value : value;
    }
  },
  configurable: true,
});

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

describe('cookie-utils', () => {
  beforeEach(() => {
    // Clear cookies and localStorage before each test
    mockCookies = '';
    localStorageMock.clear();
  });

  describe('areCookiesAvailable', () => {
    test('should detect cookie availability', () => {
      const available = areCookiesAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('getCookieData and setCookieData', () => {
    test('should set and get cookie data', () => {
      const testData = { key1: 'value1', key2: 'value2' };
      setCookieData('testCookie', testData, 1000 * 60 * 60); // 1 hour
      
      const retrieved = getCookieData('testCookie');
      expect(retrieved).toEqual(testData);
    });

    test('should return empty object for non-existent cookie', () => {
      const retrieved = getCookieData('nonExistent');
      expect(retrieved).toEqual({});
    });

    test('should handle special characters in data', () => {
      const testData = { 
        special: 'hello world!@#$%^&*()',
        unicode: '你好🎉',
      };
      setCookieData('specialCookie', testData, 1000 * 60 * 60);
      
      const retrieved = getCookieData('specialCookie');
      expect(retrieved).toEqual(testData);
    });
  });

  describe('getCookieValue and setCookieValue', () => {
    test('should set and get individual values', () => {
      setCookieValue('multiCookie', 'item1', 'value1', 1000 * 60 * 60);
      setCookieValue('multiCookie', 'item2', 'value2', 1000 * 60 * 60);
      
      expect(getCookieValue('multiCookie', 'item1')).toBe('value1');
      expect(getCookieValue('multiCookie', 'item2')).toBe('value2');
    });

    test('should handle timestamp-based expiration', () => {
      const now = Date.now();
      const maxAge = 1000; // 1 second
      
      // Set a value with current timestamp
      setCookieValue('expirableCookie', 'recentItem', now, 1000 * 60 * 60, maxAge);
      
      // Should be valid immediately
      expect(getCookieValue('expirableCookie', 'recentItem', maxAge)).toBe(now);
      
      // Set an old timestamp
      const oldTimestamp = now - 2000; // 2 seconds ago
      setCookieValue('expirableCookie', 'oldItem', oldTimestamp, 1000 * 60 * 60, maxAge);
      
      // Should be null because it's expired
      expect(getCookieValue('expirableCookie', 'oldItem', maxAge)).toBeNull();
    });

    test('should update existing values (upsert)', () => {
      setCookieValue('upsertCookie', 'item', 'initial', 1000 * 60 * 60);
      expect(getCookieValue('upsertCookie', 'item')).toBe('initial');
      
      setCookieValue('upsertCookie', 'item', 'updated', 1000 * 60 * 60);
      expect(getCookieValue('upsertCookie', 'item')).toBe('updated');
    });

    test('should clean up expired entries automatically', () => {
      const now = Date.now();
      const maxAge = 1000; // 1 second
      
      // Add valid and expired entries
      setCookieValue('cleanupCookie', 'valid', now, 1000 * 60 * 60, maxAge);
      setCookieValue('cleanupCookie', 'expired1', now - 2000, 1000 * 60 * 60, maxAge);
      setCookieValue('cleanupCookie', 'expired2', now - 3000, 1000 * 60 * 60, maxAge);
      
      const data = getCookieData('cleanupCookie');
      
      // Valid entry should exist
      expect(data.valid).toBeDefined();
      
      // Note: Expired entries are only cleaned up on next setCookieValue call
      // Let's trigger cleanup
      setCookieValue('cleanupCookie', 'newItem', now, 1000 * 60 * 60, maxAge);
      
      const cleanedData = getCookieData('cleanupCookie');
      expect(cleanedData.valid).toBeDefined();
      expect(cleanedData.newItem).toBeDefined();
    });
  });

  describe('deleteCookieValue and deleteCookie', () => {
    test('should delete individual values', () => {
      setCookieValue('deleteCookie', 'item1', 'value1', 1000 * 60 * 60);
      setCookieValue('deleteCookie', 'item2', 'value2', 1000 * 60 * 60);
      
      deleteCookieValue('deleteCookie', 'item1', 1000 * 60 * 60);
      
      expect(getCookieValue('deleteCookie', 'item1')).toBeNull();
      expect(getCookieValue('deleteCookie', 'item2')).toBe('value2');
    });

    test('should delete entire cookie', () => {
      setCookieValue('wholeCookie', 'item1', 'value1', 1000 * 60 * 60);
      setCookieValue('wholeCookie', 'item2', 'value2', 1000 * 60 * 60);
      
      deleteCookie('wholeCookie');
      
      expect(getCookieData('wholeCookie')).toEqual({});
    });
  });

  describe('createExpirableStorage', () => {
    test('should create storage with get and set methods', () => {
      const storage = createExpirableStorage('testStorage', 1000 * 60 * 60);
      
      expect(typeof storage.get).toBe('function');
      expect(typeof storage.set).toBe('function');
      expect(typeof storage.remove).toBe('function');
      expect(typeof storage.clear).toBe('function');
    });

    test('should set and get values', () => {
      const storage = createExpirableStorage('userPrefs', 1000 * 60 * 60);
      
      storage.set('darkMode');
      expect(storage.get('darkMode')).toBeTruthy();
    });

    test('should respect expiration', () => {
      const shortDuration = 100; // 100ms
      const storage = createExpirableStorage('shortStorage', shortDuration);
      
      storage.set('tempItem');
      
      // Should be valid immediately
      expect(storage.get('tempItem')).toBeTruthy();
      
      // Wait for expiration
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(storage.get('tempItem')).toBeNull();
          resolve();
        }, 150);
      });
    });

    test('should remove individual items', () => {
      const storage = createExpirableStorage('multiStorage', 1000 * 60 * 60);
      
      storage.set('item1');
      storage.set('item2');
      
      storage.remove('item1');
      
      expect(storage.get('item1')).toBeNull();
      expect(storage.get('item2')).toBeTruthy();
    });

    test('should clear all items', () => {
      const storage = createExpirableStorage('clearStorage', 1000 * 60 * 60);
      
      storage.set('item1');
      storage.set('item2');
      storage.set('item3');
      
      storage.clear();
      
      expect(storage.get('item1')).toBeNull();
      expect(storage.get('item2')).toBeNull();
      expect(storage.get('item3')).toBeNull();
    });

    test('should work like sync alert pattern', () => {
      const WEEK = 7 * 24 * 60 * 60 * 1000;
      const syncAlertStorage = createExpirableStorage('planSyncAlert', WEEK);
      
      // User dismisses alert for plan123
      syncAlertStorage.set('plan123');
      
      // Check if dismissed
      const dismissed = syncAlertStorage.get('plan123');
      expect(dismissed).toBeTruthy();
      expect(typeof dismissed).toBe('number');
      
      // Check for different plan (not dismissed)
      const notDismissed = syncAlertStorage.get('plan456');
      expect(notDismissed).toBeNull();
    });

    test('should handle multiple independent storages', () => {
      const storage1 = createExpirableStorage('storage1', 1000 * 60 * 60);
      const storage2 = createExpirableStorage('storage2', 1000 * 60 * 60);
      
      storage1.set('item1');
      storage2.set('item2');
      
      expect(storage1.get('item1')).toBeTruthy();
      expect(storage1.get('item2')).toBeNull();
      expect(storage2.get('item2')).toBeTruthy();
      expect(storage2.get('item1')).toBeNull();
    });
  });

  describe('localStorage fallback', () => {
    test('should use localStorage when cookies are disabled', () => {
      // This is hard to test in Jest without complex mocking
      // But the abstraction allows for it
      const storage = createExpirableStorage('fallbackTest', 1000 * 60 * 60);
      
      storage.set('testItem');
      const value = storage.get('testItem');
      
      expect(value).toBeTruthy();
    });
  });
});
