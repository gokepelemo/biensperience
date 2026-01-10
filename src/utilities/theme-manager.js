/**
 * Theme manager utility
 * - Applies theme by setting `data-theme` attribute on `document.documentElement`
 * - Broadcasts theme changes via `localStorage` event for other tabs
 * - Provides helpers to get/apply default theme
 */

import { logger } from './logger';

const THEME_STATE_KEY = 'bien:themeState';

const _OBFUSCATION_KEY_BYTES = new TextEncoder().encode('bien:base_prefs:v1');

function _base64Encode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function _base64Decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function _xorTransform(inputBytes) {
  const out = new Uint8Array(inputBytes.length);
  for (let i = 0; i < inputBytes.length; i++) {
    out[i] = inputBytes[i] ^ _OBFUSCATION_KEY_BYTES[i % _OBFUSCATION_KEY_BYTES.length];
  }
  return out;
}

function _obfuscateString(plainText) {
  const bytes = new TextEncoder().encode(String(plainText ?? ''));
  return _base64Encode(_xorTransform(bytes));
}

function _deobfuscateString(encoded) {
  if (!encoded || typeof encoded !== 'string') return null;
  try {
    const bytes = _base64Decode(encoded);
    const original = _xorTransform(bytes);
    return new TextDecoder().decode(original);
  } catch {
    return null;
  }
}

function _persistThemeState(theme) {
  try {
    const payload = {
      theme: theme || 'system-default',
      lastApplied: Date.now()
    };
    localStorage.setItem(THEME_STATE_KEY, _obfuscateString(JSON.stringify(payload)));
  } catch (e) {
    // ignore
  }
}

function _readThemeState() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STATE_KEY);
    if (!stored) return null;
    const json = _deobfuscateString(stored);
    if (!json) return null;
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

let _mediaQuery = null;
let _mediaHandler = null;

function _resolveEffective(theme) {
  if (theme === 'system-default') {
    try {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    } catch (e) {
      return 'light';
    }
  }
  return theme;
}

// Core token sets to apply as inline styles when user explicitly chooses a theme.
const LIGHT_TOKENS = {
  '--color-text-primary': '#1a202c',
  '--color-text-secondary': '#2d3748',
  '--color-text-tertiary': '#4a5568',
  '--color-text-muted': '#5a6370',
  '--color-bg-primary': '#ffffff',
  '--color-bg-secondary': '#f8f9fa',
  '--color-bg-tertiary': '#e9ecef',
  '--color-bg-hover': 'rgba(102, 126, 234, 0.05)',
  '--color-bg-overlay': 'rgba(0, 0, 0, 0.75)',
  '--color-bg-input': '#ffffff',
  '--color-border-light': 'rgba(0, 0, 0, 0.05)',
  '--color-border-medium': 'rgba(0, 0, 0, 0.1)',
  '--color-border-dark': 'rgba(0, 0, 0, 0.2)',
  '--color-primary': '#667eea',
  '--color-primary-dark': '#764ba2',
};

const DARK_TOKENS = {
  '--color-text-primary': '#E6EEF8',
  '--color-text-secondary': '#CBD5E1',
  '--color-text-tertiary': '#94A3B8',
  '--color-text-muted': '#94A3B8',
  '--color-bg-primary': '#071024',
  '--color-bg-secondary': '#0B1220',
  '--color-bg-tertiary': '#0F1724',
  '--color-bg-hover': 'rgba(255,255,255,0.04)',
  '--color-bg-overlay': 'rgba(0, 0, 0, 0.75)',
  '--color-bg-input': '#071024',
  '--color-border-light': 'rgba(255,255,255,0.04)',
  '--color-border-medium': 'rgba(255,255,255,0.06)',
  '--color-border-dark': 'rgba(255,255,255,0.10)',
  '--color-primary': '#7c5cff',
  '--color-primary-dark': '#6b47ff',
};

