module.exports = function(req, res, next) {
    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    next();
}