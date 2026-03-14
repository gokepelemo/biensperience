import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
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

initVersion();

// Preserve deep-link hashes for Router
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

// Migrate legacy plan cache keys
try {
  migratePlanCacheFromSessionStorage();
} catch (e) {
  // ignore
}

// Migrate legacy form draft keys
try {
  migrateFormDraftsFromLegacyStorage().catch(() => {});
} catch (e) {
  // ignore
}

// Migrate legacy preference keys
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
