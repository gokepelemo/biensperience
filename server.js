/**
 * Main Server Entry Point for Biensperience.
 * Starts the Express server on the configured port.
 *
 * @module server
 */

const app = require('./app');
const backendLogger = require('./utilities/backend-logger');

const port = process.env.PORT || 3001;

app.listen(port, function () {
  backendLogger.info('Express app started', { port, environment: process.env.NODE_ENV || 'development' });
});
