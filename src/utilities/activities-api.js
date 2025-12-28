/**
 * Activities API Utilities
 * Functions for interacting with the activities API endpoints
 */

import { sendRequest } from './send-request';

const BASE_URL = '/api/activities';

/**
 * Get all activities with filtering and pagination
 * Super admin only
 * 
 * @param {Object} params - Query parameters for filtering and pagination
 * @param {string} params.action - Filter by action type
 * @param {string} params.resourceType - Filter by resource type
 * @param {string} params.actorId - Filter by actor user ID
 * @param {string} params.resourceId - Filter by resource ID
 * @param {string} params.startDate - Filter by start date (ISO string)
 * @param {string} params.endDate - Filter by end date (ISO string)
 * @param {number} params.page - Page number (default: 1)
 * @param {number} params.limit - Items per page (default: 50)
 * @returns {Promise<Object>} Response with activities array and pagination info
 */
export async function getAllActivities(params = {}) {
  const queryString = new URLSearchParams();
  
  // Add all provided parameters to query string
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryString.append(key, value);
    }
  });

  const url = queryString.toString() ? `${BASE_URL}?${queryString}` : BASE_URL;
  return await sendRequest(url);
}

/**
 * Get activity statistics
 * Super admin only
 * 
 * @returns {Promise<Object>} Activity statistics
 */
export async function getActivityStats() {
  return await sendRequest(`${BASE_URL}/stats`);
}

/**
 * Get activity history for a specific resource
 * 
 * @param {string} resourceId - ID of the resource
 * @param {Object} options - Query options
 * @param {string} options.action - Filter by action type
 * @param {string} options.startDate - Start date filter
 * @param {string} options.endDate - End date filter
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Object>} Resource activity history
 */
export async function getResourceHistory(resourceId, options = {}) {
  const queryString = new URLSearchParams();
  
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryString.append(key, value);
    }
  });

  const url = queryString.toString() 
    ? `${BASE_URL}/resource/${resourceId}?${queryString}`
    : `${BASE_URL}/resource/${resourceId}`;
    
  return await sendRequest(url);
}

/**
 * Get activity history for a specific actor/user
 * 
 * @param {string} actorId - ID of the actor/user
 * @param {Object} options - Query options
 * @param {string} options.action - Filter by action type
 * @param {string} options.startDate - Start date filter
 * @param {string} options.endDate - End date filter
 * @param {number} options.limit - Limit number of results
 * @returns {Promise<Object>} Actor activity history
 */
export async function getActorHistory(actorId, options = {}) {
  const queryString = new URLSearchParams();
  
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryString.append(key, value);
    }
  });

  const url = queryString.toString() 
    ? `${BASE_URL}/actor/${actorId}?${queryString}`
    : `${BASE_URL}/actor/${actorId}`;
    
  return await sendRequest(url);
}

/**
 * Create a new activity record.
 * Payload should be an object describing the activity. Example:
 * {
 *   action: 'marked complete',
 *   item: 'Pack hiking boots',
 *   targetItem: 'Everest trip',
 *   link: '/experiences/abc123#plan-xyz-item-123'
 * }
 *
 * @param {Object} payload - Activity payload
 * @returns {Promise<Object>} Created activity
 */
export async function createActivity(payload = {}) {
  return await sendRequest(BASE_URL, 'POST', payload);
}

/**
 * Restore resource state using rollback token
 * Super admin only
 *
 * @param {string} rollbackToken - Rollback token from activity
 * @returns {Promise<Object>} Restoration result
 */
export async function restoreResourceState(rollbackToken) {
  return await sendRequest(`${BASE_URL}/restore/${rollbackToken}`, 'POST');
}

/**
 * Get users who have planned the curator's experiences
 * Curator feature flag required
 *
 * @param {Object} options - Query options
 * @param {number} options.limit - Max results (default: 50)
 * @param {number} options.skip - Skip count for pagination (default: 0)
 * @returns {Promise<Object>} Planners list with user info and experience details
 */
export async function getCuratorPlanners(options = {}) {
  const queryString = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryString.append(key, value);
    }
  });

  const url = queryString.toString()
    ? `${BASE_URL}/curator/planners?${queryString}`
    : `${BASE_URL}/curator/planners`;

  return await sendRequest(url);
}