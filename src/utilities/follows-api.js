/**
 * Follows API Service
 * Frontend service for managing follow relationships and feed
 */

import { sendRequest } from './send-request';
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = '/api/follows';

/**
 * Follow a user
 * @param {string} userId - ID of user to follow
 * @returns {Promise<Object>} Result with follow details
 */
export async function followUser(userId, currentUserId = null) {
  try {
    const result = await sendRequest(`${BASE_URL}/${userId}`, 'POST');

    logger.info('User followed successfully', { userId });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      broadcastEvent('follow:created', {
        follow: result.follow,
        followId: result.follow?._id,
        followingId: userId,
        followerId: currentUserId || result.follow?.follower
      });
    } catch (e) {
      // ignore
    }

    return result;
  } catch (error) {
    logger.error('Error following user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Unfollow a user
 * @param {string} userId - ID of user to unfollow
 * @returns {Promise<Object>} Success result
 */
export async function unfollowUser(userId, currentUserId = null) {
  try {
    const result = await sendRequest(`${BASE_URL}/${userId}`, 'DELETE');

    logger.info('User unfollowed successfully', { userId });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      broadcastEvent('follow:deleted', {
        followingId: userId,
        followerId: currentUserId
      });
    } catch (e) {
      // ignore
    }

    return result;
  } catch (error) {
    logger.error('Error unfollowing user', { error: error.message, userId });
    throw error;
  }
}

/**
 * Remove a follower (someone who follows you)
 * @param {string} followerId - ID of the follower to remove
 * @returns {Promise<Object>} Success result
 */
export async function removeFollower(followerId, removedById = null) {
  try {
    const result = await sendRequest(`${BASE_URL}/${followerId}/remove-follower`, 'DELETE');

    logger.info('Follower removed successfully', { followerId });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      broadcastEvent('follower:removed', {
        removedFollowerId: followerId,
        removedById,
        // Backwards-compatible aliases
        followerId,
        userId: removedById
      });
    } catch (e) {
      // ignore
    }

    return result;
  } catch (error) {
    logger.error('Error removing follower', { error: error.message, followerId });
    throw error;
  }
}

/**
 * Check if current user is following a specific user
 * @param {string} userId - ID of user to check
 * @returns {Promise<boolean>} Whether current user follows the specified user
 */
export async function getFollowStatus(userId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${userId}/status`);
    return result.isFollowing;
  } catch (error) {
    logger.error('Error getting follow status', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get follow relationship between current user and a target user
 * @param {string} userId - Target user ID
 * @returns {Promise<{isFollowing:boolean,isFollowedBy:boolean,isMutual:boolean}>}
 */
export async function getFollowRelationship(userId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${userId}/relationship`);
    return result.relationship;
  } catch (error) {
    logger.error('Error getting follow relationship', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get follower and following counts for a user
 * @param {string} userId - ID of user to get counts for
 * @returns {Promise<Object>} Object with followers and following counts
 */
export async function getFollowCounts(userId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${userId}/counts`);
    return result.counts;
  } catch (error) {
    logger.error('Error getting follow counts', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get followers of a user
 * @param {string} userId - ID of user to get followers for
 * @param {Object} options - Pagination options
 * @param {number} [options.limit=50] - Number of followers to return
 * @param {number} [options.skip=0] - Number of followers to skip
 * @returns {Promise<Object>} Object with followers array and pagination info
 */
export async function getFollowers(userId, options = {}) {
  try {
    const { limit = 50, skip = 0 } = options;
    const params = new URLSearchParams({ limit, skip });

    return await sendRequest(`${BASE_URL}/${userId}/followers?${params}`);
  } catch (error) {
    logger.error('Error getting followers', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get users that a user is following
 * @param {string} userId - ID of user to get following list for
 * @param {Object} options - Pagination options
 * @param {number} [options.limit=50] - Number of users to return
 * @param {number} [options.skip=0] - Number of users to skip
 * @returns {Promise<Object>} Object with following array and pagination info
 */
export async function getFollowing(userId, options = {}) {
  try {
    const { limit = 50, skip = 0 } = options;
    const params = new URLSearchParams({ limit, skip });

    return await sendRequest(`${BASE_URL}/${userId}/following?${params}`);
  } catch (error) {
    logger.error('Error getting following list', { error: error.message, userId });
    throw error;
  }
}

/**
 * Get activity feed from users the current user follows
 * @param {Object} options - Query options
 * @param {number} [options.limit=50] - Number of activities to return
 * @param {number} [options.skip=0] - Number of activities to skip
 * @param {string} [options.actions] - Comma-separated list of action types to filter
 * @returns {Promise<Object>} Object with feed array and pagination info
 */
export async function getFollowFeed(options = {}) {
  try {
    const { limit = 50, skip = 0, actions } = options;
    const params = new URLSearchParams({ limit, skip });
    if (actions) {
      params.set('actions', actions);
    }

    return await sendRequest(`${BASE_URL}/feed?${params}`);
  } catch (error) {
    logger.error('Error getting follow feed', { error: error.message });
    throw error;
  }
}
