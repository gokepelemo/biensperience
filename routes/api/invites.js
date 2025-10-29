/**
 * Invite Code Routes
 *
 * Endpoints for managing invite codes:
 * - GET /api/invites - Get all invites created by current user
 * - POST /api/invites - Create a new invite code
 * - POST /api/invites/bulk - Create multiple invite codes from CSV
 * - POST /api/invites/validate - Validate an invite code
 * - POST /api/invites/redeem - Redeem an invite code
 * - DELETE /api/invites/:id - Deactivate an invite code
 * - POST /api/invites/email - Send email invite to non-existent collaborator
 */

const express = require('express');
const router = express.Router();
const InviteCode = require('../../models/inviteCode');
const User = require('../../models/user');
const Plan = require('../../models/plan');
const backendLogger = require('../../utilities/backend-logger');
const { isSuperAdmin } = require('../../utilities/permissions');
const { sendInviteEmail } = require('../../utilities/email-service');

/**
 * Middleware to ensure user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to ensure user is super admin
 */
function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

/**
 * GET /api/invites
 * Get all invite codes created by the current user (or all if super admin)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let invites;

    if (isSuperAdmin(req.user)) {
      // Super admins can see all invites
      invites = await InviteCode.find()
        .populate('createdBy', 'name email')
        .populate('redeemedBy', 'name email')
        .populate('experiences', 'title')
        .populate('destinations', 'name country')
        .sort('-createdAt');
    } else {
      // Regular users only see their own invites
      invites = await InviteCode.getUserInvites(req.user._id);
    }

    res.json(invites);
  } catch (error) {
    backendLogger.error('Error retrieving invites', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to retrieve invites' });
  }
});

/**
 * POST /api/invites
 * Create a new invite code
 * Body: {
 *   email: string (optional),
 *   inviteeName: string (optional),
 *   experiences: [experienceId] (optional),
 *   destinations: [destinationId] (optional),
 *   maxUses: number (default: 1),
 *   expiresAt: Date (optional),
 *   customMessage: string (optional)
 * }
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      email,
      inviteeName,
      experiences,
      destinations,
      maxUses,
      expiresAt,
      customMessage,
      sendEmail = false
    } = req.body;

    const invite = await InviteCode.createInvite({
      createdBy: req.user._id,
      email,
      inviteeName,
      experiences: experiences || [],
      destinations: destinations || [],
      maxUses: maxUses !== undefined ? maxUses : 1,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      customMessage
    });

    backendLogger.info('Invite code created', {
      userId: req.user._id,
      inviteId: invite._id,
      code: invite.code,
      email: invite.email,
      audit: true
    });

    // Send email if requested and email is provided
    let emailSent = false;
    if (sendEmail && email) {
      try {
        await sendInviteEmail({
          toEmail: email,
          inviterName: req.user.name,
          inviteCode: invite.code,
          inviteeName,
          customMessage,
          experiencesCount: (experiences || []).length,
          destinationsCount: (destinations || []).length
        });

        emailSent = true;

        // Update invite metadata
        invite.inviteMetadata = {
          ...invite.inviteMetadata,
          emailSent: true,
          sentAt: new Date(),
          sentFrom: req.user._id
        };
        await invite.save();

        backendLogger.info('Invite email sent successfully', {
          userId: req.user._id,
          inviteId: invite._id,
          email,
          audit: true
        });
      } catch (emailError) {
        backendLogger.error('Failed to send invite email, but invite code created', {
          userId: req.user._id,
          inviteId: invite._id,
          email,
          error: emailError.message
        });
        // Don't fail the request - invite code was created successfully
      }
    }

    res.status(201).json({
      ...invite.toObject(),
      emailSent
    });
  } catch (error) {
    backendLogger.error('Error creating invite code', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create invite code' });
  }
});

/**
 * POST /api/invites/bulk
 * Create multiple invite codes from CSV data (super admin only)
 * Body: {
 *   invites: [{
 *     email: string,
 *     name: string,
 *     experiences: [experienceId] (optional),
 *     destinations: [destinationId] (optional),
 *     maxUses: number (optional),
 *     expiresAt: Date (optional),
 *     customMessage: string (optional)
 *   }]
 * }
 */
