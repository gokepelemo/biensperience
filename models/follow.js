/**
 * Follow Model - Tracks user follow relationships
 *
 * This is a lightweight model that only tracks WHO follows WHO.
 * All activity data (what to show in feed) comes from the Activity model.
 *
 * How it works with Activity:
 * - Follow model: Stores follow relationships (follower -> following)
 * - Activity model: Stores ALL user activities (create experience, visit destination, etc.)
 * - Feed computation: Query Activity where actor._id IN user's following list
 *
 * Example feed query:
 *   const following = await Follow.getFollowingIds(userId);
 *   const feed = await Activity.find({ 'actor._id': { $in: following } })
 *     .sort({ timestamp: -1 })
 *     .limit(50);
 */

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

/**
 * Follow status enumeration
 */
const FOLLOW_STATUSES = ['active', 'pending', 'blocked'];

/**
 * Follow schema
 * Lightweight model - just tracks relationships
 * Activity model handles all feed/activity data
 */
const followSchema = new Schema({
  // The user who is following
  follower: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The user being followed
  following: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Status of the follow relationship
  status: {
    type: String,
    enum: FOLLOW_STATUSES,
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'follows'
});

// Compound unique index to prevent duplicate follows
followSchema.index({ follower: 1, following: 1 }, { unique: true });

// Index for efficient feed queries
followSchema.index({ follower: 1, status: 1 }); // Who am I following? (for feed)
followSchema.index({ following: 1, status: 1 }); // Who is following me? (for profile)

/**
 * Static method to create a follow relationship
 * Activity logging is handled by the controller
 */
followSchema.statics.createFollow = async function(followerId, followingId) {
  if (followerId.toString() === followingId.toString()) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  try {
    const existing = await this.findOne({ follower: followerId, following: followingId });

    if (existing) {
      if (existing.status === 'active') {
        return { success: false, error: 'Already following this user' };
      }
      if (existing.status === 'blocked') {
        return { success: false, error: 'You cannot follow this user' };
      }
      existing.status = 'active';
      await existing.save();
      return { success: true, follow: existing, reactivated: true };
    }

    const follow = new this({ follower: followerId, following: followingId, status: 'active' });
    await follow.save();
    return { success: true, follow };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Static method to remove a follow relationship
 */
followSchema.statics.removeFollow = async function(followerId, followingId) {
  try {
    const result = await this.deleteOne({ follower: followerId, following: followingId });
    return result.deletedCount > 0
      ? { success: true }
      : { success: false, error: 'Follow relationship not found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Static method to get IDs of users that a user is following
 * Used for feed queries against Activity model
 */
followSchema.statics.getFollowingIds = async function(userId) {
  const follows = await this.find({ follower: userId, status: 'active' }).select('following').lean();
  return follows.map(f => f.following);
};

/**
 * Static method to get followers with user details
 */
followSchema.statics.getFollowers = async function(userId, options = {}) {
  return this.find({ following: userId, status: options.status || 'active' })
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50)
    .populate('follower', 'name email photos default_photo_id')
    .lean();
};

/**
 * Static method to get following with user details
 */
followSchema.statics.getFollowing = async function(userId, options = {}) {
  return this.find({ follower: userId, status: options.status || 'active' })
    .sort({ createdAt: -1 })
    .skip(options.skip || 0)
    .limit(options.limit || 50)
    .populate('following', 'name email photos default_photo_id')
    .lean();
};

/**
 * Static method to get follower count
 */
followSchema.statics.getFollowerCount = async function(userId) {
  return this.countDocuments({ following: userId, status: 'active' });
};

/**
 * Static method to get following count
 */
followSchema.statics.getFollowingCount = async function(userId) {
  return this.countDocuments({ follower: userId, status: 'active' });
};

/**
 * Static method to check if user A is following user B
 */
followSchema.statics.isFollowing = async function(followerId, followingId) {
  const count = await this.countDocuments({ follower: followerId, following: followingId, status: 'active' });
  return count > 0;
};

/**
 * Static method to block a follower
 */
followSchema.statics.blockFollower = async function(userId, blockUserId) {
  try {
    const result = await this.findOneAndUpdate(
      { follower: blockUserId, following: userId },
      { status: 'blocked' },
      { upsert: true, new: true }
    );
    return { success: true, follow: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Static method to unblock a follower
 */
followSchema.statics.unblockFollower = async function(userId, unblockUserId) {
  try {
    await this.deleteOne({ follower: unblockUserId, following: userId, status: 'blocked' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = mongoose.model('Follow', followSchema);
