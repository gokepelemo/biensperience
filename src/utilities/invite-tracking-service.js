/**
 * Invite Tracking Service
 *
 * Frontend service for tracking invite code generation and usage.
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/invite-tracking';

/**
 * Get all invite codes created by the current user
 * @returns {Promise<{invites: Array, stats: Object}>}
 */
export async function getMyInvites() {
  try {
    logger.debug('Fetching user invite codes');
    const response = await sendRequest(`${BASE_URL}/my-invites`, 'GET');
    logger.info('User invite codes fetched successfully', {
      inviteCount: response.invites?.length,
      stats: response.stats
    });
    return response;
  } catch (error) {
    logger.error('Failed to fetch user invite codes', {}, error);
    throw error;
  }
}

/**
 * Get detailed information about a specific invite code
 * @param {string} code - The invite code
 * @returns {Promise<Object>} Invite details with redemption info
 */
export async function getInviteDetails(code) {
  try {
    logger.debug('Fetching invite code details', { code });
    const response = await sendRequest(`${BASE_URL}/invite/${code}`, 'GET');
    logger.info('Invite code details fetched', {
      code,
      redemptions: response.usedCount
    });
    return response;
  } catch (error) {
    logger.error('Failed to fetch invite details', { code }, error);
    throw error;
  }
}

/**
 * Get all users who signed up with invite codes (super admin only)
 * @returns {Promise<{users: Array, totalUsers: number, uniqueInviteCodes: number}>}
 */
export async function getUsersByInvite() {
  try {
    logger.debug('Fetching users by invite');
    const response = await sendRequest(`${BASE_URL}/users-by-invite`, 'GET');
    logger.info('Users by invite fetched', {
      totalUsers: response.totalUsers,
      uniqueCodes: response.uniqueInviteCodes
    });
    return response;
  } catch (error) {
    logger.error('Failed to fetch users by invite', {}, error);
    throw error;
  }
}

/**
 * Get invite usage analytics
 * @returns {Promise<Object>} Analytics data
 */
export async function getInviteAnalytics() {
  try {
    logger.debug('Fetching invite analytics');
    const response = await sendRequest(`${BASE_URL}/analytics`, 'GET');
    logger.info('Invite analytics fetched', {
      totalInvites: response.totalInvites,
      totalRedemptions: response.totalRedemptions
    });
    return response;
  } catch (error) {
    logger.error('Failed to fetch invite analytics', {}, error);
    throw error;
  }
}
