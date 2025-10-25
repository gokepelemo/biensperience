/**
 * Middleware to check if user has verified their email
 * Required for creating/updating experiences and destinations
 */

/**
 * Middleware to require email verification
 * Returns 403 if user's email is not confirmed
 * OAuth users are automatically considered verified
 */
function requireEmailVerification(req, res, next) {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // OAuth users are automatically verified
    if (req.user.provider && req.user.provider !== 'local') {
      return next();
    }

    // Super admins bypass email verification
    if (req.user.isSuperAdmin || req.user.role === 'super_admin') {
      return next();
    }

    // Check if email is confirmed
    if (!req.user.emailConfirmed) {
      return res.status(403).json({
        error: 'Email verification required. Please check your email for a verification link.',
        code: 'EMAIL_NOT_VERIFIED',
        details: {
          userEmail: req.user.email,
          message: 'You must verify your email address before creating or updating content.'
        }
      });
    }

    // Email is verified, proceed
    next();
  } catch (error) {
    console.error('Email verification middleware error:', error);
    return res.status(500).json({
      error: 'An error occurred while checking email verification status',
      code: 'VERIFICATION_CHECK_ERROR'
    });
  }
}

module.exports = { requireEmailVerification };
