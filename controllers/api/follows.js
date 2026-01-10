/**
 * Follows Controller
 * Handles follow relationships and feed computation
 *
 * The Follow model tracks WHO follows WHO (lightweight).
 * The Activity model stores ALL user actions (source of truth for feed).
 * Feed = Activity records from users you follow.
 */

const Follow = require('../../models/follow');
const User = require('../../models/user');
const Activity = require('../../models/activity');
const Experience = require('../../models/experience');
const Destination = require('../../models/destination');
const Plan = require('../../models/plan');
const backendLogger = require('../../utilities/backend-logger');
const { broadcastEvent } = require('../../utilities/websocket-server');
const { canView } = require('../../utilities/permissions');
const { notifyUser } = require('../../utilities/notifications');

function isPlaceholderResourceName(name) {
  if (!name || typeof name !== 'string') return true;
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  return normalized === 'plan' || normalized === 'unnamed' || normalized.startsWith('unnamed ');
}

/**
 * Format activity action into user-friendly text
 * @param {string} action - Raw action type from Activity model
 * @param {Object} options - Additional context for formatting
 * @param {string} options.resourceType - Type of resource (User, Experience, etc.)
 * @param {boolean} options.isOwnActivity - Whether the actor is the current user
 * @returns {string} Human-readable action text
 */
function formatActivityAction(action, options = {}) {
  const { resourceType, isOwnActivity } = options;

  // Special handling for User profile updates
  if (action === 'resource_updated' && resourceType === 'User') {
    return isOwnActivity ? 'Updated your profile' : 'Updated their profile';
  }

  const actionMap = {
    // Resource CRUD
    'resource_created': 'Created',
    'resource_updated': 'Updated',
    'resource_deleted': 'Deleted',

    // Permission actions
    'permission_added': 'Added a collaborator to',
    'permission_removed': 'Removed a collaborator from',
    'permission_updated': 'Updated permissions on',
    'ownership_transferred': 'Transferred ownership of',

    // User actions
    'user_registered': 'Joined Biensperience',
    'user_updated': 'Updated their profile',
    'user_deleted': 'Deleted their account',
    'email_verified': 'Verified their email',
    'password_changed': 'Changed their password',
    'profile_updated': 'Updated their profile',

    // Plan actions
    'plan_created': 'Created a plan on',
    'plan_updated': 'Updated a plan on',
    'plan_deleted': 'Deleted a plan from',
    'plan_item_completed': 'Completed a plan item on',
    'plan_item_uncompleted': 'Uncompleted a plan item on',
    'plan_item_note_added': 'Added a note to a plan item on',
    'plan_item_note_updated': 'Updated a note on a plan item in',
    'plan_item_note_deleted': 'Deleted a note from a plan item in',

    // Cost actions
    'cost_added': 'Added a cost to',
    'cost_updated': 'Updated a cost on',
    'cost_deleted': 'Deleted a cost from',

    // Social actions
    'favorite_added': 'Favorited',
    'favorite_removed': 'Unfavorited',
    'collaborator_added': 'Became a collaborator on',
    'collaborator_removed': 'Removed from collaboration on',
    'follow_created': 'Followed',
    'follow_removed': 'Unfollowed',
    'follow_blocked': 'Blocked',

    // System actions
    'data_imported': 'Imported data',
    'data_exported': 'Exported data',
    'backup_created': 'Created a backup',
    'rollback_performed': 'Performed a rollback'
  };

  return actionMap[action] || action.replace(/_/g, ' ');
}

