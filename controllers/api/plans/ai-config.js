/**
 * Per-plan AI configuration getter and setter.
 *
 * Pure relocation from controllers/api/plans.js (bd #97c6).
 * Imports + helper signatures unchanged.
 */

const Plan = require("../../../models/plan");
const Experience = require("../../../models/experience");
const Destination = require("../../../models/destination");
const User = require("../../../models/user");
const Photo = require("../../../models/photo");
const permissions = require("../../../utilities/permissions");
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


async function getPlanAIConfig(req, res) {
  try {
    const plan = await Plan.findById(req.params.id).select('ai_config');
    if (!plan) return errorResponse(res, null, 'Plan not found', 404);

    const enforcer = getEnforcer({ Plan, Experience, Destination, User });
    const canView = await enforcer.canView({ userId: req.user._id, resource: plan });
    if (!canView.allowed) return errorResponse(res, null, canView.reason, 403);

    return successResponse(res, { ai_config: plan.ai_config || null });
  } catch (err) {
    return errorResponse(res, err, 'Failed to get AI config', 500);
  }
}


async function updatePlanAIConfig(req, res) {
  try {
    if (!hasFeatureFlag(req.user, 'ai_features')) {
      return errorResponse(res, null, 'AI features not available', 403);
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) return errorResponse(res, null, 'Plan not found', 404);

    const enforcer = getEnforcer({ Plan, Experience, Destination, User });
    const canEdit = await enforcer.canEdit({ userId: req.user._id, resource: plan });
    if (!canEdit.allowed) return errorResponse(res, null, canEdit.reason, 403);

    const allowed = ['preferred_provider', 'preferred_model', 'system_prompt_override', 'temperature', 'max_tokens', 'language', 'disabled'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[`ai_config.${key}`] = req.body[key];
    }

    const updated = await Plan.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true }).select('ai_config');
    return successResponse(res, { ai_config: updated.ai_config });
  } catch (err) {
    return errorResponse(res, err, 'Failed to update AI config', 500);
  }
}


module.exports = {
  getPlanAIConfig,
  updatePlanAIConfig,
};
