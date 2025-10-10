import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './views/App/App';
import { StrictMode } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <StrictMode>
    <Router><App /></Router>
  </StrictMode>
);
