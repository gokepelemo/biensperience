import React from 'react';
import ReactDOM from 'react-dom/client';
// Import Bootstrap CSS BEFORE our custom styles so our overrides work without !important
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './index.css';
import App from './views/App/App';
import { StrictMode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
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
