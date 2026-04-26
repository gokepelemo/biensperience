/**
 * Centralized secret reading.
 *
 * Three independent secrets are used by the application:
 *   - SESSION_SECRET — express-session signing + connect-mongo crypto
 *   - CSRF_SECRET    — csrf-csrf double-submit cookie HMAC
 *   - JWT_SECRET     — jsonwebtoken sign/verify (auth tokens, websocket auth)
 *
 * A single SECRET env var is accepted as a *fallback* for local dev so existing
 * .env files keep working. In production any missing value triggers a loud
 * boot-time warning (and, for JWT, a hard failure when an actual sign/verify
 * happens, since there is no safe default).
 *
 * Rotation guidance: rotate each independently. Rotating JWT_SECRET invalidates
 * all outstanding JWTs; rotating SESSION_SECRET invalidates active sessions;
 * rotating CSRF_SECRET invalidates outstanding CSRF tokens (next state-changing
 * request from any open tab will need a fresh token).
 */

const backendLogger = require('./backend-logger');

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SECRET;
}

function getSessionSecret() {
  return process.env.SESSION_SECRET || process.env.SECRET;
}

function getCsrfSecret() {
  return process.env.CSRF_SECRET || process.env.SECRET;
}

/**
 * Validate at boot that each independent secret is set when running in
 * production. Logs a loud warning per missing var. Does not exit — the app
 * remains bootable so an operator can recover, but the warning is unmissable
 * in any log aggregator.
 */
function validateSecretsAtBoot() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['SESSION_SECRET', 'CSRF_SECRET', 'JWT_SECRET'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length === 0) return;

  if (process.env.SECRET) {
    backendLogger.warn(
      '[secrets] Using legacy SECRET fallback in production for: ' +
      missing.join(', ') +
      '. Set independent values for each — a single shared secret breaks ' +
      'session, CSRF, and JWT simultaneously if compromised.'
    );
  } else {
    backendLogger.error(
      '[secrets] Missing required production secrets: ' + missing.join(', ') +
      '. Auth/session/CSRF will fail.'
    );
  }
}

module.exports = {
  getJwtSecret,
  getSessionSecret,
  getCsrfSecret,
  validateSecretsAtBoot,
};
