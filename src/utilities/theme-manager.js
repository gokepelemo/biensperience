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
    document.documentElement.setAttribute('data-theme', theme);
    // Persist to localStorage so other tabs can pick it up
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify({ theme, ts: Date.now() }));
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
    return obj && obj.theme ? obj.theme : null;
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
