const jwt = require('jsonwebtoken');
const User = require('../models/user');
const ApiToken = require('../models/apiToken');
const backendLogger = require('../utilities/backend-logger');

module.exports = function(req, res, next) {
    // Check for token in Authorization header, query params, or secure cookie
    let token = req.get("Authorization") || req.query.token || req.cookies.auth_token;
    if (token) {
        token = token.replace("Bearer ", "");

        // Check if this is an API token (64 hex characters)
        if (/^[a-f0-9]{64}$/i.test(token)) {
            // This is an API token
            ApiToken.findUserByToken(token).then(user => {
                if (user) {
                    backendLogger.debug('API token verified successfully', { userId: user._id, email: user.email });
                    req.user = user.toObject ? user.toObject() : user;
                    req.isApiToken = true; // Flag to indicate this request used an API token
                    return next();
                } else {
                    backendLogger.warn('Invalid API token', { ip: req.ip });
                    req.user = null;
                    return next();
                }
            }).catch(err => {
                backendLogger.error('Error validating API token', { error: err.message, ip: req.ip });
                req.user = null;
                return next();
            });
            return; // Exit early for API token path
        }

        // Otherwise, try JWT verification
        jwt.verify(token, process.env.SECRET, async function(err, decoded) {
            if (err) {
                backendLogger.warn('JWT verification failed', { error: err.message, ip: req.ip });
                req.user = null;
                return next();
            }

            try {
                // Verify user still exists in database
                const user = await User.findById(decoded.user._id);
                if (!user) {
                    backendLogger.warn('User in token no longer exists', {
                        userId: decoded.user._id,
                        email: decoded.user.email,
                        ip: req.ip,
                        path: req.path
                    });
                    req.user = null;
                    return next();
                }

                backendLogger.debug('JWT verified and user exists', {
                    userId: user._id,
                    email: user.email,
                    role: user.role,
                    isSuperAdmin: user.isSuperAdmin,
                    path: req.path
                });

                // Use fresh user object from database (has latest role, permissions, etc.)
                // Convert to plain object to ensure all properties are accessible
                req.user = user.toObject ? user.toObject() : user;
                req.exp = new Date(decoded.exp * 1000);
                return next();
            } catch (dbErr) {
                backendLogger.error('Error checking user existence', {
                    error: dbErr.message,
                    stack: dbErr.stack,
                    userId: decoded.user._id,
                    path: req.path
                });
                req.user = null;
                return next();
            }
        })
    } else {
        backendLogger.debug('No token found in request', { ip: req.ip, userAgent: req.get('User-Agent') });
        req.user = null;
        return next();
    }
}