function formatTimeAgo(timestamp) {
  const now = new Date();
  const diffMs = now - new Date(timestamp);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Follow a user
 * POST /api/follows/:userId
 */
async function followUser(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    // Prevent following yourself
    if (followerId.toString() === followingId.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Verify the user to follow exists
    const userToFollow = await User.findById(followingId).select('name email preferences').lean();
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await Follow.createFollow(followerId, followingId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log activity
    try {
      await Activity.log({
        action: 'follow_created',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: result.follow._id,
          type: 'Follow',
          name: `${req.user.name} follows ${userToFollow.name}`
        },
        target: {
          id: followingId,
          type: 'User',
          name: userToFollow.name
        },
        reason: result.reactivated ? 'Re-followed user' : 'Started following user',
        tags: ['social', 'follow']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log follow activity', { error: activityError.message });
    }

    backendLogger.info('User followed', {
      followerId: followerId.toString(),
      followingId: followingId,
      reactivated: result.reactivated || false
    });

    // Best-effort: send BienBot notifications to both users.
    // Mutual follow dedupe: if target was already following actor, do NOT send an additional
    // second notification beyond the normal one-per-user.
    try {
      const actorUser = await User.findById(followerId).select('name preferences').lean();
      const isMutual = await Follow.isFollowing(followingId, followerId);

      const targetText = isMutual
        ? `${req.user.name} followed you back — you’re now following each other.`
        : `${req.user.name} followed you.`;

      const actorText = isMutual
        ? `You followed ${userToFollow?.name || 'a user'} — you’re now following each other.`
        : `You followed ${userToFollow?.name || 'a user'}.`;

      await Promise.all([
        notifyUser({
          user: userToFollow,
          channel: 'bienbot',
          type: 'activity',
          message: targetText,
          data: {
            kind: 'follow',
            action: 'follow_created',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            resourceLink: `/users/${followerId.toString()}`
          },
          logContext: {
            feature: 'follow',
            kind: 'target',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            channel: 'bienbot'
          }
        }),
        notifyUser({
          user: userToFollow,
          channel: 'webhook',
          type: 'activity',
          message: targetText,
          data: {
            kind: 'follow',
            action: 'follow_created',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            resourceLink: `/users/${followerId.toString()}`
          },
          logContext: {
            feature: 'follow',
            kind: 'target',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            channel: 'webhook'
          }
        }),
        notifyUser({
          user: actorUser,
          channel: 'bienbot',
          type: 'activity',
          message: actorText,
          data: {
            kind: 'follow',
            action: 'follow_created',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            resourceLink: `/users/${followingId.toString()}`
          },
          logContext: {
            feature: 'follow',
            kind: 'actor',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            channel: 'bienbot'
          }
        }),
        notifyUser({
          user: actorUser,
          channel: 'webhook',
          type: 'activity',
          message: actorText,
          data: {
            kind: 'follow',
            action: 'follow_created',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            resourceLink: `/users/${followingId.toString()}`
          },
          logContext: {
            feature: 'follow',
            kind: 'actor',
            followerId: followerId.toString(),
            followingId: followingId.toString(),
            mutual: isMutual,
            channel: 'webhook'
          }
        })
      ]);
    } catch (notifyErr) {
      backendLogger.warn('Failed to send follow notifications (continuing)', {
        error: notifyErr.message,
        followerId: followerId.toString(),
        followingId: followingId.toString()
      });
    }

    // Broadcast WebSocket event to the followed user's profile room
    // This enables real-time UI updates when someone follows them
    try {
      broadcastEvent('user', followingId.toString(), {
        type: 'follow:created',
        payload: {
          followId: result.follow._id?.toString(),
          followerId: followerId.toString(),
          followerName: req.user.name,
          followingId: followingId.toString(),
          userId: followingId.toString()
        }
      }, followerId.toString()); // Exclude the follower from receiving this
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast follow event', { error: wsError.message });
    }

    res.status(201).json({
      success: true,
      follow: result.follow,
      message: result.reactivated ? 'Re-followed user' : 'Now following user'
    });
  } catch (error) {
    backendLogger.error('Error following user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to follow user' });
  }
}

/**
 * Unfollow a user
 * DELETE /api/follows/:userId
 */
async function unfollowUser(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    const result = await Follow.removeFollow(followerId, followingId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Log activity
    try {
      const userToUnfollow = await User.findById(followingId).select('name');
      await Activity.log({
        action: 'follow_removed',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: followingId,
          type: 'User',
          name: userToUnfollow?.name || 'Unknown'
        },
        target: {
          id: followingId,
          type: 'User',
          name: userToUnfollow?.name || 'Unknown'
        },
        reason: 'Stopped following user',
        tags: ['social', 'unfollow']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log unfollow activity', { error: activityError.message });
    }

    backendLogger.info('User unfollowed', {
      followerId: followerId.toString(),
      followingId: followingId
    });

    // Broadcast WebSocket event to the unfollowed user's profile room
    // This enables real-time UI updates when someone unfollows them
    try {
      broadcastEvent('user', followingId.toString(), {
        type: 'follow:deleted',
        payload: {
          followerId: followerId.toString(),
          followingId: followingId.toString(),
          userId: followingId.toString()
        }
      }, followerId.toString()); // Exclude the unfollower from receiving this
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast unfollow event', { error: wsError.message });
    }

    res.json({ success: true, message: 'Unfollowed user' });
  } catch (error) {
    backendLogger.error('Error unfollowing user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
}

/**
 * Get followers of a user
 * GET /api/follows/:userId/followers
 */
async function getFollowers(req, res) {
  try {
    const userId = req.params.userId;
    const { limit = 50, skip = 0 } = req.query;

    const followers = await Follow.getFollowers(userId, {
      limit: Math.min(parseInt(limit, 10), 100),
      skip: parseInt(skip, 10)
    });

    const count = await Follow.getFollowerCount(userId);

    res.json({
      success: true,
      followers: followers.map(f => ({
        _id: f.follower._id,
        name: f.follower.name,
        email: f.follower.email,
        photos: f.follower.photos,
        default_photo_id: f.follower.default_photo_id,
        followedAt: f.createdAt
      })),
      total: count,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
  } catch (error) {
    backendLogger.error('Error getting followers', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get followers' });
  }
}

/**
 * Get users that a user is following
 * GET /api/follows/:userId/following
 */
async function getFollowing(req, res) {
  try {
    const userId = req.params.userId;
    const { limit = 50, skip = 0 } = req.query;

    const following = await Follow.getFollowing(userId, {
      limit: Math.min(parseInt(limit, 10), 100),
      skip: parseInt(skip, 10)
    });

    const count = await Follow.getFollowingCount(userId);

    res.json({
      success: true,
      following: following.map(f => ({
        _id: f.following._id,
        name: f.following.name,
        email: f.following.email,
        photos: f.following.photos,
        default_photo_id: f.following.default_photo_id,
        followedAt: f.createdAt,
        notifications: f.notifications
      })),
      total: count,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });
  } catch (error) {
    backendLogger.error('Error getting following', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get following list' });
  }
}

/**
 * Get follow counts for a user
 * GET /api/follows/:userId/counts
 */
async function getFollowCounts(req, res) {
  try {
    const userId = req.params.userId;

    const [followerCount, followingCount] = await Promise.all([
      Follow.getFollowerCount(userId),
      Follow.getFollowingCount(userId)
    ]);

    res.json({
      success: true,
      counts: {
        followers: followerCount,
        following: followingCount
      }
    });
  } catch (error) {
    backendLogger.error('Error getting follow counts', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get follow counts' });
  }
}

/**
 * Check if current user is following a specific user
 * GET /api/follows/:userId/status
 */
async function getFollowStatus(req, res) {
  try {
    const followerId = req.user._id;
    const followingId = req.params.userId;

    const isFollowing = await Follow.isFollowing(followerId, followingId);

    res.json({
      success: true,
      isFollowing
    });
  } catch (error) {
    backendLogger.error('Error getting follow status', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get follow status' });
  }
}

/**
 * Get follow relationship between current user and target user
 * GET /api/follows/:userId/relationship
 */
async function getFollowRelationship(req, res) {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.userId;

    const [isFollowing, isFollowedBy] = await Promise.all([
      Follow.isFollowing(currentUserId, otherUserId),
      Follow.isFollowing(otherUserId, currentUserId)
    ]);

    res.json({
      success: true,
      relationship: {
        isFollowing,
        isFollowedBy,
        isMutual: Boolean(isFollowing && isFollowedBy)
      }
    });
  } catch (error) {
    backendLogger.error('Error getting follow relationship', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get follow relationship' });
  }
}

/**
 * Get user's feed - Activity from users they follow
 * GET /api/follows/feed
 *
 * This is the key integration with Activity model:
 * 1. Get list of user IDs being followed
 * 2. Query Activity model for actions by those users
 * 3. Return chronological feed
 */
async function getFeed(req, res) {
  try {
    const userId = req.user._id;
    const { limit = 50, skip = 0, actions } = req.query;

    // Get IDs of users being followed
    const followingIds = await Follow.getFollowingIds(userId);

    if (followingIds.length === 0) {
      return res.json({ success: true, feed: [], total: 0, message: 'Follow users to see their activity' });
    }

    // Build query for Activity model
    // SOCIAL FEED RULE: show activity performed by users you follow.
    // PRIVACY RULE: do NOT leak actions involving resources the requester cannot view.
    // We enforce privacy by filtering activities after fetch based on the referenced resource.
    const query = {
      parentActivityId: null,
      status: 'success',
      'actor._id': { $in: followingIds }
    };

    // Optional: filter by specific action types
    if (actions) {
      const actionList = actions.split(',').map(a => a.trim());
      query.action = { $in: actionList };
    } else {
      // Default feed actions (exclude system/admin actions)
      query.action = {
        $in: [
          'resource_created', 'resource_updated',
          'plan_created', 'plan_updated', 'plan_item_completed',
          'favorite_added', 'collaborator_added',
          'follow_created'
        ]
      };
    }

    // Total candidate count (pre-privacy-filter). This is used for pagination.
    // Note: privacy filtering can remove some items from each page, so clients may need to
    // paginate further to collect a full page of visible items.
    const totalCandidate = await Activity.countDocuments(query);

    // Fetch a page of candidate feed items; we'll filter for privacy below.
    const candidateFeed = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip(parseInt(skip, 10))
      .limit(Math.min(parseInt(limit, 10), 100))
      .lean();

    const isRequesterSuperAdmin = Boolean(req.user?.isSuperAdmin);
    const baseFeed = isRequesterSuperAdmin ? candidateFeed : null;

    const permissionModels = { Destination, Experience };

    const experienceIds = new Set();
    const destinationIds = new Set();
    const planIds = new Set();
    const userIds = new Set();

    for (const activity of candidateFeed) {
      if (activity?.resource?.id && activity.resource.type) {
        const idStr = activity.resource.id.toString();
        if (activity.resource.type === 'Experience') experienceIds.add(idStr);
        if (activity.resource.type === 'Destination') destinationIds.add(idStr);
        if (activity.resource.type === 'Plan') planIds.add(idStr);
        if (activity.resource.type === 'User') userIds.add(idStr);
      }

      if (activity?.target?.id && activity.target.type === 'User') {
        userIds.add(activity.target.id.toString());
      }
    }

    const [experiences, destinations, plans, users] = await Promise.all([
      experienceIds.size
        ? Experience.find({ _id: { $in: Array.from(experienceIds) } })
        : Promise.resolve([]),
      destinationIds.size
        ? Destination.find({ _id: { $in: Array.from(destinationIds) } })
        : Promise.resolve([]),
      planIds.size
        ? Plan.find({ _id: { $in: Array.from(planIds) } })
        : Promise.resolve([]),
      userIds.size
        ? User.find({ _id: { $in: Array.from(userIds) } }).select('visibility')
        : Promise.resolve([])
    ]);

    const experienceById = new Map(experiences.map(doc => [doc._id.toString(), doc]));
    const destinationById = new Map(destinations.map(doc => [doc._id.toString(), doc]));
    const planById = new Map(plans.map(doc => [doc._id.toString(), doc]));
    const userById = new Map(users.map(doc => [doc._id.toString(), doc]));

    const visibilityCache = new Map();

    const canViewUserRef = (viewerId, userDocOrId) => {
      const userDoc = typeof userDocOrId === 'string' ? userById.get(userDocOrId) : userDocOrId;
      if (!userDoc) return false;
      const visibility = userDoc.visibility || 'public';
      if (visibility !== 'private') return true;
      return viewerId.toString() === userDoc._id.toString();
    };

    const canViewPlanRef = (viewerId, planDocOrId) => {
      const planDoc = typeof planDocOrId === 'string' ? planById.get(planDocOrId) : planDocOrId;
      if (!planDoc) return false;
      const viewerIdStr = viewerId.toString();

      // Legacy owner field
      if (planDoc.user && planDoc.user.toString() === viewerIdStr) return true;

      // Permissions array
      if (planDoc.permissions && Array.isArray(planDoc.permissions)) {
        return planDoc.permissions.some(
          p => p.entity === 'user' && p._id?.toString && p._id.toString() === viewerIdStr
        );
      }

      return false;
    };

    const isActivityVisible = async (activity) => {
      // If the referenced resource is missing or unknown, fail closed.
      const checks = [];

      if (activity?.resource?.id && activity.resource.type) {
        checks.push({
          id: activity.resource.id.toString(),
          type: activity.resource.type
        });
      }

      if (activity?.target?.id && activity.target.type) {
        checks.push({
          id: activity.target.id.toString(),
          type: activity.target.type
        });
      }

      for (const ref of checks) {
        const cacheKey = `${ref.type}:${ref.id}`;
        if (visibilityCache.has(cacheKey)) {
          if (!visibilityCache.get(cacheKey)) return false;
          continue;
        }

        let allowed = false;

        if (ref.type === 'Experience') {
          const doc = experienceById.get(ref.id);
          allowed = doc ? await canView(userId, doc, permissionModels) : false;
        } else if (ref.type === 'Destination') {
          const doc = destinationById.get(ref.id);
          allowed = doc ? await canView(userId, doc, permissionModels) : false;
        } else if (ref.type === 'Plan') {
          allowed = canViewPlanRef(userId, ref.id);
        } else if (ref.type === 'User') {
          allowed = canViewUserRef(userId, ref.id);
        } else if (ref.type === 'Follow') {
          // Follow relationships are not permission-gated.
          allowed = true;
        } else {
          // Unknown resource types: fail closed for safety.
          allowed = false;
        }

        visibilityCache.set(cacheKey, allowed);
        if (!allowed) return false;
      }

      return true;
    };

    let visibleFeed = baseFeed;
    if (!visibleFeed) {
      visibleFeed = [];
      for (const activity of candidateFeed) {
        // eslint-disable-next-line no-await-in-loop
        if (await isActivityVisible(activity)) {
          visibleFeed.push(activity);
        }
      }
    }

    // Enrich activities into the same shape returned by the dashboard activity feed
    const planIdsForEnrichment = visibleFeed
      .filter(a => a.resource?.type === 'Plan' && a.resource?.id)
      .map(a => a.resource.id);

    const plansMap = new Map();
    if (planIdsForEnrichment.length > 0) {
      const plansForEnrichment = await Plan.find({ _id: { $in: planIdsForEnrichment } })
        .populate('experience', 'name')
        .lean();
      plansForEnrichment.forEach(plan => plansMap.set(plan._id.toString(), plan));
    }

    const experienceIdsForEnrichment = visibleFeed
      .filter(a => a.resource?.type === 'Experience' && a.resource?.id)
      .map(a => a.resource.id);

    const destinationIdsForEnrichment = visibleFeed
      .filter(a => a.resource?.type === 'Destination' && a.resource?.id)
      .map(a => a.resource.id);

    const experiencesMap = new Map();
    if (experienceIdsForEnrichment.length > 0) {
      const experiencesForEnrichment = await Experience.find({ _id: { $in: experienceIdsForEnrichment } })
        .select('name')
        .lean();
      experiencesForEnrichment.forEach(exp => experiencesMap.set(exp._id.toString(), exp));
    }

    const destinationsMap = new Map();
    if (destinationIdsForEnrichment.length > 0) {
      const destinationsForEnrichment = await Destination.find({ _id: { $in: destinationIdsForEnrichment } })
        .select('name')
        .lean();
      destinationsForEnrichment.forEach(dest => destinationsMap.set(dest._id.toString(), dest));
    }

    const enrichedFeed = visibleFeed.map((activity) => {
      let resourceName = activity.resource?.name || 'Unnamed';
      let resourceLink = null;
      let targetName = activity.target?.name || null;

      // For plan-related activities, derive the experience name + deep links
      if (activity.resource?.type === 'Plan') {
        const plan = plansMap.get(activity.resource.id?.toString());

        if (plan && plan.experience) {
          const recordedName = activity.resource?.name;
          if (recordedName && typeof recordedName === 'string' && !isPlaceholderResourceName(recordedName)) {
            resourceName = recordedName;
          } else {
            resourceName = plan.experience.name;
          }

          resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}`;

          if ((activity.action === 'plan_item_completed' || activity.action === 'plan_item_uncompleted' ||
               activity.action === 'plan_item_note_added' || activity.action === 'plan_item_note_updated' ||
               activity.action === 'plan_item_note_deleted') && activity.target && activity.target.id) {
            try {
              const itemId = activity.target.id.toString();
              resourceLink = `/experiences/${plan.experience._id}#plan-${plan._id}-item-${itemId}`;
            } catch (err) {
              // ignore and fall back to plan-level link
            }
          }
        } else if (activity.previousState && activity.previousState.experience) {
          // Plan may have been deleted; recover from previousState
          try {
            const exp = activity.previousState.experience;
            const expId = (typeof exp === 'object' && exp._id) ? exp._id.toString() : exp.toString();
            const expName = (typeof exp === 'object' && exp.name) ? exp.name : activity.resource?.name || 'Experience';
            resourceName = expName;
            resourceLink = `/experiences/${expId}`;
          } catch (err) {
            // ignore
          }
        }
      }

      if (activity.resource?.type === 'Experience') {
        if (isPlaceholderResourceName(resourceName)) {
          const exp = experiencesMap.get(activity.resource.id?.toString());
          if (exp?.name) resourceName = exp.name;
        }
        resourceLink = `/experiences/${activity.resource.id}`;
      }

      if (activity.resource?.type === 'Destination') {
        if (isPlaceholderResourceName(resourceName)) {
          const dest = destinationsMap.get(activity.resource.id?.toString());
          if (dest?.name) resourceName = dest.name;
        }
        resourceLink = `/destinations/${activity.resource.id}`;
      }

      if (activity.resource?.type === 'User') {
        resourceLink = `/profile/${activity.resource.id}`;
      }

      if ((activity.action === 'plan_item_completed' || activity.action === 'plan_item_uncompleted' ||
           activity.action === 'plan_item_note_added' || activity.action === 'plan_item_note_updated' ||
           activity.action === 'plan_item_note_deleted') && activity.target) {
        targetName = activity.target.name;
      }

      if ((activity.action === 'permission_added' || activity.action === 'permission_removed' ||
           activity.action === 'collaborator_added' || activity.action === 'collaborator_removed') &&
          activity.target && activity.resource?.type === 'Plan') {
        targetName = activity.target.name;
      }

      if (activity.action === 'follow_created' || activity.action === 'follow_removed') {
        if (activity.target) {
          resourceName = activity.target.name || 'User';
          if (activity.target.id) {
            resourceLink = `/profile/${activity.target.id}`;
          }
          // Clear targetName to avoid duplicate display (name is already shown as resourceName/item)
          targetName = null;
        }
      }

      if ((activity.action === 'cost_added' || activity.action === 'cost_updated' || activity.action === 'cost_deleted') &&
          activity.metadata?.costTitle) {
        if (activity.target?.type !== 'User' && activity.target?.name) {
          targetName = activity.target.name;
        } else {
          targetName = activity.metadata.costTitle;
        }
      }

      if (activity.metadata?.resourceLink) {
        resourceLink = activity.metadata.resourceLink;
      }

      // Determine if this is the user's own activity
      const isOwnActivity = activity.actor?._id?.toString() === userId.toString();

      // Format action text with context-aware formatting
      let actionText = formatActivityAction(activity.action, {
        resourceType: activity.resource?.type,
        isOwnActivity
      });

      // Special-case destination permission events (legacy support for permission_added/removed)
      if (activity.resource?.type === 'Destination') {
        if (activity.action === 'permission_added') actionText = 'Favorited';
        if (activity.action === 'permission_removed') actionText = 'Unfavorited';
      }

      // For User resource updates, don't repeat the user's name as the item
      // Instead, the action text already includes the context (e.g., "Updated their profile")
      let itemDisplay = resourceName;
      if (activity.resource?.type === 'User' && activity.action === 'resource_updated') {
        itemDisplay = null; // Action text is self-sufficient
      }

      return {
        id: activity._id?.toString?.() || activity._id,
        action: actionText,
        actionType: activity.action,
        item: itemDisplay,
        targetItem: targetName,
        link: resourceLink,
        time: formatTimeAgo(activity.timestamp),
        timestamp: activity.timestamp,
        resourceType: activity.resource?.type,
        actorId: activity.actor?._id?.toString?.(),
        targetId: activity.target?.id?.toString?.(),
        actorName: activity.actor?.name || null,
        targetName: targetName || activity.target?.name || null
      };
    });

    res.json({
      success: true,
      feed: enrichedFeed,
      total: totalCandidate,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      followingCount: followingIds.length
    });
  } catch (error) {
    backendLogger.error('Error getting feed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get feed' });
  }
}

/**
 * Remove a follower (the person following the current user)
 * DELETE /api/follows/:userId/remove-follower
 * This allows a user to remove someone from their followers list
 */
async function removeFollower(req, res) {
  try {
    const userId = req.user._id;
    const followerToRemoveId = req.params.userId;

    // Prevent self-removal
    if (userId.toString() === followerToRemoveId) {
      return res.status(400).json({ error: 'Cannot remove yourself as a follower' });
    }

    // Remove the follow relationship where followerToRemoveId follows the current user
    const result = await Follow.removeFollow(followerToRemoveId, userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'This user is not following you' });
    }

    // Log activity
    try {
      const removedUser = await User.findById(followerToRemoveId).select('name');
      await Activity.log({
        action: 'follower_removed',
        actor: {
          _id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role
        },
        resource: {
          id: followerToRemoveId,
          type: 'User',
          name: removedUser?.name || 'Unknown'
        },
        reason: 'Removed a follower',
        tags: ['social', 'follower-removed']
      });
    } catch (activityError) {
      backendLogger.warn('Failed to log follower removal activity', { error: activityError.message });
    }

    backendLogger.info('Follower removed', {
      userId: userId.toString(),
      removedFollowerId: followerToRemoveId
    });

    // Broadcast WebSocket event to the removed follower
    // This enables real-time UI updates on their end
    try {
      broadcastEvent('user', followerToRemoveId.toString(), {
        type: 'follower:removed',
        payload: {
          removedById: userId.toString(),
          removedByName: req.user.name,
          removedFollowerId: followerToRemoveId.toString(),
          userId: followerToRemoveId.toString()
        }
      }, userId.toString()); // Exclude the user who removed the follower
    } catch (wsError) {
      backendLogger.warn('Failed to broadcast follower removal event', { error: wsError.message });
    }

    res.json({ success: true, message: 'Follower removed' });
  } catch (error) {
    backendLogger.error('Error removing follower', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to remove follower' });
  }
}

/**
 * Block a follower
 * POST /api/follows/:userId/block
 */
async function blockFollower(req, res) {
  try {
    const userId = req.user._id;
    const blockUserId = req.params.userId;

    // Prevent self-blocking
    if (userId.toString() === blockUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const result = await Follow.blockFollower(userId, blockUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    backendLogger.info('User blocked', {
      userId: userId.toString(),
      blockedUserId: blockUserId
    });

    res.json({ success: true, message: 'User blocked' });
  } catch (error) {
    backendLogger.error('Error blocking user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to block user' });
  }
}

/**
 * Unblock a follower
 * DELETE /api/follows/:userId/block
 */
async function unblockFollower(req, res) {
  try {
    const userId = req.user._id;
    const unblockUserId = req.params.userId;

    const result = await Follow.unblockFollower(userId, unblockUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    backendLogger.info('User unblocked', {
      userId: userId.toString(),
      unblockedUserId: unblockUserId
    });

    res.json({ success: true, message: 'User unblocked' });
  } catch (error) {
    backendLogger.error('Error unblocking user', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to unblock user' });
  }
}

module.exports = {
  followUser,
  unfollowUser,
  getFeed,
  getFollowers,
  getFollowing,
  getFollowCounts,
  getFollowStatus,
  getFollowRelationship,
  removeFollower,
  blockFollower,
  unblockFollower
};
