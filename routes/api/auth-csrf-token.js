/**
 * CSRF Token Endpoint (standalone)
 *
 * Separated from auth.js so it is NOT subject to the strict auth rate limiter
 * (15 req / 15 min) which is designed for login/signup brute-force protection.
 * The CSRF token is needed by ALL users for ALL state-changing requests.
 */

const backendLogger = require('../../utilities/backend-logger');

module.exports = function csrfTokenHandler(req, res) {
  try {
    // Never cache CSRF tokens. Some browsers may otherwise revalidate and receive 304,
    // which breaks clients expecting a JSON body.
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');

    const generateToken = req.app.get('csrfTokenGenerator');

    if (!generateToken || typeof generateToken !== 'function') {
      backendLogger.error('CSRF token generator not available');
      return res.status(500).json({ error: 'CSRF configuration error' });
    }

    const csrfToken = generateToken(req, res);

    backendLogger.debug('CSRF token generated', {
      hasToken: !!csrfToken,
      tokenPreview: csrfToken ? csrfToken.substring(0, 16) + '...' : 'none'
    });

    res.json({ csrfToken });
  } catch (err) {
    backendLogger.error('CSRF token generation error', { error: err.message });
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};
