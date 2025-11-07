/**
 * Rate limiting middleware for API endpoints
 * Prevents abuse and brute force attacks
 */

const rateLimit = require('express-rate-limit');

// Helper: skip limiting for super admins
function skipIfSuperAdmin(req) {
  try {
    const user = req.user;
    return !!(user && (user.isSuperAdmin || user.role === 'super_admin'));
  } catch (_) {
    return false;
  }
}

/**
 * General API rate limiter
 * Increased: default 3000 requests per 10 minutes per IP
 * Configurable via env: API_RATE_WINDOW_MS, API_RATE_MAX
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.API_RATE_WINDOW_MS || '', 10) || (10 * 60 * 1000), // 10 minutes
  max: parseInt(process.env.API_RATE_MAX || '', 10) || 3000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin,
});

/**
 * Strict rate limiter for authentication endpoints
 * Increased: default 15 attempts per 15 minutes per IP
 * Configurable via env: AUTH_RATE_WINDOW_MS, AUTH_RATE_MAX
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_WINDOW_MS || '', 10) || (15 * 60 * 1000),
  max: parseInt(process.env.AUTH_RATE_MAX || '', 10) || 15,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // Super admin skip doesn't apply pre-auth, but leaving for completeness on authenticated auth endpoints
  skip: skipIfSuperAdmin,
});

/**
 * Rate limiter for permission/collaborator modification endpoints
 * Increased: default 100 requests per 15 minutes per IP
 * Configurable via env: COLLAB_RATE_WINDOW_MS, COLLAB_RATE_MAX
 * Prevents abuse of collaboration features
 */
const collaboratorLimiter = rateLimit({
  windowMs: parseInt(process.env.COLLAB_RATE_WINDOW_MS || '', 10) || (15 * 60 * 1000),
  max: parseInt(process.env.COLLAB_RATE_MAX || '', 10) || 100,
  message: 'Too many collaborator modification requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin,
});

/**
 * Rate limiter for create/update/delete operations
 * Increased: default 300 requests per 15 minutes per IP
 * Configurable via env: MOD_RATE_WINDOW_MS, MOD_RATE_MAX
 */
const modificationLimiter = rateLimit({
  windowMs: parseInt(process.env.MOD_RATE_WINDOW_MS || '', 10) || (15 * 60 * 1000),
  max: parseInt(process.env.MOD_RATE_MAX || '', 10) || 300,
  message: 'Too many modification requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipIfSuperAdmin,
});

module.exports = {
  apiLimiter,
  authLimiter,
  collaboratorLimiter,
  modificationLimiter
};
