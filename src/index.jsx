import React from 'react';
import ReactDOM from 'react-dom/client';
// Import Bootstrap CSS BEFORE our custom styles so our overrides work without !important
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
// Initialize cross-tab event bridge
import './utilities/event-bus';
import App from './views/App/App';
import { StrictMode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import themeManager from './utilities/theme-manager';

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
