/**
 * Follows Controller
 * Handles follow relationships and feed computation
 *
 * The Follow model tracks WHO follows WHO (lightweight).
 * The Activity model stores ALL user actions (source of truth for feed).
 * Feed = Activity records from users you follow.
 */

const Follow = require('../../models/follow');
const User = require('../../models/user');
const Activity = require('../../models/activity');
const backendLogger = require('../../utilities/backend-logger');

/**
 * Follow a user
 * POST /api/follows/:userId
 */
async function followUser(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    // Verify the user to follow exists
    const userToFollow = await User.findById(followingId).select('name email');
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await Follow.createFollow(followerId, followingId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log activity
    try {
      await Activity.log({
        action: 'follow_created',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: result.follow._id,
          type: 'Follow',
          name: `${req.user.name} follows ${userToFollow.name}`
        },
        target: {
          id: followingId,
          type: 'User',
          name: userToFollow.name
        },
        reason: result.reactivated ? 'Re-followed user' : 'Started following user',
        tags: ['social', 'follow']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log follow activity', { error: activityError.message });
    }

    backendLogger.info('User followed', {
      followerId: followerId.toString(),
      followingId: followingId,
      reactivated: result.reactivated || false
    });

    res.status(201).json({
      success: true,
      follow: result.follow,
      message: result.reactivated ? 'Re-followed user' : 'Now following user'
    });
  } catch (error) {
    backendLogger.error('Error following user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to follow user' });
  }
}

/**
 * Unfollow a user
 * DELETE /api/follows/:userId
 */
async function unfollowUser(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    const result = await Follow.removeFollow(followerId, followingId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log activity
    try {
      const userToUnfollow = await User.findById(followingId).select('name');
      await Activity.log({
        action: 'follow_removed',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: followingId,
          type: 'User',
          name: userToUnfollow?.name || 'Unknown'
        },
        reason: 'Stopped following user',
        tags: ['social', 'unfollow']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log unfollow activity', { error: activityError.message });
    }

    backendLogger.info('User unfollowed', {
      followerId: followerId.toString(),
      followingId: followingId
    });

    res.json({ success: true, message: 'Unfollowed user' });
  } catch (error) {
    backendLogger.error('Error unfollowing user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
}

/**
 * Get followers of a user
 * GET /api/follows/:userId/followers
 */
async function getFollowers(req, res) {
  try {
    const userId = req.params.userId;
    const { limit = 50, skip = 0 } = req.query;

    const followers = await Follow.getFollowers(userId, {
      limit: Math.min(parseInt(limit, 10), 100),
      skip: parseInt(skip, 10)
    });

    const count = await Follow.getFollowerCount(userId);

    res.json({
      success: true,
      followers: followers.map(f => ({
        _id: f.follower._id,
        name: f.follower.name,
        email: f.follower.email,
        photos: f.follower.photos,
        default_photo_id: f.follower.default_photo_id,
        followedAt: f.createdAt
      })),
      total: count,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
  } catch (error) {
    backendLogger.error('Error getting followers', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get followers' });
  }
}

/**
 * Get users that a user is following
 * GET /api/follows/:userId/following
 */
async function getFollowing(req, res) {
  try {
    const userId = req.params.userId;
    const { limit = 50, skip = 0 } = req.query;

    const following = await Follow.getFollowing(userId, {
      limit: Math.min(parseInt(limit, 10), 100),
      skip: parseInt(skip, 10)
    });

    const count = await Follow.getFollowingCount(userId);

    res.json({
      success: true,
      following: following.map(f => ({
        _id: f.following._id,
        name: f.following.name,
        email: f.following.email,
        photos: f.following.photos,
        default_photo_id: f.following.default_photo_id,
        followedAt: f.createdAt,
        notifications: f.notifications
      })),
      total: count,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
  } catch (error) {
    backendLogger.error('Error getting following', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get following list' });
  }
}

/**
 * Get follow counts for a user
 * GET /api/follows/:userId/counts
 */
async function getFollowCounts(req, res) {
  try {
    const userId = req.params.userId;

    const [followerCount, followingCount] = await Promise.all([
      Follow.getFollowerCount(userId),
      Follow.getFollowingCount(userId)
    ]);

    res.json({
      success: true,
      counts: {
        followers: followerCount,
        following: followingCount
      }
    });
  } catch (error) {
    backendLogger.error('Error getting follow counts', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get follow counts' });
  }
}

/**
 * Check if current user is following a specific user
 * GET /api/follows/:userId/status
 */
async function getFollowStatus(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    const isFollowing = await Follow.isFollowing(followerId, followingId);

    res.json({
      success: true,
      isFollowing
    });
  } catch (error) {
    backendLogger.error('Error getting follow status', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get follow status' });
  }
}

/**
 * Get user's feed - Activity from users they follow
 * GET /api/follows/feed
 *
 * This is the key integration with Activity model:
 * 1. Get list of user IDs being followed
 * 2. Query Activity model for actions by those users
 * 3. Return chronological feed
 */
async function getFeed(req, res) {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0, actions } = req.query;

    // Get IDs of users being followed
    const followingIds = await Follow.getFollowingIds(userId);

    if (followingIds.length === 0) {
      return res.json({ success: true, feed: [], total: 0, message: 'Follow users to see their activity' });
    }

    // Build query for Activity model
    const query = {
      'actor._id': { $in: followingIds },
      status: 'success' // Only successful actions
    };

    // Optional: filter by specific action types
    if (actions) {
      const actionList = actions.split(',').map(a => a.trim());
      query.action = { $in: actionList };
    } else {
      // Default feed actions (exclude system/admin actions)
      query.action = {
        $in: [
          'resource_created', 'resource_updated',
          'plan_created', 'plan_updated', 'plan_item_completed',
          'favorite_added', 'collaborator_added',
          'follow_created'
        ]
      };
    }

    // Get total count
    const total = await Activity.countDocuments(query);

    // Get paginated feed
    const feed = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip, 10))
      .limit(Math.min(parseInt(limit, 10), 100))
      .lean();

    res.json({
      success: true,
      feed,
      total,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      followingCount: followingIds.length
    });
  } catch (error) {
    backendLogger.error('Error getting feed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get feed' });
  }
}

/**
 * Block a follower
 * POST /api/follows/:userId/block
 */
async function blockFollower(req, res) {
  try {
    const userId = req.user._id;
    const blockUserId = req.params.userId;

    // Prevent self-blocking
    if (userId.toString() === blockUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const result = await Follow.blockFollower(userId, blockUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    backendLogger.info('User blocked', {
      userId: userId.toString(),
      blockedUserId: blockUserId
    });

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    backendLogger.error('Error blocking user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to block user' });
  }
}

/**
 * Unblock a follower
 * DELETE /api/follows/:userId/block
 */
async function unblockFollower(req, res) {
  try {
    const userId = req.user._id;
    const unblockUserId = req.params.userId;

    const result = await Follow.unblockFollower(userId, unblockUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    backendLogger.info('User unblocked', {
      userId: userId.toString(),
      unblockedUserId: unblockUserId
    });

    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    backendLogger.error('Error unblocking user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
}

module.exports = {
  followUser,
  unfollowUser,
  getFeed,
  getFollowers,
  getFollowing,
  getFollowCounts,
  getFollowStatus,
  blockFollower,
  unblockFollower
};
