const jwt = require('jsonwebtoken');
const User = require('../models/user');
const backendLogger = require('../utilities/backend-logger');

module.exports = function(req, res, next) {
    // Check for token in Authorization header, query params, or secure cookie
    let token = req.get("Authorization") || req.query.token || req.cookies.auth_token;
    if (token) {
        token = token.replace("Bearer ", "");
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
                        ip: req.ip
                    });
                    req.user = null;
                    return next();
                }

                backendLogger.debug('JWT verified and user exists', { userId: user._id, email: user.email });
                req.user = decoded.user;
                req.exp = new Date(decoded.exp * 1000);
                return next();
            } catch (dbErr) {
                backendLogger.error('Error checking user existence', { error: dbErr.message, userId: decoded.user._id });
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
