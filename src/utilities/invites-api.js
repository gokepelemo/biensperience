/**
 * Invite Code API Service
 * Frontend service for managing invite codes and email invites
 */

import { getToken } from './users-service';
import logger from './logger';

const BASE_URL = '/api/invites';

/**
 * Send an email invite to a collaborator who doesn't have an account
 * @param {Object} data - Invite data
 * @param {string} data.email - Email address
 * @param {string} data.name - Full name of invitee
 * @param {string} data.resourceType - Type of resource ('experience' | 'destination' | 'plan')
 * @param {string} data.resourceId - ID of the resource
 * @param {string} data.resourceName - Name of the resource for email template
 * @param {string} [data.customMessage] - Optional custom message
 * @returns {Promise<Object>} Result with invite details
 */
export async function sendEmailInvite(data) {
  try {
    const response = await fetch(`${BASE_URL}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to send email invite');
    }

    logger.info('Email invite sent successfully', {
      email: data.email,
      resourceType: data.resourceType,
      resourceId: data.resourceId
    });

    return result;
  } catch (error) {
    logger.error('Error sending email invite', {
      error: error.message,
      email: data.email
    });
    throw error;
  }
}

/**
 * Get all invites created by the current user
 * @returns {Promise<Array>} List of invites
 */
export async function getUserInvites() {
  try {
    const response = await fetch(BASE_URL, {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch invites');
    }

    const invites = await response.json();
    return invites;
  } catch (error) {
    logger.error('Error fetching user invites', { error: error.message });
    throw error;
  }
}

/**
 * Validate an invite code
 * @param {string} code - Invite code
 * @param {string} [email] - Optional email for email-specific validation
 * @returns {Promise<Object>} Validation result
 */
export async function validateInviteCode(code, email = null) {
  try {
    const response = await fetch(`${BASE_URL}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, email })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Invalid invite code');
    }

    return result;
  } catch (error) {
    logger.error('Error validating invite code', { error: error.message, code });
    throw error;
  }
}

/**
 * Redeem an invite code (after signup/login)
 * @param {string} code - Invite code to redeem
 * @returns {Promise<Object>} Redemption result with experiences and destinations
 */
export async function redeemInviteCode(code) {
  try {
    const response = await fetch(`${BASE_URL}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ code })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to redeem invite code');
    }

    logger.info('Invite code redeemed successfully', {
      code,
      experiencesCount: result.experiencesAdded?.length || 0,
      destinationsCount: result.destinations?.length || 0
    });

    return result;
  } catch (error) {
    logger.error('Error redeeming invite code', { error: error.message, code });
    throw error;
  }
}

/**
 * Deactivate an invite code
 * @param {string} inviteId - ID of invite to deactivate
 * @returns {Promise<Object>} Success result
 */
export async function deactivateInvite(inviteId) {
  try {
    const response = await fetch(`${BASE_URL}/${inviteId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || 'Failed to deactivate invite');
    }

    logger.info('Invite deactivated successfully', { inviteId });
    return await response.json();
  } catch (error) {
    logger.error('Error deactivating invite', { error: error.message, inviteId });
    throw error;
  }
}
