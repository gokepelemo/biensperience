/**
 * shiftPlanItemDates orchestration — bulk shift root plan item scheduled_dates.
 *
 * Pure relocation from controllers/api/plans.js (bd #97c6).
 * Imports + helper signatures unchanged.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const Photo = require("../../../models/photo");
const permissions = require("../../../utilities/permission-enforcer");
const { getEnforcer } = require("../../../utilities/permission-enforcer");
const { asyncHandler, successResponse, errorResponse, validateObjectId } = require("../../../utilities/controller-helpers");
const backendLogger = require("../../../utilities/backend-logger");
const mongoose = require("mongoose");
const Activity = require('../../../models/activity');
const { sendCollaboratorInviteEmail, sendPlanAccessRequestEmail } = require('../../../utilities/email-service');
const { sendIfAllowed, notifyUser } = require('../../../utilities/notifications');

const { trackCreate, trackUpdate, trackDelete, trackPlanItemCompletion, trackCostAdded } = require('../../../utilities/activity-tracker');
const { hasFeatureFlag, hasFeatureFlagInContext, FEATURE_FLAG_CONTEXT } = require('../../../utilities/feature-flags');
const { broadcastEvent, sendEventToUser } = require('../../../utilities/websocket-server');
const {
  upsertMessagingChannel,
  getStreamServerClient,
  syncChannelMembers
} = require('../../../utilities/stream-chat');
const { insufficientPermissionsError } = require('../../../utilities/error-responses');
const crypto = require('crypto');
const planUnplanQueue = require('../../../utilities/plan-unplan-queue');
const { updateExperienceSignals, refreshSignalsAndAffinity } = require('../../../utilities/hidden-signals');

const { sanitizeLocation, filterNotesByVisibility, isPlanMember } = require('./_shared');


const shiftPlanItemDates = asyncHandler(async (req, res) => {
  // Validation enforced by shiftPlanItemDatesSchema (see plans.schemas.js).
  // The finite-and-non-zero guard below remains because the schema only
  // enforces that diff_ms is a number-or-string, not that it parses to a
  // finite, non-zero value.
  const { id } = req.params;
  const { diff_ms } = req.body;

  if (!Number.isFinite(Number(diff_ms)) || Number(diff_ms) === 0) {
    return errorResponse(res, null, 'diff_ms must be a finite non-zero number', 400);
  }

  const diffMs = Number(diff_ms);

  backendLogger.debug('shiftPlanItemDates: entry', { planId: id, diffMs });

  const plan = await Plan.findById(id);
  if (!plan) {
    return errorResponse(res, null, 'Plan not found', 404);
  }

  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({ userId: req.user._id, resource: plan });
  if (!permCheck.allowed) {
    return errorResponse(res, null, permCheck.reason || 'Insufficient permissions', 403);
  }

  let shiftedCount = 0;
  for (const item of plan.plan) {
    if (!item.parent && item.scheduled_date) {
      item.scheduled_date = new Date(new Date(item.scheduled_date).getTime() + diffMs);
      shiftedCount++;
    }
  }

  backendLogger.info('shiftPlanItemDates: shift complete', { planId: id, shiftedCount, diffMs });

  if (shiftedCount > 0) {
    await plan.save();
    try {
      broadcastEvent('plan', id.toString(), {
        type: 'plan:updated',
        payload: {
          plan: plan.toObject(),
          planId: id.toString(),
          updatedFields: ['plan_items.scheduled_date'],
          userId: req.user._id.toString()
        }
      }, req.user._id.toString());
    } catch (_) { /* ignore websocket errors */ }
  }

  return res.json({ shifted_count: shiftedCount, planId: id.toString() });
});

/**
 * Schedule a plan for deletion after an undo window (returns a cancel token).
 *
 * POST /api/plans/:id/schedule-delete
 * Response: { token, expiresAt }
 */

module.exports = {
  shiftPlanItemDates,
};
