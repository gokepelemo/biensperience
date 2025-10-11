/**
 * Main Server Entry Point for Biensperience.
 * Starts the Express server on the configured port.
 *
 * @module server
 */

const app = require('./app');

const port = process.env.PORT || 3001;

app.listen(port, function () {
  console.log(`Express app running on ${port}`);
});