function _applyInlineTokens(applied) {
  try {
    const rootStyle = document.documentElement.style;
    if (applied === 'dark') {
      Object.entries(DARK_TOKENS).forEach(([k, v]) => rootStyle.setProperty(k, v));
    } else if (applied === 'light') {
      Object.entries(LIGHT_TOKENS).forEach(([k, v]) => rootStyle.setProperty(k, v));
    }
  } catch (e) {
    // ignore
  }
}

function _removeInlineTokens() {
  try {
    const rootStyle = document.documentElement.style;
    Object.keys(LIGHT_TOKENS).forEach(k => rootStyle.removeProperty(k));
    Object.keys(DARK_TOKENS).forEach(k => rootStyle.removeProperty(k));
  } catch (e) {
    // ignore
  }
}

function _ensureMediaListener(theme) {
  // If preference is system-default, attach listener to propagate changes
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

  // Remove existing listener if any and preference not system-default
  if (theme !== 'system-default') {
    if (_mediaQuery && _mediaHandler) {
      try {
        if (_mediaQuery.removeEventListener) _mediaQuery.removeEventListener('change', _mediaHandler);
        else if (_mediaQuery.removeListener) _mediaQuery.removeListener(_mediaHandler);
      } catch (e) { /* ignore */ }
      _mediaQuery = null;
      _mediaHandler = null;
    }
    return;
  }

  // If already listening, keep it
  if (_mediaQuery && _mediaHandler) return;

  try {
    _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    _mediaHandler = () => {
      const applied = _mediaQuery.matches ? 'dark' : 'light';
      try {
        document.documentElement.setAttribute('data-theme', applied);
        try { document.documentElement.setAttribute('data-bs-theme', applied); } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      // Touch preferences blob to notify other tabs that effective theme changed
      try {
        _persistThemeState('system-default');
      } catch (err) { /* ignore */ }
    };

    if (_mediaQuery.addEventListener) _mediaQuery.addEventListener('change', _mediaHandler);
    else if (_mediaQuery.addListener) _mediaQuery.addListener(_mediaHandler);
  } catch (e) {
    _mediaQuery = null;
    _mediaHandler = null;
  }
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (!theme) return;
  try {
    // Resolve system-default to actual preference (light/dark)
    const applied = _resolveEffective(theme);

    document.documentElement.setAttribute('data-theme', applied);
    try { document.documentElement.setAttribute('data-bs-theme', applied); } catch (e) { /* ignore */ }

    // Manage media listener based on preference
    try { _ensureMediaListener(theme); } catch (e) { /* ignore */ }

    // If the user explicitly chose light/dark (not system-default) apply inline tokens
    try {
      if (theme === 'system-default') {
        // For system-default, remove inline tokens so media queries and data-theme take effect
        _removeInlineTokens();
      } else {
        _applyInlineTokens(applied);
      }
    } catch (e) { /* ignore */ }

    // Persist to localStorage so other tabs can pick it up. Store the user's preference
    // (e.g., 'system-default') so other tabs will resolve the effective theme themselves.
    try {
      _persistThemeState(theme);
    } catch (e) {
      // ignore localStorage failures
    }
  } catch (err) {
    // ignore in environments without DOM
    logger.warn('applyTheme: failed to apply theme', { error: err.message || err });
  }
}

export function getStoredTheme() {
  try {
    const state = _readThemeState();
    return typeof state?.theme === 'string' ? state.theme : null;
  } catch {
    return null;
  }
}

// Prefer the preferences key first, then THEME_KEY — useful for startup hydration
export function getHydratedTheme() {
  return getStoredTheme();
}

// Listen for cross-tab theme changes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    try {
      if (e.key === THEME_STATE_KEY && e.newValue) {
        const json = _deobfuscateString(e.newValue);
        if (!json) return;
        const payload = JSON.parse(json);
        if (payload && typeof payload.theme === 'string') applyTheme(payload.theme);
      }
    } catch (err) {
      // ignore
    }
  });
}

export default {
  applyTheme,
  getStoredTheme,
  getHydratedTheme,
};
