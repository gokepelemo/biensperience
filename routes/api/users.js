const express = require('express');
const router = express.Router()
const usersCtrl = require('../../controllers/api/users');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { authLimiter, modificationLimiter } = require('../../config/rateLimiters');
const { validate } = require('../../utilities/validate');
const {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../../controllers/api/users.schemas');

router.post('/', authLimiter, validate(signupSchema), usersCtrl.create); // Rate limit signup
router.get('/bulk', ensureLoggedIn, usersCtrl.getBulkUsers); // Bulk fetch users
router.get('/avatars', ensureLoggedIn, usersCtrl.getAvatars); // Batch avatar URL resolution
router.get('/search', ensureLoggedIn, usersCtrl.searchUsers);
router.get('/owned-entities/search', ensureLoggedIn, usersCtrl.searchOwnedEntities);
router.get('/all', ensureLoggedIn, usersCtrl.getAllUsers);
router.get('/feature-admin-check', ensureLoggedIn, usersCtrl.checkFeatureFlagAdmin);
router.get('/profile', ensureLoggedIn, usersCtrl.getProfile); // Get current user's profile
router.get('/:id', ensureLoggedIn, usersCtrl.getUser);
router.put('/:id', ensureLoggedIn, modificationLimiter, usersCtrl.updateUser);
router.put('/:id/admin', ensureLoggedIn, modificationLimiter, usersCtrl.updateUserAsAdmin);

// Phone number verification (SMS)
router.post('/:id/phone-verification/start', ensureLoggedIn, modificationLimiter, usersCtrl.startPhoneVerification);
router.post('/:id/phone-verification/confirm', ensureLoggedIn, modificationLimiter, usersCtrl.confirmPhoneVerification);

router.post('/login', authLimiter, validate(loginSchema), usersCtrl.login); // Rate limit login attempts
router.get('/check-token', ensureLoggedIn, usersCtrl.checkToken);

// Password reset routes
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), usersCtrl.requestPasswordReset);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), usersCtrl.resetPassword);

// Email confirmation routes
router.get('/confirm-email/:token', usersCtrl.confirmEmail);
router.post('/resend-confirmation', authLimiter, usersCtrl.resendConfirmation);

// Role management routes (super admin only)
router.put('/:id/role', ensureLoggedIn, modificationLimiter, usersCtrl.updateUserRole);

// Account deletion route
router.delete('/:id', ensureLoggedIn, modificationLimiter, usersCtrl.deleteAccount);

module.exports = router;