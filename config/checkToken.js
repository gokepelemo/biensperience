const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // Check for token in Authorization header, query params, or secure cookie
    let token = req.get("Authorization") || req.query.token || req.cookies.auth_token;
    if (token) {
        token = token.replace("Bearer ", "");
        jwt.verify(token, process.env.SECRET, function(err, decoded) {
            if (err) {
                console.log('JWT verification failed:', err.message);
                req.user = null;
            } else {
                console.log('JWT verified successfully for user:', decoded.user.email);
                req.user = decoded.user;
                req.exp = new Date(decoded.exp * 1000);
            }
            return next();
        })
    } else {
        console.log('No token found in request');
        req.user = null;
        return next();
    }
}
