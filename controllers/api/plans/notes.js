/**
 * Plan-item notes (add/update/delete/relevancy votes).
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


const addPlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { content, visibility = 'contributors' } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  // Validate visibility
  const validVisibility = ['private', 'contributors'];
  if (!validVisibility.includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility value. Must be "private" or "contributors"' });
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Permission check: owner, collaborator, or super admin
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });

  if (!permCheck.allowed) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: permCheck.reason
    });
  }

  // Find the plan item
  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  // Initialize details if not exists
  if (!planItem.details) {
    planItem.details = {
      notes: [],
      location: null,
      chat: [],
      photos: [],
      documents: []
    };
  }

  // Add note with visibility
  planItem.details.notes.push({
    user: req.user._id,
    content: content.trim(),
    visibility
  });

  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note added to plan item', {
    planId: id,
    itemId,
    userId: req.user._id.toString(),
    noteCount: planItem.details.notes.length
  });

  // Log activity for note addition
  const addedNote = planItem.details.notes[planItem.details.notes.length - 1];

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  // This avoids showing unfamiliar text if the original item was modified after planning
  let planItemName = planItem.text;
  if (!planItemName && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemName = originalItem.text;
      backendLogger.debug('Note add: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemName
      });
    }
  }
  planItemName = planItemName || 'Unnamed item';

  await Activity.log({
    action: 'plan_item_note_added',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Added note to plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    newState: {
      noteId: addedNote._id,
      content: addedNote.content.substring(0, 100), // Store first 100 chars for preview
      noteCount: planItem.details.notes.length
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Update a note on a plan item
 * Only the note author can update their own note
 * @param {string} visibility - 'private' (creator only) or 'contributors' (all collaborators)
 */

const updatePlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;
  const { content, visibility } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Note content is required' });
  }

  // Validate visibility if provided
  if (visibility !== undefined) {
    const validVisibility = ['private', 'contributors'];
    if (!validVisibility.includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility value. Must be "private" or "contributors"' });
    }
  }

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details || !planItem.details.notes) {
    return res.status(404).json({ error: 'No notes found' });
  }

  const note = planItem.details.notes.id(noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Only the note author can update
  if (note.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'You can only update your own notes'
    });
  }

  note.content = content.trim();
  if (visibility !== undefined) {
    note.visibility = visibility;
  }
  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note updated on plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  let planItemNameForUpdate = planItem.text;
  if (!planItemNameForUpdate && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemNameForUpdate = originalItem.text;
      backendLogger.debug('Note update: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemNameForUpdate
      });
    }
  }
  planItemNameForUpdate = planItemNameForUpdate || 'Unnamed item';

  // Log activity for note update
  await Activity.log({
    action: 'plan_item_note_updated',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemNameForUpdate
    },
    reason: `Updated note on plan item "${planItemNameForUpdate}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    newState: {
      noteId: note._id,
      content: note.content.substring(0, 100) // Store first 100 chars for preview
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Delete a note from a plan item
 * Only the note author can delete their own note
 */

const deletePlanItemNote = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details || !planItem.details.notes) {
    return res.status(404).json({ error: 'No notes found' });
  }

  const note = planItem.details.notes.id(noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Only the note author can delete
  if (note.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'You can only delete your own notes'
    });
  }

  // Capture note content before deletion for activity log
  const deletedNoteContent = note.content;

  // Get plan item name - prioritize snapshot text (what user actually has in their plan)
  // Only fall back to experience's plan_items if snapshot is completely empty (legacy data)
  let planItemName = planItem.text;
  if (!planItemName && planItem.plan_item_id && plan.experience?.plan_items) {
    const originalItem = plan.experience.plan_items.find(i =>
      i._id.toString() === planItem.plan_item_id.toString()
    );
    if (originalItem?.text) {
      planItemName = originalItem.text;
      backendLogger.debug('Note delete: Plan item name resolved from experience (snapshot was empty)', {
        planItemId: planItem._id?.toString(),
        originalItemId: planItem.plan_item_id?.toString(),
        resolvedName: planItemName
      });
    }
  }
  planItemName = planItemName || 'Unnamed item';

  planItem.details.notes.pull(noteId);
  await plan.save();

  // Populate user data for response (include photo fields for avatar display)
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos oauthProfilePhoto',
    populate: {
      path: 'photos',
      select: 'url caption'
    }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note deleted from plan item', {
    planId: id,
    itemId,
    noteId,
    userId: req.user._id.toString()
  });

  // Log activity for note deletion
  await Activity.log({
    action: 'plan_item_note_deleted',
    actor: {
      _id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    },
    resource: {
      id: plan._id,
      type: 'Plan',
      name: plan.experience?.name || 'Unknown Experience'
    },
    target: {
      id: itemId,
      type: 'PlanItem',
      name: planItemName
    },
    reason: `Deleted note from plan item "${planItemName}"`,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requestPath: req.path,
      requestMethod: req.method
    },
    previousState: {
      noteId: noteId,
      content: deletedNoteContent.substring(0, 100) // Store first 100 chars for preview
    }
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

/**
 * Toggle relevancy vote on a plan item note.
 * Owner and collaborators can vote a note as important (bullseye indicator).
 * Voting again by the same user removes their vote (toggle).
 */

const voteNoteRelevancy = asyncHandler(async (req, res) => {
  const { id, itemId, noteId } = req.params;

  const plan = await Plan.findById(id);
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // Only owners and collaborators can vote (not contributors or non-members)
  const enforcer = getEnforcer({ Plan, Experience, Destination, User });
  const permCheck = await enforcer.canEdit({
    userId: req.user._id,
    resource: plan
  });
  if (!permCheck.allowed) {
    return res.status(403).json({ error: 'Insufficient permissions', message: permCheck.reason });
  }

  const planItem = plan.plan.id(itemId);
  if (!planItem) {
    return res.status(404).json({ error: 'Plan item not found' });
  }

  if (!planItem.details?.notes) {
    return res.status(404).json({ error: 'No notes found' });
  }

  const note = planItem.details.notes.id(noteId);
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  // Visibility check: private notes can only be voted on by their author
  if (note.visibility === 'private' && note.user.toString() !== req.user._id.toString()) {
    return res.status(403).json({ error: 'You cannot vote on a private note that is not yours' });
  }

  // Toggle vote
  const userId = req.user._id.toString();
  const existingIndex = (note.relevancy_votes || []).findIndex(v => v.toString() === userId);
  if (existingIndex !== -1) {
    note.relevancy_votes.splice(existingIndex, 1); // Remove vote
  } else {
    note.relevancy_votes.push(req.user._id); // Add vote
  }

  await plan.save();

  // Populate user data for response
  await plan.populate({
    path: 'plan.details.notes.user',
    select: 'name email photos oauthProfilePhoto',
    populate: { path: 'photos', select: 'url caption' }
  });
  await plan.populate('experience', 'name');

  backendLogger.info('Note relevancy vote toggled', {
    planId: id,
    itemId,
    noteId,
    userId,
    voteCount: note.relevancy_votes.length
  });

  // Filter notes based on visibility before returning
  filterNotesByVisibility(plan, req.user._id);

  res.json(plan);
});

// ============================================================================

module.exports = {
  addPlanItemNote,
  updatePlanItemNote,
  deletePlanItemNote,
  voteNoteRelevancy,
};
