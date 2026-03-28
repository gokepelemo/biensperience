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

// Set trust proxy for Render/production (required for secure cookies and OAuth)
if (process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') {
  app.set('trust proxy', 1);
}
const backendLogger = require('./utilities/backend-logger');
const { updateExchangeRates } = require('./utilities/exchange-rate-updater');
const { seedAIProviders } = require('./utilities/ai-seed-providers');
const { cleanOrphanedTempFiles } = require('./utilities/temp-cleanup');
const { seedIntentCorpus } = require('./utilities/intent-corpus-seeder');

const port = process.env.PORT || 3001;
const wsEnabled = process.env.WEBSOCKET_ENABLED === 'true';

// Seed AI provider configs and default policy on startup (async, non-blocking)
seedAIProviders()
  .then(({ providers, policyCreated }) => {
    if (providers > 0 || policyCreated) {
      backendLogger.info('AI providers seeded', { providers, policyCreated });
    }
  })
  .catch(err => {
    backendLogger.warn('AI provider seed skipped', { error: err.message });
  });

// Seed intent corpus from JSON on first boot and sync new utterances (async, non-blocking)
seedIntentCorpus()
  .then(({ seeded, synced }) => {
    if (seeded > 0) {
      backendLogger.info('Intent corpus seeded', { intents: seeded });
    }
    if (synced > 0) {
      // New utterances synced — force NLP model retrain so they take effect
      const { resetManager } = require('./utilities/bienbot-intent-classifier');
      resetManager();
      backendLogger.info('Intent corpus synced, NLP model will retrain on next classification', { synced });
    }
  })
  .catch(err => {
    backendLogger.warn('Intent corpus seed skipped', { error: err.message });
  });

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

// Clean orphaned temp files on startup (async, non-blocking)
cleanOrphanedTempFiles()
  .then(({ removed, errors }) => {
    if (removed > 0 || errors > 0) {
      backendLogger.info('Orphaned temp file cleanup complete', { removed, errors });
    }
  })
  .catch(err => {
    backendLogger.warn('Temp file cleanup failed', { error: err.message });
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
