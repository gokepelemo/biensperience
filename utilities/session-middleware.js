/**
 * Session ID Middleware
 * 
 * Validates and manages session IDs for authenticated requests.
 * Session IDs (bien-session-id) are bound to users and expire after 24h by default.
 * 
 * @module session-middleware
 */

const { v4: uuidv4 } = require('uuid');
const User = require('../models/user');
const backendLogger = require('./backend-logger');

// Constants
const SESSION_ID_HEADER = 'bien-session-id';
const DEFAULT_EXPIRY_HOURS = 24;

/**
 * Get session expiry duration from environment or use default
 * @returns {number} Expiry duration in milliseconds
 */
function getSessionExpiryMs() {
  const hours = parseFloat(process.env.SESSION_EXPIRY_HOURS) || DEFAULT_EXPIRY_HOURS;
  return hours * 60 * 60 * 1000; // Convert hours to milliseconds
}

/**
 * Generate a new session ID
 * @returns {string} New session ID in format: bien-[uuid]-[timestamp]
 */
function generateSessionId() {
  const uuid = uuidv4();
  const timestamp = Date.now();
  return `bien-${uuid}-${timestamp}`;
}

/**
 * Calculate session expiry epoch time
 * @param {number} createdAt - Session creation epoch time (default: now)
 * @returns {number} Expiry epoch time
 */
function calculateExpiryEpoch(createdAt = Date.now()) {
  return createdAt + getSessionExpiryMs();
}

/**
 * Extract session ID from request headers
 * @param {Object} req - Express request object
 * @returns {string|null} Session ID or null
 */
function extractSessionId(req) {
  return req.headers[SESSION_ID_HEADER] || req.headers[SESSION_ID_HEADER.toLowerCase()] || null;
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} - True if valid format
 */
function isValidSessionIdFormat(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  // Expected format: bien-[uuid]-[timestamp]
  return /^bien-[a-f0-9-]+-\d+$/.test(sessionId);
}

/**
 * Middleware: Manage session IDs for authenticated requests
 * Validates session IDs and creates new ones when needed
 * Gracefully handles invalid/expired/missing sessions
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function manageSessionId(req, res, next) {
  try {
    // Skip session management if user not authenticated
    if (!req.user || !req.user._id) {
      return next();
    }

    const providedSessionId = extractSessionId(req);
    let validSessionId = null;
    let shouldCreateNew = false;

    // Get user from database to check current session
    const User = require('../models/user');
    const user = await User.findById(req.user._id);
    
    if (!user) {
      backendLogger.warn('User not found during session management', {
        userId: req.user._id
      });
      return next(); // Continue without session management
    }

    backendLogger.debug('Session management for user', {
      userId: req.user._id,
      providedSessionId,
      userCurrentSessionId: user.currentSessionId,
      userSessionExpiresAt: user.sessionExpiresAt
    });

    // Check if provided session ID is valid
    if (providedSessionId) {
      if (!isValidSessionIdFormat(providedSessionId)) {
        backendLogger.debug('Invalid session ID format provided', {
          userId: req.user._id,
          sessionId: providedSessionId
        });
        shouldCreateNew = true;
      } else if (!user.isSessionValid(providedSessionId)) {
        const isExpired = user.sessionExpiresAt && Date.now() >= user.sessionExpiresAt;
        backendLogger.debug('Session validation failed', {
          userId: req.user._id,
          sessionId: providedSessionId,
          isExpired,
          currentSessionId: user.currentSessionId
        });
        shouldCreateNew = true;
      } else {
        validSessionId = providedSessionId;
        backendLogger.debug('Valid session ID provided', {
          userId: req.user._id,
          sessionId: providedSessionId
        });
      }
    } else {
      // No session ID provided for authenticated user
      backendLogger.debug('No session ID provided for authenticated user', {
        userId: req.user._id
      });
      shouldCreateNew = true;
    }

    // Create new session if needed
    if (shouldCreateNew) {
      validSessionId = await createSessionForUser(user);
      backendLogger.debug('New session created for user', {
        userId: req.user._id,
        sessionId: validSessionId
      });
    }

    // Attach session ID to request
    req.sessionId = validSessionId;

    // Ensure session ID is present on ALL responses for authenticated requests.
    // Some controllers use `res.send` (e.g., successResponse) instead of `res.json`,
    // so we set it eagerly and also wrap common response methods for safety.
    if (typeof res.setHeader === 'function' && req.sessionId) {
      res.setHeader(SESSION_ID_HEADER, req.sessionId);
    }

    // Check if session is nearing expiry and add warning header
    if (req.user && user && user.sessionExpiresAt) {
      const now = Date.now();
      const timeUntilExpiry = user.sessionExpiresAt - now;
      const warningThreshold = 60 * 60 * 1000; // 1 hour in milliseconds
      
      if (timeUntilExpiry > 0 && timeUntilExpiry <= warningThreshold) {
        // Session is expiring within the warning threshold
        res.setHeader('x-session-expiring-soon', 'true');
        backendLogger.debug('Session expiring soon warning set', {
          userId: req.user._id,
          timeUntilExpiry: Math.floor(timeUntilExpiry / 1000 / 60), // minutes
          sessionId: validSessionId
        });
      }
    }

    // Intercept res.json/res.send to ensure headers are set before sending
    if (typeof res.json === 'function') {
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        if (req.sessionId && typeof res.setHeader === 'function') {
          res.setHeader(SESSION_ID_HEADER, req.sessionId);
        }
        return originalJson(data);
      };
    }

    if (typeof res.send === 'function') {
      const originalSend = res.send.bind(res);
      res.send = function(body) {
        if (req.sessionId && typeof res.setHeader === 'function') {
          res.setHeader(SESSION_ID_HEADER, req.sessionId);
        }
        return originalSend(body);
      };
    }
    
    next();
  } catch (error) {
    backendLogger.error('Error managing session ID', {
      error: error.message,
      userId: req.user?._id,
      path: req.path
    });
    // Continue without session management on error
    next();
  }
}

/**
 * Middleware: Validate session ID for authenticated requests
 * Since session IDs are for tracking only (not security), this is graceful
 * Logs issues but doesn't break the request
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function validateSessionId(req, res, next) {
  try {
    // Skip validation if user not authenticated (handled by ensureLoggedIn)
    if (!req.user || !req.user._id) {
      return next();
    }

    // Extract session ID from headers
    const sessionId = extractSessionId(req);
    
    if (!sessionId) {
      backendLogger.debug('Missing session ID for authenticated request - continuing gracefully', {
        userId: req.user._id,
        path: req.path
      });
      return next(); // Continue without session ID since it's just for tracking
    }

    // Get user from database to check session
    const User = require('../models/user');
    const user = await User.findById(req.user._id);
    
    if (!user) {
      backendLogger.warn('User not found during session validation - continuing gracefully', {
        userId: req.user._id,
        sessionId
      });
      return next(); // Continue since session is just for tracking
    }

    // Validate session using User model method
    if (!user.isSessionValid(sessionId)) {
      const now = Date.now();
      const isExpired = user.sessionExpiresAt && now >= user.sessionExpiresAt;
      const mismatch = user.currentSessionId && user.currentSessionId !== sessionId;
      
      backendLogger.debug('Invalid session ID detected - continuing gracefully', {
        userId: req.user._id,
        sessionId,
        isExpired,
        mismatch,
        currentSessionId: user.currentSessionId,
        sessionExpiresAt: user.sessionExpiresAt
      });
      
      // Continue gracefully since session is just for tracking, not security
      return next();
    }

    // Session valid - attach to request
    req.sessionId = sessionId;
    backendLogger.debug('Session validated successfully', {
      userId: req.user._id,
      sessionId
    });
    
    next();
  } catch (error) {
    backendLogger.error('Error validating session ID - continuing gracefully', {
      error: error.message,
      userId: req.user?._id,
      path: req.path
    });
    // Continue gracefully since session is just for tracking
    next();
  }
}

/**
 * Middleware: Check session expiry and warn if close to expiration
 * Adds header to response if session will expire soon (< 1 hour)
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function checkSessionExpiry(req, res, next) {
  try {
    if (!req.user || !req.user._id || !req.sessionId) {
      return next();
    }

    const User = require('../models/user');
    const user = await User.findById(req.user._id);
    
    if (!user || !user.sessionExpiresAt) {
      return next();
    }

    const now = Date.now();
    const timeRemaining = user.sessionExpiresAt - now;
    const oneHourMs = 60 * 60 * 1000;

    if (timeRemaining < oneHourMs && timeRemaining > 0) {
      res.setHeader('X-Session-Expiry-Warning', 'true');
      res.setHeader('X-Session-Time-Remaining', Math.floor(timeRemaining / 1000)); // seconds
      
      backendLogger.debug('Session expiring soon', {
        userId: req.user._id,
        timeRemainingMs: timeRemaining
      });
    }

    next();
  } catch (error) {
    backendLogger.error('Error checking session expiry', {
      error: error.message,
      userId: req.user?._id
    });
    // Don't fail request on expiry check error
    next();
  }
}

/**
 * Create or update session for user
 * Generates new session ID and updates User model atomically to avoid race conditions
 * 
 * @param {Object} user - User document (Mongoose model instance)
 * @returns {Promise<string>} New session ID
 */
