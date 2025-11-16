/**
 * Theme manager utility
 * - Applies theme by setting `data-theme` attribute on `document.documentElement`
 * - Broadcasts theme changes via `localStorage` event for other tabs
 * - Provides helpers to get/apply default theme
 */

const PREFERENCES_KEY = 'biensperience:preferences';

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  if (!theme) return;
  try {
    // Resolve system-default to actual preference (light/dark)
    let applied = theme;
    if (theme === 'system-default') {
      try {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        applied = prefersDark ? 'dark' : 'light';
      } catch (e) {
        applied = 'light';
      }
    }

    document.documentElement.setAttribute('data-theme', applied);
    // Persist to localStorage so other tabs can pick it up. Store both
    // the user's preference and the applied effective theme.
    try {
      // Keep the preferences blob in sync when possible
      try {
        const raw = localStorage.getItem(PREFERENCES_KEY);
        let prefs = {};
        if (raw) {
          try { prefs = JSON.parse(raw) || {}; } catch (e) { prefs = {}; }
        }
        prefs.theme = theme;
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
