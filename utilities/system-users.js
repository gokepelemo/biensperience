/**
 * System Users for Biensperience application.
 * Defines special system users like Archive User for ownership transfer.
 *
 * @module system-users
 */

const mongoose = require('mongoose');

/**
 * Archive User - A blackhole user for experiences that have been archived
 * When an experience with plans cannot be deleted, ownership transfers to Archive User
 * The original owner's ID is stored in the experience's archived_owner field
 * Profile is private to hide the blackhole nature from public view
 */
const ARCHIVE_USER = {
  // Fixed ObjectId for consistent reference across environments
  // This ID is deterministic: ObjectId('000000000000000000000001')
  _id: new mongoose.Types.ObjectId('000000000000000000000001'),
  name: 'Archived User',
  email: 'archived@biensperience.system',
  // This user cannot login - no password, no OAuth
  provider: 'local',
  role: 'regular_user',
  emailConfirmed: true,
  // Private visibility - blackhole profile should not be publicly accessible
  visibility: 'private',
  // Special flag to identify system users
  isSystemUser: true
};

/**
 * System User IDs for quick lookup
 */
const SYSTEM_USER_IDS = {
  ARCHIVE_USER: ARCHIVE_USER._id.toString()
};

/**
 * Check if a user ID is a system user
 * @param {string|ObjectId} userId - User ID to check
 * @returns {boolean} True if system user
 */
function isSystemUser(userId) {
  if (!userId) return false;
  const id = userId.toString ? userId.toString() : userId;
  return Object.values(SYSTEM_USER_IDS).includes(id);
}

/**
 * Check if a user ID is the Archive User
 * @param {string|ObjectId} userId - User ID to check
 * @returns {boolean} True if Archive User
 */
function isArchiveUser(userId) {
  if (!userId) return false;
  const id = userId.toString ? userId.toString() : userId;
  return id === SYSTEM_USER_IDS.ARCHIVE_USER;
}

/**
 * Get display name for a user, handling system users
 * @param {Object} user - User object with name property
 * @returns {string} Display name
 */
function getDisplayName(user) {
  if (!user) return 'Unknown';
  if (isArchiveUser(user._id)) return ARCHIVE_USER.name;
  return user.name || 'Unknown';
}

module.exports = {
  ARCHIVE_USER,
  SYSTEM_USER_IDS,
  isSystemUser,
  isArchiveUser,
  getDisplayName
};