async function createSessionForUser(user, forceNew = false) {
  // Check if user already has an active session and we're not forcing a new one
  if (!forceNew && user.currentSessionId && user.sessionExpiresAt) {
    const now = Date.now();
    if (user.sessionExpiresAt > now) {
      // User has an active session, return existing session ID
      backendLogger.debug('Using existing active session for user', {
        userId: user._id,
        sessionId: user.currentSessionId,
        expiresAt: new Date(user.sessionExpiresAt).toISOString()
      });
      return user.currentSessionId;
    }
  }

  // Create new session (either forced or no active session exists)
  const sessionId = generateSessionId();
  const createdAt = Date.now();
  const expiresAt = calculateExpiryEpoch(createdAt);

  // Use atomic update to prevent ParallelSaveError in concurrent scenarios
  await User.findByIdAndUpdate(user._id, {
    currentSessionId: sessionId,
    sessionCreatedAt: createdAt,
    sessionExpiresAt: expiresAt
  });

  // Update the user object for consistency (for tests that check user properties)
  user.currentSessionId = sessionId;
  user.sessionCreatedAt = createdAt;
  user.sessionExpiresAt = expiresAt;

  backendLogger.info('Session created for user', {
    userId: user._id,
    sessionId,
    expiresAt: new Date(expiresAt).toISOString()
  });

  return sessionId;
}

/**
 * Clear session for user
 * Removes session data from User model
 * 
 * @param {Object} user - User document (Mongoose model instance)
 * @returns {Promise<void>}
 */
async function clearSessionForUser(user) {
  const oldSessionId = user.currentSessionId;
  
  user.currentSessionId = undefined;
  user.sessionCreatedAt = undefined;
  user.sessionExpiresAt = undefined;
  
  await user.save();

  backendLogger.info('Session cleared for user', {
    userId: user._id,
    oldSessionId
  });
}

module.exports = {
  manageSessionId,
  attachSessionId: manageSessionId, // Alias for backward compatibility
  validateSessionId,
  checkSessionExpiry,
  createSessionForUser,
  clearSessionForUser,
  generateSessionId,
  SESSION_ID_HEADER
};
