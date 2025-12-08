/**
 * System Users for Biensperience frontend.
 * Provides utilities to detect and handle system users like Archive User.
 *
 * @module system-users
 */

/**
 * Archive User ID - Fixed ObjectId for consistent reference across environments
 * This ID is deterministic: ObjectId('000000000000000000000001')
 */
export const ARCHIVE_USER_ID = '000000000000000000000001';

/**
 * Archive User display name
 */
export const ARCHIVE_USER_NAME = 'Archived';

/**
 * System User IDs for quick lookup
 */
export const SYSTEM_USER_IDS = {
  ARCHIVE_USER: ARCHIVE_USER_ID
};

/**
 * Check if a user ID is a system user
 * @param {string|Object} userIdOrUser - User ID string or user object with _id
 * @returns {boolean} True if system user
 */
export function isSystemUser(userIdOrUser) {
  if (!userIdOrUser) return false;

  // Handle both user object and ID string
  const id = typeof userIdOrUser === 'object'
    ? (userIdOrUser._id?.toString?.() || userIdOrUser._id)
    : userIdOrUser?.toString?.() || userIdOrUser;

  if (!id) return false;
  return Object.values(SYSTEM_USER_IDS).includes(id);
}

/**
 * Check if a user ID is the Archive User
 * @param {string|Object} userIdOrUser - User ID string or user object with _id
 * @returns {boolean} True if Archive User
 */
export function isArchiveUser(userIdOrUser) {
  if (!userIdOrUser) return false;

  // Handle both user object and ID string
  const id = typeof userIdOrUser === 'object'
    ? (userIdOrUser._id?.toString?.() || userIdOrUser._id)
    : userIdOrUser?.toString?.() || userIdOrUser;

  if (!id) return false;
  return id === ARCHIVE_USER_ID;
}

/**
 * Get display name for a user, handling system users
 * @param {Object} user - User object with name property
 * @returns {string} Display name
 */
export function getDisplayName(user) {
  if (!user) return 'Unknown';
  if (isArchiveUser(user)) return ARCHIVE_USER_NAME;
  return user.name || 'Unknown';
}

/**
 * Check if an experience is archived (owned by Archive User)
 * @param {Object} experience - Experience object with permissions array
 * @returns {boolean} True if experience is archived
 */
export function isExperienceArchived(experience) {
  if (!experience?.permissions) return false;

  const ownerPermission = experience.permissions.find(
    p => p.entity === 'user' && p.type === 'owner'
  );

  return ownerPermission ? isArchiveUser(ownerPermission._id) : false;
}

/**
 * Get the original owner ID from an archived experience
 * @param {Object} experience - Experience object with archived_owner field
 * @returns {string|null} Original owner ID or null if not archived
 */
export function getArchivedOwner(experience) {
  if (!experience?.archived_owner) return null;
  return experience.archived_owner?._id || experience.archived_owner;
}
