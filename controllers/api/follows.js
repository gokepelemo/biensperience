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
const { broadcastEvent } = require('../../utilities/websocket-server');

/**
 * Follow a user
 * POST /api/follows/:userId
 */
async function followUser(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    // Prevent following yourself
    if (followerId.toString() === followingId.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

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

    // Broadcast WebSocket event to the followed user's profile room
    // This enables real-time UI updates when someone follows them
    try {
      broadcastEvent('user', followingId.toString(), {
        type: 'follow:created',
        payload: {
          followId: result.follow._id?.toString(),
          followerId: followerId.toString(),
          followerName: req.user.name,
          followingId: followingId.toString(),
          userId: followingId.toString()
        }
      }, followerId.toString()); // Exclude the follower from receiving this
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast follow event', { error: wsError.message });
    }

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

    // Broadcast WebSocket event to the unfollowed user's profile room
    // This enables real-time UI updates when someone unfollows them
    try {
      broadcastEvent('user', followingId.toString(), {
        type: 'follow:deleted',
        payload: {
          followerId: followerId.toString(),
          followingId: followingId.toString(),
          userId: followingId.toString()
        }
      }, followerId.toString()); // Exclude the unfollower from receiving this
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast unfollow event', { error: wsError.message });
    }

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
 * Remove a follower (the person following the current user)
 * DELETE /api/follows/:userId/remove-follower
 * This allows a user to remove someone from their followers list
 */
async function removeFollower(req, res) {
  try {
    const userId = req.user._id;
    const followerToRemoveId = req.params.userId;

    // Prevent self-removal
    if (userId.toString() === followerToRemoveId) {
      return res.status(400).json({ error: 'Cannot remove yourself as a follower' });
    }

    // Remove the follow relationship where followerToRemoveId follows the current user
    const result = await Follow.removeFollow(followerToRemoveId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'This user is not following you' });
    }

    // Log activity
    try {
      const removedUser = await User.findById(followerToRemoveId).select('name');
      await Activity.log({
        action: 'follower_removed',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: followerToRemoveId,
          type: 'User',
          name: removedUser?.name || 'Unknown'
        },
        reason: 'Removed a follower',
        tags: ['social', 'follower-removed']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log follower removal activity', { error: activityError.message });
    }

    backendLogger.info('Follower removed', {
      userId: userId.toString(),
      removedFollowerId: followerToRemoveId
    });

    // Broadcast WebSocket event to the removed follower
    // This enables real-time UI updates on their end
    try {
      broadcastEvent('user', followerToRemoveId.toString(), {
        type: 'follower:removed',
        payload: {
          removedById: userId.toString(),
          removedByName: req.user.name,
          removedFollowerId: followerToRemoveId.toString(),
          userId: followerToRemoveId.toString()
        }
      }, userId.toString()); // Exclude the user who removed the follower
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast follower removal event', { error: wsError.message });
    }

    res.json({ success: true, message: 'Follower removed' });
  } catch (error) {
    backendLogger.error('Error removing follower', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to remove follower' });
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
  removeFollower,
  blockFollower,
  unblockFollower
};