router.post('/bulk', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { invites, sendEmail = false } = req.body;

    if (!Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ error: 'invites must be a non-empty array' });
    }

    const result = await InviteCode.bulkCreateInvites(invites, req.user._id);

    // Send emails if requested
    let emailResults = { sent: 0, failed: 0 };
    if (sendEmail && result.created.length > 0) {
      backendLogger.info('Sending bulk invite emails', {
        userId: req.user._id,
        count: result.created.length
      });

      for (const invite of result.created) {
        try {
          await sendInviteEmail({
            toEmail: invite.email,
            inviterName: req.user.name,
            inviteCode: invite.code,
            inviteeName: invite.inviteeName,
            customMessage: invite.customMessage,
            experiencesCount: invite.experiences?.length || 0,
            destinationsCount: invite.destinations?.length || 0
          });

          // Update invite metadata
          invite.inviteMetadata = {
            ...invite.inviteMetadata,
            emailSent: true,
            sentAt: new Date(),
            sentFrom: req.user._id
          };
          await invite.save();

          emailResults.sent++;
        } catch (emailError) {
          backendLogger.error('Failed to send bulk invite email', {
            userId: req.user._id,
            inviteId: invite._id,
            email: invite.email,
            error: emailError.message
          });
          emailResults.failed++;
        }
      }

      backendLogger.info('Bulk invite emails completed', {
        userId: req.user._id,
        sent: emailResults.sent,
        failed: emailResults.failed
      });
    }

    backendLogger.info('Bulk invite codes created', {
      userId: req.user._id,
      totalRequested: invites.length,
      successCount: result.created.length,
      errorCount: result.errors.length,
      emailsSent: emailResults.sent,
      emailsFailed: emailResults.failed,
      audit: true
    });

    res.status(201).json({
      ...result,
      emailResults: sendEmail ? emailResults : null
    });
  } catch (error) {
    backendLogger.error('Error creating bulk invites', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create bulk invites' });
  }
});

/**
 * POST /api/invites/validate
 * Validate an invite code (public endpoint)
 * Body: { code: string, email: string (optional) }
 */
router.post('/validate', async (req, res) => {
  try {
    const { code, email } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const result = await InviteCode.validateCode(code, email);

    if (result.valid) {
      // Don't expose full invite details for security
      res.json({
        valid: true,
        inviteeName: result.invite.inviteeName,
        customMessage: result.invite.customMessage,
        experienceCount: result.invite.experiences?.length || 0,
        destinationCount: result.invite.destinations?.length || 0
      });
    } else {
      res.status(400).json({
        valid: false,
        error: result.error
      });
    }
  } catch (error) {
    backendLogger.error('Error validating invite code', {
      error: error.message
    });
    res.status(500).json({ error: 'Failed to validate invite code' });
  }
});

/**
 * POST /api/invites/redeem
 * Redeem an invite code for the current user
 * Body: { code: string }
 *
 * This endpoint is called after signup with an invite code.
 * It adds the experiences and destinations to the user's account.
 */
router.post('/redeem', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }

    const result = await InviteCode.redeemCode(code, req.user._id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const invite = result.invite;

    // Add experiences to user's plans with proper snapshot creation
    const experiencesAdded = [];
    for (const experience of invite.experiences) {
      try {
        // Check if user already has a plan for this experience
        const existingPlan = await Plan.findOne({
          experience: experience._id,
          user: req.user._id
        });

        if (!existingPlan) {
          // Create snapshot of current plan items (matching plans.js controller logic)
          const planSnapshot = experience.plan_items.map(item => ({
            plan_item_id: item._id,
            complete: false,
            cost: item.cost_estimate || 0,
            planning_days: item.planning_days || 0,
            text: item.text,
            url: item.url,
            photo: item.photo,
            parent: item.parent
          }));

          // Create a new plan with snapshot
          const newPlan = await Plan.create({
            experience: experience._id,
            user: req.user._id,
            plan: planSnapshot,  // Correct field name with snapshot data
            permissions: [{
              entity: 'user',
              type: 'owner',
              _id: req.user._id
            }]
          });

          if (newPlan) {
            experiencesAdded.push(experience);
            backendLogger.debug('Plan created from invite redemption', {
              userId: req.user._id,
              experienceId: experience._id,
              planId: newPlan._id,
              itemsCount: planSnapshot.length
            });
          }
        }
      } catch (err) {
        backendLogger.error('Error adding experience to plan', {
          userId: req.user._id,
          experienceId: experience._id,
          error: err.message
        });
      }
    }

    // Destinations are handled by the frontend (add to favorites)
    // We just return them here

    backendLogger.info('Invite code redeemed', {
      userId: req.user._id,
      inviteId: invite._id,
      code: invite.code,
      experiencesAdded: experiencesAdded.length,
      destinationsProvided: invite.destinations.length,
      audit: true
    });

    res.json({
      success: true,
      experiencesAdded,
      destinations: invite.destinations,
      customMessage: invite.customMessage
    });
  } catch (error) {
    backendLogger.error('Error redeeming invite code', {
      userId: req.user?._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to redeem invite code' });
  }
});

