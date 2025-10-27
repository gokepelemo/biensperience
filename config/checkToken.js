const jwt = require('jsonwebtoken');
const backendLogger = require('../utilities/backend-logger');

module.exports = function(req, res, next) {
    // Check for token in Authorization header, query params, or secure cookie
    let token = req.get("Authorization") || req.query.token || req.cookies.auth_token;
    if (token) {
        token = token.replace("Bearer ", "");
        jwt.verify(token, process.env.SECRET, function(err, decoded) {
            if (err) {
                backendLogger.warn('JWT verification failed', { error: err.message, ip: req.ip });
                req.user = null;
            } else {
                backendLogger.debug('JWT verified successfully', { userId: decoded.user._id, email: decoded.user.email });
                req.user = decoded.user;
                req.exp = new Date(decoded.exp * 1000);
            }
            return next();
        })
    } else {
        backendLogger.debug('No token found in request', { ip: req.ip, userAgent: req.get('User-Agent') });
        req.user = null;
        return next();
    }
}
