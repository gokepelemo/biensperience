const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Check for token in Authorization header, query params, or secure cookie
    let token = req.get("Authorization") || req.query.token || req.cookies.auth_token;
    if (token) {
        token = token.replace("Bearer ", "");
        jwt.verify(token, process.env.SECRET, function(err, decoded) {
            req.user = err ? null : decoded.user;
            req.exp = err ? null : new Date(decoded.exp * 1000);
            return next();
        })
    } else {
        req.user = null;
        return next();
    }
}
