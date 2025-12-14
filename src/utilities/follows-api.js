/**
 * Follows API Service
 * Frontend service for managing follow relationships and feed
 */

import { getToken } from './users-service';
import { logger } from './logger';
import { broadcastEvent } from './event-bus';

const BASE_URL = '/api/follows';

/**
 * Follow a user
 * @param {string} userId - ID of user to follow
 * @returns {Promise<Object>} Result with follow details
 */
export async function followUser(userId) {
  try {
    const response = await fetch(`${BASE_URL}/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to follow user');
    }

    logger.info('User followed successfully', { userId });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      broadcastEvent('follow:created', {
        follow: result.follow,
        followId: result.follow?._id,
        followingId: userId
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
export async function unfollowUser(userId) {
  try {
    const response = await fetch(`${BASE_URL}/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to unfollow user');
    }

    logger.info('User unfollowed successfully', { userId });

    // Emit event via event bus (handles local + cross-tab dispatch)
    try {
      broadcastEvent('follow:deleted', { followingId: userId });
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
 * Check if current user is following a specific user
 * @param {string} userId - ID of user to check
 * @returns {Promise<boolean>} Whether current user follows the specified user
 */
export async function getFollowStatus(userId) {
  try {
    const response = await fetch(`${BASE_URL}/${userId}/status`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get follow status');
    }

    const result = await response.json();
    return result.isFollowing;
  } catch (error) {
    logger.error('Error getting follow status', { error: error.message, userId });
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
    const response = await fetch(`${BASE_URL}/${userId}/counts`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get follow counts');
    }

    const result = await response.json();
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

    const response = await fetch(`${BASE_URL}/${userId}/followers?${params}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get followers');
    }

    return await response.json();
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

    const response = await fetch(`${BASE_URL}/${userId}/following?${params}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get following list');
    }

    return await response.json();
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

    const response = await fetch(`${BASE_URL}/feed?${params}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get feed');
    }

    return await response.json();
  } catch (error) {
    logger.error('Error getting follow feed', { error: error.message });
    throw error;
  }
}
