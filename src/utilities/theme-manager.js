/**
 * Theme manager utility
 * - Applies theme by setting `data-theme` attribute on `document.documentElement`
 * - Broadcasts theme changes via `localStorage` event for other tabs
 * - Provides helpers to get/apply default theme
 */

const PREFERENCES_KEY = 'biensperience:preferences';

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
        // Also set root class so CSS class-based overrides take effect
        try {
          document.documentElement.classList.remove('theme-light', 'theme-dark');
          document.documentElement.classList.add('theme-' + applied);
        } catch (e) { /* ignore */ }
      } catch (e) { /* ignore */ }

      // Touch preferences blob to notify other tabs that effective theme changed
      try {
        const raw = localStorage.getItem(PREFERENCES_KEY);
        let prefs = {};
        if (raw) {
          try { prefs = JSON.parse(raw) || {}; } catch (ee) { prefs = {}; }
        }
        // Keep user's chosen preference but add a timestamp to force storage event
        prefs.theme = 'system-default';
        prefs._lastApplied = Date.now();
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
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
    // Also set a class on the root for stronger specificity in CSS
    try {
      document.documentElement.classList.remove('theme-light', 'theme-dark');
      document.documentElement.classList.add('theme-' + applied);
    } catch (e) { /* ignore */ }

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
      try {
        const raw = localStorage.getItem(PREFERENCES_KEY);
        let prefs = {};
        if (raw) {
          try { prefs = JSON.parse(raw) || {}; } catch (e) { prefs = {}; }
        }
        prefs.theme = theme;
        // also add a timestamp for change detection
        prefs._lastApplied = Date.now();
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
      } catch (e) {
        // ignore preferences sync failures
      }
    } catch (e) {
      // ignore localStorage failures
    }
  } catch (err) {
    // ignore in environments without DOM
    // eslint-disable-next-line no-console
    console.warn('applyTheme: failed to apply theme', err.message || err);
  }
}

export function getStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    // First prefer the preferences blob if available
    const prefRaw = localStorage.getItem(PREFERENCES_KEY);
    if (prefRaw) {
      try {
        const prefs = JSON.parse(prefRaw);
        if (prefs && typeof prefs.theme === 'string') return prefs.theme;
      } catch (e) {
        // fall through to THEME_KEY
      }
    }

    return null;
  } catch (e) {
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
      if (e.key === PREFERENCES_KEY && e.newValue) {
        const payload = JSON.parse(e.newValue);
        if (payload && typeof payload.theme === 'string') {
          applyTheme(payload.theme);
        }
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
