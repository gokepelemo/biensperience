/**
 * Invite Tracking Controller
 *
 * Provides endpoints for tracking invite code generation and usage.
 * Shows which invite codes were created by a user and who used them.
 */

const InviteCode = require('../../models/inviteCode');
const User = require('../../models/user');
const backendLogger = require('../../utilities/backend-logger');
const { sendError, sendSuccess } = require('../../utilities/controller-helpers');

/**
 * Get all invite codes created by the current user
 * Includes usage statistics and redeemed users
 *
 * @route GET /api/invite-tracking/my-invites
 * @access Private
 */
async function getMyInvites(req, res) {
  try {
    const userId = req.user._id;

    const invites = await InviteCode.find({ createdBy: userId })
      .populate({
        path: 'redeemedBy',
        select: 'name email photo createdAt'
      })
      .populate({
        path: 'experiences',
        select: 'title destination'
      })
      .populate({
        path: 'destinations',
        select: 'name country'
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate statistics
    const stats = {
      totalInvites: invites.length,
      activeInvites: invites.filter(i => i.isActive).length,
      totalRedemptions: invites.reduce((sum, i) => sum + i.usedCount, 0),
      expiredInvites: invites.filter(i => i.expiresAt && new Date(i.expiresAt) < new Date()).length
    };

    backendLogger.info('User invite codes retrieved', {
      userId,
      inviteCount: invites.length,
      stats
    });

    res.json({ invites, stats });
  } catch (error) {
    backendLogger.error('Error fetching user invites', { userId: req.user._id }, error);
    sendError(res, 'Failed to fetch invite codes', error);
  }
}

/**
 * Get detailed information about a specific invite code
 * Includes all users who redeemed it and their signup dates
 *
 * @route GET /api/invite-tracking/invite/:code
 * @access Private
 */
async function getInviteDetails(req, res) {
  try {
    const { code } = req.params;
    const userId = req.user._id;

    const invite = await InviteCode.findOne({
      code: code.toUpperCase(),
      createdBy: userId // Only show invites created by current user
    })
      .populate({
        path: 'redeemedBy',
        select: 'name email photo createdAt lastLogin inviteCode',
        options: { sort: { createdAt: -1 } }
      })
      .populate({
        path: 'experiences',
        select: 'title destination photos cost_estimate'
      })
      .populate({
        path: 'destinations',
        select: 'name country photos description'
      })
      .populate({
        path: 'createdBy',
        select: 'name email'
      })
      .lean();

    if (!invite) {
      backendLogger.warn('Invite code not found or unauthorized', {
        code,
        userId
      });
      return res.status(404).json({ error: 'Invite code not found' });
    }

    // Add usage percentage
    const usagePercentage = invite.maxUses
      ? (invite.usedCount / invite.maxUses * 100).toFixed(1)
      : null;

    backendLogger.info('Invite details retrieved', {
      code,
      userId,
      redemptions: invite.usedCount
    });

    res.json({
      ...invite,
      usagePercentage,
      isExpired: invite.expiresAt && new Date(invite.expiresAt) < new Date(),
      isAvailable: invite.isActive &&
                   (!invite.expiresAt || new Date(invite.expiresAt) > new Date()) &&
                   (!invite.maxUses || invite.usedCount < invite.maxUses)
    });
  } catch (error) {
    backendLogger.error('Error fetching invite details', {
      code: req.params.code,
      userId: req.user._id
    }, error);
    sendError(res, 'Failed to fetch invite details', error);
  }
}

/**
 * Get users who signed up with invite codes (for super admins)
 * Shows all users and which invite codes they used
 *
 * @route GET /api/invite-tracking/users-by-invite
 * @access Super Admin only
 */
async function getUsersByInvite(req, res) {
  try {
    // Check if user is super admin
    if (req.user.role !== 'super_admin') {
      backendLogger.warn('Unauthorized access to invite tracking', {
        userId: req.user._id,
        role: req.user.role
      });
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const users = await User.find({ inviteCode: { $exists: true, $ne: null } })
      .select('name email inviteCode createdAt lastLogin photo')
      .sort({ createdAt: -1 })
      .lean();

    // Get all unique invite codes
    const codes = [...new Set(users.map(u => u.inviteCode))];

    // Fetch invite details for each code
    const invites = await InviteCode.find({ code: { $in: codes } })
      .populate('createdBy', 'name email')
      .lean();

    // Create a map of code -> invite details
    const inviteMap = {};
    invites.forEach(invite => {
      inviteMap[invite.code] = invite;
    });

    // Attach invite details to users
    const usersWithInvites = users.map(user => ({
      ...user,
      inviteDetails: inviteMap[user.inviteCode] || null
    }));

    backendLogger.info('Users by invite retrieved', {
      adminId: req.user._id,
      userCount: users.length,
      uniqueCodes: codes.length
    });

    res.json({
      users: usersWithInvites,
      totalUsers: users.length,
      uniqueInviteCodes: codes.length
    });
  } catch (error) {
    backendLogger.error('Error fetching users by invite', {
      userId: req.user._id
    }, error);
    sendError(res, 'Failed to fetch users by invite', error);
  }
}

/**
 * Get invite usage analytics
 * Shows trends and statistics about invite code usage
 *
 * @route GET /api/invite-tracking/analytics
 * @access Private
 */
async function getInviteAnalytics(req, res) {
  try {
    const userId = req.user._id;
    const isSuperAdmin = req.user.role === 'super_admin';

    // Base query - super admins see all, regular users see only theirs
    const query = isSuperAdmin ? {} : { createdBy: userId };

    const invites = await InviteCode.find(query)
      .populate('redeemedBy', 'createdAt')
      .lean();

    // Calculate analytics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const analytics = {
      totalInvites: invites.length,
      activeInvites: invites.filter(i => i.isActive).length,
      totalRedemptions: invites.reduce((sum, i) => sum + i.usedCount, 0),
      averageRedemptionsPerInvite: invites.length > 0
        ? (invites.reduce((sum, i) => sum + i.usedCount, 0) / invites.length).toFixed(2)
        : 0,

      // Time-based stats
      redemptionsLast7Days: 0,
      redemptionsLast30Days: 0,
      invitesCreatedLast7Days: invites.filter(i => new Date(i.createdAt) >= sevenDaysAgo).length,
      invitesCreatedLast30Days: invites.filter(i => new Date(i.createdAt) >= thirtyDaysAgo).length,

      // Status breakdown
      expiredInvites: invites.filter(i => i.expiresAt && new Date(i.expiresAt) < now).length,
      fullyUsedInvites: invites.filter(i => i.maxUses && i.usedCount >= i.maxUses).length,
      unusedInvites: invites.filter(i => i.usedCount === 0).length,

      // Email-restricted invites
      emailRestrictedInvites: invites.filter(i => i.email).length,

      // Resource pre-configuration
      invitesWithExperiences: invites.filter(i => i.experiences && i.experiences.length > 0).length,
      invitesWithDestinations: invites.filter(i => i.destinations && i.destinations.length > 0).length
    };

    // Count redemptions in time periods
    invites.forEach(invite => {
      if (invite.redeemedBy && invite.redeemedBy.length > 0) {
        invite.redeemedBy.forEach(user => {
          const userCreatedAt = new Date(user.createdAt);
          if (userCreatedAt >= sevenDaysAgo) {
            analytics.redemptionsLast7Days++;
          }
          if (userCreatedAt >= thirtyDaysAgo) {
            analytics.redemptionsLast30Days++;
          }
        });
      }
    });

    // Redemption rate (percentage of invites that have been used at least once)
    analytics.redemptionRate = invites.length > 0
      ? ((invites.filter(i => i.usedCount > 0).length / invites.length) * 100).toFixed(1)
      : 0;

    backendLogger.info('Invite analytics retrieved', {
      userId,
      isSuperAdmin,
      totalInvites: analytics.totalInvites
    });

    res.json(analytics);
  } catch (error) {
    backendLogger.error('Error fetching invite analytics', {
      userId: req.user._id
    }, error);
    sendError(res, 'Failed to fetch analytics', error);
  }
}

module.exports = {
  getMyInvites,
  getInviteDetails,
  getUsersByInvite,
  getInviteAnalytics
};
