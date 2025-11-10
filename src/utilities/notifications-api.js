/**
 * Notifications API helper
 * Provides convenience methods for fetching user-targeted activities (notifications)
 */
import { getActorHistory } from './activities-api';

/**
 * Get recent 'collaborator_added' activities for a user
 * @param {string} actorId - User ID
 * @param {Object} options - { limit }
 * @returns {Promise<Array>} Array of activity objects
 */
export async function getCollaboratorNotifications(actorId, options = {}) {
  const params = {
    action: 'collaborator_added',
    limit: options.limit || 10
  };

  const res = await getActorHistory(actorId, params);
  // sendRequest returns the payload directly (unwrapped when necessary)
  return res?.data || res || [];
}

export default {
  getCollaboratorNotifications
};
