/**
 * API Token Authentication Middleware
 *
 * Checks for API tokens in the Authorization header and authenticates users.
 * API tokens bypass CSRF protection and use Bearer authentication.
 *
 * @module api-token-middleware
 */

const ApiToken = require('../models/apiToken');
const backendLogger = require('./backend-logger');

/**
 * Middleware to check for API token authentication
 * Sets req.user and req.isApiToken if token is valid
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
async function checkApiToken(req, res, next) {
  // Only check for API tokens if no JWT is already present
  if (req.user) {
    return next();
  }

  // Check Authorization header for Bearer token
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');

  // Check if this looks like an API token (64 hex characters)
  // JWTs typically have 3 parts separated by dots
  const isApiToken = /^[a-f0-9]{64}$/i.test(token);

  if (!isApiToken) {
    // This is likely a JWT, let the JWT middleware handle it
    return next();
  }

  try {
    // Find user by API token
    const user = await ApiToken.findUserByToken(token);

    if (!user) {
      backendLogger.warn('Invalid API token used', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        tokenPrefix: token.substring(0, 8)
      });
      return next(); // Continue without authentication
    }

    // Check if API access is enabled for this user
    if (!user.apiEnabled) {
      backendLogger.warn('API access disabled for user', {
        userId: user._id,
        email: user.email,
        ip: req.ip
      });
      return res.status(403).json({
        error: 'API access is disabled for your account. Please enable it in your profile settings.'
      });
    }

    // Set user on request object
    req.user = user;
    req.isApiToken = true; // Flag to indicate this is API token auth (for CSRF bypass)

    backendLogger.info('API token authentication successful', {
      userId: user._id,
      email: user.email,
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    return next();
  } catch (error) {
    backendLogger.error('Error checking API token', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    return next(); // Continue without authentication on error
  }
}

module.exports = checkApiToken;
