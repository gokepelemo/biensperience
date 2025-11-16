/**
 * Theme manager utility
 * - Applies theme by setting `data-theme` attribute on `document.documentElement`
 * - Broadcasts theme changes via `localStorage` event for other tabs
 * - Provides helpers to get/apply default theme
 */

const THEME_KEY = 'biensperience:theme';

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
      localStorage.setItem(THEME_KEY, JSON.stringify({ theme, applied, ts: Date.now() }));
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
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    // Prefer user preference if present, otherwise fall back to applied
    if (obj && typeof obj.theme === 'string') return obj.theme;
    if (obj && typeof obj.applied === 'string') return obj.applied;
    return null;
  } catch (e) {
    return null;
  }
}

// Listen for cross-tab theme changes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        if (payload && payload.theme) applyTheme(payload.theme);
      } catch (err) {
        // ignore
      }
    }
  });
}

export default {
  applyTheme,
  getStoredTheme,
};
