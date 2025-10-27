/**
 * Invite Tracking Routes
 *
 * Handles routes for tracking invite code generation and usage.
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();
const inviteTrackingCtrl = require('../../controllers/api/invite-tracking');
const ensureLoggedIn = require('../../config/ensureLoggedIn');

// All routes require authentication
router.use(ensureLoggedIn);

/**
 * GET /api/invite-tracking/my-invites
 * Get all invite codes created by the current user
 */
router.get('/my-invites', inviteTrackingCtrl.getMyInvites);

/**
 * GET /api/invite-tracking/invite/:code
 * Get detailed information about a specific invite code
 */
router.get('/invite/:code', inviteTrackingCtrl.getInviteDetails);

/**
 * GET /api/invite-tracking/users-by-invite
 * Get all users who signed up with invite codes (super admin only)
 */
router.get('/users-by-invite', inviteTrackingCtrl.getUsersByInvite);

/**
 * GET /api/invite-tracking/analytics
 * Get invite usage analytics and statistics
 */
router.get('/analytics', inviteTrackingCtrl.getInviteAnalytics);

module.exports = router;
