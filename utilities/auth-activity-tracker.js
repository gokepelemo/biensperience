/**
 * Auth Activity Tracker
 *
 * Tracks authentication-related events in Activity model
 * All tracking operations are non-blocking (fire-and-forget)
 */

const Activity = require('../models/activity');
const backendLogger = require('./backend-logger');
const { extractMetadata, extractActor } = require('./activity-tracker');

/**
 * Track successful login
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who logged in
 * @param {Object} options.req - Express request object
 * @param {string} options.method - Login method ('password', 'facebook', 'google', 'twitter')
 */
async function trackLogin(options) {
  const {
    user,
    req,
    method = 'password'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_login',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `User logged in via ${method}`,
    metadata: {
      ...extractMetadata(req),
      loginMethod: method
    },
    status: 'success',
    tags: ['auth', 'login', method]
  }).catch(err => {
    backendLogger.error('Failed to track login activity', {
      error: err.message,
      userId: user._id,
      method
    });
  });
}

/**
 * Track failed login attempt
 * @param {Object} options - Tracking options
 * @param {string} options.email - Email attempted
 * @param {Object} options.req - Express request object
 * @param {string} options.reason - Failure reason ('invalid_credentials', 'user_not_found', etc.)
 */
async function trackFailedLogin(options) {
  const {
    email,
    req,
    reason = 'invalid_credentials'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'login_failed',
    actor: {
      _id: null,
      email: email || 'unknown',
      name: 'Anonymous',
      role: 'unauthenticated'
    },
    resource: null,
    reason: `Failed login attempt: ${reason}`,
    metadata: {
      ...extractMetadata(req),
      failureReason: reason,
      attemptedEmail: email
    },
    status: 'failure',
    tags: ['auth', 'login_failed', reason]
  }).catch(err => {
    backendLogger.error('Failed to track failed login activity', {
      error: err.message,
      email
    });
  });
}

/**
 * Track OAuth authentication
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who authenticated
 * @param {Object} options.req - Express request object
 * @param {string} options.provider - OAuth provider ('facebook', 'google', 'twitter')
 * @param {boolean} options.success - Whether auth succeeded
 * @param {boolean} options.isLinking - Whether linking account (vs login)
 * @param {string} options.error - Error message if failed
 */
async function trackOAuthAuth(options) {
  const {
    user,
    req,
    provider,
    success = true,
    isLinking = false,
    error = null
  } = options;

  const action = isLinking
    ? (success ? 'oauth_account_linked' : 'oauth_link_failed')
    : (success ? 'oauth_login' : 'oauth_login_failed');

  const reason = isLinking
    ? (success ? `${provider} account linked successfully` : `Failed to link ${provider} account: ${error}`)
    : (success ? `User logged in via ${provider}` : `${provider} login failed: ${error}`);

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action,
    actor: user ? extractActor(user) : {
      _id: null,
      email: 'unknown',
      name: 'Anonymous',
      role: 'unauthenticated'
    },
    resource: user ? {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    } : null,
    reason,
    metadata: {
      ...extractMetadata(req),
      oauthProvider: provider,
      isLinking,
      error: error || undefined
    },
    status: success ? 'success' : 'failure',
    tags: ['auth', 'oauth', provider, isLinking ? 'link' : 'login', success ? 'success' : 'failure']
  }).catch(err => {
    backendLogger.error('Failed to track OAuth activity', {
      error: err.message,
      userId: user?._id,
      provider,
      isLinking
    });
  });
}

/**
 * Track account unlinking
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who unlinked account
 * @param {Object} options.req - Express request object
 * @param {string} options.provider - OAuth provider ('facebook', 'google', 'twitter')
 */
async function trackOAuthUnlink(options) {
  const {
    user,
    req,
    provider
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'oauth_account_unlinked',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `${provider} account unlinked`,
    metadata: {
      ...extractMetadata(req),
      oauthProvider: provider
    },
    status: 'success',
    tags: ['auth', 'oauth', provider, 'unlink']
  }).catch(err => {
    backendLogger.error('Failed to track OAuth unlink activity', {
      error: err.message,
      userId: user._id,
      provider
    });
  });
}

/**
 * Track logout
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User who logged out
 * @param {Object} options.req - Express request object
 */
async function trackLogout(options) {
  const {
    user,
    req
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_logout',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: 'User logged out',
    metadata: extractMetadata(req),
    status: 'success',
    tags: ['auth', 'logout']
  }).catch(err => {
    backendLogger.error('Failed to track logout activity', {
      error: err.message,
      userId: user._id
    });
  });
}

/**
 * Track session creation
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User for whom session was created
 * @param {string} options.sessionId - Session ID
 * @param {Object} options.req - Express request object (optional)
 */
async function trackSessionCreated(options) {
  const {
    user,
    sessionId,
    req
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'session_created',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: 'New session created',
    metadata: {
      ...(req ? extractMetadata(req) : {}),
      sessionId
    },
    status: 'success',
    tags: ['auth', 'session', 'created']
  }).catch(err => {
    backendLogger.error('Failed to track session creation activity', {
      error: err.message,
      userId: user._id,
      sessionId
    });
  });
}

/**
 * Track session expiration
 * @param {Object} options - Tracking options
 * @param {Object} options.user - User whose session expired
 * @param {string} options.sessionId - Session ID
 * @param {string} options.reason - Expiration reason ('timeout', 'manual', 'logout')
 */
async function trackSessionExpired(options) {
  const {
    user,
    sessionId,
    reason = 'timeout'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'session_expired',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `Session expired: ${reason}`,
    metadata: {
      sessionId,
      expirationReason: reason
    },
    status: 'success',
    tags: ['auth', 'session', 'expired', reason]
  }).catch(err => {
    backendLogger.error('Failed to track session expiration activity', {
      error: err.message,
      userId: user._id,
      sessionId
    });
  });
}

/**
 * Track user signup
 * @param {Object} options - Tracking options
 * @param {Object} options.user - Newly created user
 * @param {Object} options.req - Express request object
 * @param {string} options.method - Signup method ('password', 'oauth')
 */
async function trackSignup(options) {
  const {
    user,
    req,
    method = 'password'
  } = options;

  // Non-blocking: Fire and forget
  Activity.create({
    timestamp: new Date(),
    action: 'user_signup',
    actor: extractActor(user),
    resource: {
      id: user._id,
      type: 'User',
      name: user.name || user.email
    },
    reason: `New user signed up via ${method}`,
    metadata: {
      ...extractMetadata(req),
      signupMethod: method
    },
    status: 'success',
    tags: ['auth', 'signup', method]
  }).catch(err => {
    backendLogger.error('Failed to track signup activity', {
      error: err.message,
      userId: user._id,
      method
    });
  });
}

module.exports = {
  trackLogin,
  trackFailedLogin,
  trackOAuthAuth,
  trackOAuthUnlink,
  trackLogout,
  trackSessionCreated,
  trackSessionExpired,
  trackSignup
};
