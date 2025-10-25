/**
 * Middleware to check if user has verified their email
 * Required for creating/updating experiences and destinations
 */

const User = require('../models/user');

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

    // Fetch fresh user data from database to ensure we have latest super admin status
    User.findById(req.user._id)
      .then(freshUser => {
        if (!freshUser) {
          return res.status(401).json({
            error: 'User not found',
            code: 'USER_NOT_FOUND'
          });
        }

        // Debug logging for super admin check
        console.log('Email verification check for user:', {
          email: freshUser.email,
          isSuperAdmin: freshUser.isSuperAdmin,
          role: freshUser.role,
          provider: freshUser.provider,
          emailConfirmed: freshUser.emailConfirmed
        });

        // OAuth users are automatically verified
        if (freshUser.provider && freshUser.provider !== 'local') {
          console.log('OAuth user - bypassing email verification');
          return next();
        }

        // Super admins bypass email verification
        if (freshUser.isSuperAdmin || freshUser.role === 'super_admin') {
          console.log('Super admin user - bypassing email verification');
          return next();
        }

        // Check if email is confirmed
        if (!freshUser.emailConfirmed) {
          return res.status(403).json({
            error: 'Email verification required. Please check your email for a verification link.',
            code: 'EMAIL_NOT_VERIFIED',
            details: {
              userEmail: freshUser.email,
              message: 'You must verify your email address before creating or updating content.'
            }
          });
        }

        // Email is verified, proceed
        next();
      })
      .catch(error => {
        console.error('Error fetching user for email verification:', error);
        return res.status(500).json({
          error: 'An error occurred while checking email verification status',
          code: 'VERIFICATION_CHECK_ERROR'
        });
      });
  } catch (error) {
    console.error('Email verification middleware error:', error);
    return res.status(500).json({
      error: 'An error occurred while checking email verification status',
      code: 'VERIFICATION_CHECK_ERROR'
    });
  }
}

module.exports = { requireEmailVerification };