/**
 * DELETE /api/invites/:id
 * Deactivate an invite code
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify invite belongs to user (or user is super admin)
    const invite = await InviteCode.findById(id);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    if (invite.createdBy.toString() !== req.user._id.toString() && !isSuperAdmin(req.user)) {
      return res.status(403).json({ error: 'Not authorized to deactivate this invite' });
    }

    const success = await InviteCode.deactivateInvite(id);

    if (success) {
      backendLogger.info('Invite code deactivated', {
        userId: req.user._id,
        inviteId: id,
        code: invite.code,
        audit: true
      });

      res.json({
        success: true,
        message: 'Invite deactivated successfully'
      });
    } else {
      res.status(404).json({ error: 'Invite not found or already deactivated' });
    }
  } catch (error) {
    backendLogger.error('Error deactivating invite code', {
      userId: req.user._id,
      inviteId: req.params.id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to deactivate invite' });
  }
});

/**
 * POST /api/invites/email
 * Send email invite to a non-existent collaborator
 * Body: {
 *   email: string,
 *   name: string,
 *   resourceType: 'experience' | 'destination' | 'plan',
 *   resourceId: string,
 *   resourceName: string,
 *   customMessage: string (optional)
 * }
 */
router.post('/email', requireAuth, async (req, res) => {
  try {
    const {
      email,
      name,
      resourceType,
      resourceId,
      resourceName,
      customMessage
    } = req.body;

    if (!email || !name || !resourceType || !resourceId) {
      return res.status(400).json({
        error: 'email, name, resourceType, and resourceId are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        error: 'User already exists. Please add them as a collaborator directly.'
      });
    }

    // Determine which array to populate
    const experiences = resourceType === 'experience' ? [resourceId] : [];
    const destinations = resourceType === 'destination' ? [resourceId] : [];

    // Create invite code
    const invite = await InviteCode.createInvite({
      createdBy: req.user._id,
      email,
      inviteeName: name,
      experiences,
      destinations,
      maxUses: 1,
      customMessage: customMessage || `${req.user.name} has invited you to collaborate on "${resourceName}"`
    });

    // Send email with invite code and signup link
    let emailSent = false;
    try {
      await sendInviteEmail({
        toEmail: email,
        inviterName: req.user.name,
        inviteCode: invite.code,
        inviteeName: name,
        customMessage: invite.customMessage,
        experiencesCount: experiences.length,
        destinationsCount: destinations.length
      });

      emailSent = true;

      // Update invite metadata
      invite.inviteMetadata = {
        ...invite.inviteMetadata,
        emailSent: true,
        sentAt: new Date(),
        sentFrom: req.user._id
      };
      await invite.save();

      backendLogger.info('Email invite sent successfully', {
        userId: req.user._id,
        inviteId: invite._id,
        email,
        resourceType,
        resourceId,
        audit: true
      });
    } catch (emailError) {
      backendLogger.error('Failed to send invite email, but invite code created', {
        userId: req.user._id,
        inviteId: invite._id,
        email,
        error: emailError.message
      });
      // Don't fail the request - invite code was created successfully
    }

    res.status(201).json({
      success: true,
      invite,
      message: emailSent
        ? 'Invite created and email sent successfully.'
        : 'Invite created but email failed to send. You can share the invite code manually.',
      emailSent
    });
  } catch (error) {
    backendLogger.error('Error creating email invite', {
      userId: req.user._id,
      error: error.message
    });
    res.status(500).json({ error: 'Failed to create email invite' });
  }
});

module.exports = router;
