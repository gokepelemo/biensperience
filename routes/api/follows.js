/**
 * Follows API Routes
 * Handles follow relationships and feed computation
 *
 * Feed endpoint uses Activity model as source of truth.
 */

const express = require('express');
const router = express.Router();
const followsCtrl = require('../../controllers/api/follows');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { modificationLimiter } = require('../../config/rateLimiters');

// Feed - Activity from users you follow (must be before /:userId routes)
router.get('/feed', ensureLoggedIn, followsCtrl.getFeed);

// Follow/Unfollow a user
router.post('/:userId', ensureLoggedIn, modificationLimiter, followsCtrl.followUser);
router.delete('/:userId', ensureLoggedIn, modificationLimiter, followsCtrl.unfollowUser);

// Get followers and following lists
router.get('/:userId/followers', ensureLoggedIn, followsCtrl.getFollowers);
router.get('/:userId/following', ensureLoggedIn, followsCtrl.getFollowing);

// Get follow counts
router.get('/:userId/counts', ensureLoggedIn, followsCtrl.getFollowCounts);

// Check if current user is following a specific user
router.get('/:userId/status', ensureLoggedIn, followsCtrl.getFollowStatus);

// Block/unblock a follower
router.post('/:userId/block', ensureLoggedIn, modificationLimiter, followsCtrl.blockFollower);
router.delete('/:userId/block', ensureLoggedIn, modificationLimiter, followsCtrl.unblockFollower);

module.exports = router;
