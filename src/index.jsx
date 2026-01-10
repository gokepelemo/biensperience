import React from 'react';
import ReactDOM from 'react-dom/client';
// Import Bootstrap CSS BEFORE our custom styles so our overrides work without !important
import './styles/bootstrap-custom.scss';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.scss';
// Initialize cross-tab event bridge
import './utilities/event-bus';
// Initialize version system (exposes version.show() to console)
import { initVersion } from './utilities/version';
import App from './views/App/App';
import { StrictMode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import themeManager from './utilities/theme-manager';
import { migratePlanCacheFromSessionStorage } from './utilities/plan-cache';
import { migrateFormDraftsFromLegacyStorage } from './utilities/form-persistence';
import { migratePreferencesToBienNamespace } from './utilities/preferences-utils';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from './utilities/storage-keys';

// Initialize version display (shows in demo mode, always available via version.show())
initVersion();

// Preserve deep-link hashes across initial Router mount.
// Some environments can lose the hash during early navigation; we stash it and
// let the target view restore it once fully loaded.
try {
  const hash = window.location.hash || '';
  const key = STORAGE_KEYS.pendingHash;
  if (hash.startsWith('#plan-')) {
    window.localStorage?.setItem(key, hash);
  } else {
    window.localStorage?.removeItem(key);
  }

  // Remove legacy variants if present
  for (const legacyKey of LEGACY_STORAGE_KEYS.pendingHash) {
    try { window.localStorage?.removeItem(legacyKey); } catch (e) {}
  }
} catch (err) {
  // ignore
}

// Proactively migrate legacy plan_* sessionStorage keys to consolidated localStorage.
try {
  migratePlanCacheFromSessionStorage();
} catch (e) {
  // ignore
}

// Proactively migrate legacy __form* keys into consolidated bien:formDrafts:* buckets.
try {
  migrateFormDraftsFromLegacyStorage().catch(() => {});
} catch (e) {
  // ignore
}

// Proactively migrate legacy biensperience:* preference keys to bien:*.
try {
  migratePreferencesToBienNamespace();
} catch (e) {
  // ignore
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Apply stored theme (if any) before rendering for immediate effect
try {
  // Prefer hydrated theme from user preferences (if present)
  const stored = themeManager.getHydratedTheme ? themeManager.getHydratedTheme() : themeManager.getStoredTheme();
  if (stored) themeManager.applyTheme(stored);
} catch (err) {
  // ignore
}
root.render(
  <StrictMode>
    <ToastProvider>
      <Router future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}><App /></Router>
    </ToastProvider>
  </StrictMode>
);
