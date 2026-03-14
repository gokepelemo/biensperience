/**
 * Jest setup for frontend tests
 */

// TextEncoder/TextDecoder are needed by theme-manager.js and encoding-utils.js
// jsdom (Jest 27) does not include these globals by default.
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill structuredClone for Node < 17 / jsdom
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

require('@testing-library/jest-dom');

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock CustomEvent
global.CustomEvent = class CustomEvent extends Event {
  constructor(event, params) {
    super(event, params);
    this.detail = params?.detail;
  }
};

// Mock window.dispatchEvent
window.dispatchEvent = jest.fn();

// Mock crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  }
});

// Mock logger utility
jest.mock('../src/utilities/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn()
  }
}));

// Mock UserContext — many design-system components call useFeatureFlag → useUser
jest.mock('../src/contexts/UserContext', () => ({
  useUser: jest.fn(() => ({
    user: null,
    loading: false,
    error: null,
    fetchUser: jest.fn(),
    setUser: jest.fn(),
  })),
  UserProvider: ({ children }) => children,
}));

// Mock useFeatureFlag — used by FeatureFlag component and useGatedAction hook
jest.mock('../src/hooks/useFeatureFlag', () => ({
  __esModule: true,
  default: jest.fn(() => ({ enabled: false, config: null })),
  useFeatureFlag: jest.fn(() => ({ enabled: false, config: null })),
  useGatedAction: jest.fn((flag, action) => action),
}));

// Mock NavigationIntentContext — uses import.meta.hot which Jest 27 cannot parse
jest.mock('../src/contexts/NavigationIntentContext', () => ({
  INTENT_TYPES: { DEEP_LINK: 'deep-link', CROSS_VIEW: 'cross-view', SAME_PAGE: 'same-page' },
  useNavigationIntent: jest.fn(() => ({
    intent: null,
    createIntent: jest.fn(),
    clearIntent: jest.fn(),
    consumeIntent: jest.fn(),
  })),
  NavigationIntentProvider: ({ children }) => children,
}));
