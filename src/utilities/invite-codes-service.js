/**
 * Invite Codes Service
 *
 * Functions for managing invite codes on the frontend.
 */

import { sendRequest } from './send-request';
import { logger } from './logger';

const BASE_URL = '/api/invites';

/**
 * Get all invite codes created by the current user
 * @returns {Promise<Array>} - Array of invite objects
 */
export async function getInviteCodes() {
  try {
    const invites = await sendRequest(BASE_URL, 'GET');
    logger.debug('Retrieved invite codes', { count: invites.length });
    return invites;
  } catch (error) {
    logger.error('Error getting invite codes', {}, error);
    throw error;
  }
}

/**
 * Create a new invite code
 * @param {Object} inviteData - Invite configuration
 * @param {string} inviteData.email - Email address (optional)
 * @param {string} inviteData.inviteeName - Invitee name (optional)
 * @param {Array<string>} inviteData.experiences - Experience IDs (optional)
 * @param {Array<string>} inviteData.destinations - Destination IDs (optional)
 * @param {number} inviteData.maxUses - Maximum uses (default: 1)
 * @param {Date} inviteData.expiresAt - Expiration date (optional)
 * @param {string} inviteData.customMessage - Custom message (optional)
 * @param {boolean} inviteData.mutualFollow - Create mutual follow when redeemed (optional)
 * @returns {Promise<Object>} - Created invite object
 */
export async function createInviteCode(inviteData) {
  try {
    const result = await sendRequest(BASE_URL, 'POST', inviteData);
    logger.info('Created invite code', { email: inviteData.email });
    return result;
  } catch (error) {
    logger.error('Error creating invite code', { inviteData }, error);
    throw error;
  }
}

/**
 * Create multiple invite codes from CSV data (super admin only)
 * @param {Array<Object>} invites - Array of invite data objects
 * @returns {Promise<Object>} - { created, errors }
 */
export async function bulkCreateInviteCodes(invites, sendEmail = false) {
  try {
    const result = await sendRequest(`${BASE_URL}/bulk`, 'POST', { invites, sendEmail });
    logger.info('Bulk created invite codes', {
      total: invites.length,
      created: result.created.length,
      errors: result.errors.length,
      emailsSent: result.emailResults?.sent || 0,
      emailsFailed: result.emailResults?.failed || 0
    });
    return result;
  } catch (error) {
    logger.error('Error bulk creating invite codes', { count: invites.length }, error);
    throw error;
  }
}

/**
 * Validate an invite code (public endpoint, no auth required)
 * @param {string} code - Invite code to validate
 * @param {string} email - Email address (optional)
 * @returns {Promise<Object>} - Validation result
 */
export async function validateInviteCode(code, email = null) {
  try {
    const result = await sendRequest(`${BASE_URL}/validate`, 'POST', { code, email });
    logger.debug('Validated invite code', { code, valid: result.valid });
    return result;
  } catch (error) {
    logger.error('Error validating invite code', { code }, error);
    throw error;
  }
}

/**
 * Redeem an invite code for the current user
 * @param {string} code - Invite code to redeem
 * @returns {Promise<Object>} - { success, experiencesAdded, destinations, customMessage }
 */
export async function redeemInviteCode(code) {
  try {
    const result = await sendRequest(`${BASE_URL}/redeem`, 'POST', { code });
    logger.info('Redeemed invite code', {
      code,
      experiencesAdded: result.experiencesAdded?.length || 0,
      destinations: result.destinations?.length || 0
    });
    return result;
  } catch (error) {
    logger.error('Error redeeming invite code', { code }, error);
    throw error;
  }
}

/**
 * Deactivate an invite code
 * @param {string} inviteId - Invite ID to deactivate
 * @returns {Promise<Object>} - Success response
 */
export async function deactivateInviteCode(inviteId) {
  try {
    const result = await sendRequest(`${BASE_URL}/${inviteId}`, 'DELETE');
    logger.info('Deactivated invite code', { inviteId });
    return result;
  } catch (error) {
    logger.error('Error deactivating invite code', { inviteId }, error);
    throw error;
  }
}

/**
 * Send email invite to a non-existent collaborator
 * @param {Object} inviteData - Email invite data
 * @param {string} inviteData.email - Email address
 * @param {string} inviteData.name - Invitee name
 * @param {string} inviteData.resourceType - 'experience' | 'destination' | 'plan'
 * @param {string} inviteData.resourceId - Resource ID
 * @param {string} inviteData.resourceName - Resource name
 * @param {string} inviteData.customMessage - Custom message (optional)
 * @param {string} inviteData.permissionType - Permission type ('owner' | 'collaborator' | 'contributor')
 * @returns {Promise<Object>} - { success, invite, emailSent }
 */
export async function sendEmailInvite(inviteData) {
  try {
    const result = await sendRequest(`${BASE_URL}/email`, 'POST', inviteData);
    logger.info('Sent email invite', { email: inviteData.email, resourceType: inviteData.resourceType });
    return result;
  } catch (error) {
    logger.error('Error sending email invite', { inviteData }, error);
    throw error;
  }
}

/**
 * Parse CSV file and convert to invite data array
 * @param {File} file - CSV file
 * @returns {Promise<Array<Object>>} - Array of invite data objects
 */
export async function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          reject(new Error('CSV file must have at least a header row and one data row'));
          return;
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        // Find column indices
        const emailIndex = headers.findIndex(h => h.includes('email'));
        const nameIndex = headers.findIndex(h => h.includes('name'));

        if (emailIndex === -1 || nameIndex === -1) {
          reject(new Error('CSV must have "email" and "name" columns'));
          return;
        }

        // Parse data rows
        const invites = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());

          if (values.length > emailIndex && values.length > nameIndex) {
            const email = values[emailIndex];
            const name = values[nameIndex];

            if (email && name) {
              invites.push({ email, name });
            }
          }
        }

        logger.info('Parsed CSV file', { totalRows: lines.length - 1, validInvites: invites.length });
        resolve(invites);
      } catch (error) {
        logger.error('Error parsing CSV file', {}, error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
