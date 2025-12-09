/**
 * Main Server Entry Point for Biensperience.
 * Starts the Express server with optional WebSocket support.
 *
 * WebSocket Configuration:
 * - WEBSOCKET_ENABLED: Set to 'true' to enable WebSocket server (default: false)
 * - WEBSOCKET_PATH: WebSocket endpoint path (default: '/ws')
 *
 * @module server
 */

const http = require('http');
const app = require('./app');
const backendLogger = require('./utilities/backend-logger');
const { updateExchangeRates } = require('./utilities/exchange-rate-updater');

const port = process.env.PORT || 3001;
const wsEnabled = process.env.WEBSOCKET_ENABLED === 'true';

// Update exchange rates on server start (async, non-blocking)
updateExchangeRates()
  .then(success => {
    if (success) {
      backendLogger.info('Exchange rates updated successfully');
    } else {
      backendLogger.warn('Exchange rates update skipped or failed, using existing fallback rates');
    }
  })
  .catch(err => {
    backendLogger.error('Exchange rates update error', { error: err.message });
  });

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize WebSocket server if enabled
if (wsEnabled) {
  const { createWebSocketServer, getStats } = require('./utilities/websocket-server');
  const wsPath = process.env.WEBSOCKET_PATH || '/ws';

  createWebSocketServer(server, { path: wsPath });

  // Add WebSocket stats endpoint
  app.get('/api/ws-stats', (req, res) => {
    // Only super admins can view WebSocket stats
    if (!req.user || !req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(getStats());
  });

  backendLogger.info('WebSocket server enabled', { path: wsPath });
}

server.listen(port, function () {
  backendLogger.info('Server started', {
    port,
    environment: process.env.NODE_ENV || 'development',
    websocket: wsEnabled ? 'enabled' : 'disabled'
  });
});
