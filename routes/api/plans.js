const express = require("express");
const router = express.Router();
const plansCtrl = require("../../controllers/api/plans");
const ensureLoggedIn = require("../../config/ensureLoggedIn");
const { collaboratorLimiter, modificationLimiter } = require("../../config/rateLimiters");
const { validate } = require("../../utilities/validate");
const {
  createPlanSchema,
  updatePlanSchema,
  requestPlanAccessSchema,
  respondToAccessRequestSchema,
  reorderPlanItemsSchema,
  addPlanItemSchema,
  updatePlanItemSchema,
  addCollaboratorSchema,
  addPlanItemNoteSchema,
  updatePlanItemNoteSchema,
  addPlanItemDetailSchema,
  updatePlanItemDetailSchema,
  assignPlanItemSchema,
  addCostSchema,
  updateCostSchema,
  setMemberLocationSchema,
  shiftPlanItemDatesSchema,
  updatePlanAIConfigSchema,
} = require("../../controllers/api/plans.schemas");

// Unauthenticated routes (token-based approval and plan preview)
router.get("/:id/access-requests/approve-by-token", modificationLimiter, plansCtrl.approveByToken);
router.get("/:id/preview", plansCtrl.getPlanPreview);

// All routes below require authentication
router.use(ensureLoggedIn);

// Plan CRUD routes
router.get("/", plansCtrl.getUserPlans); // Get all plans for current user
router.get("/:id", plansCtrl.getPlanById); // Get specific plan
router.post("/:id/access-requests", modificationLimiter, validate(requestPlanAccessSchema), plansCtrl.requestPlanAccess); // Request access to a plan
router.get("/:id/access-requests", plansCtrl.getAccessRequests); // Get access requests (owner only)
router.patch("/:id/access-requests/:requestId", modificationLimiter, validate(respondToAccessRequestSchema), plansCtrl.respondToAccessRequest); // Approve/decline access request (owner only)
router.post("/experience/:experienceId", modificationLimiter, validate(createPlanSchema), plansCtrl.createPlan); // Create plan for experience
router.get("/experience/:experienceId/all", plansCtrl.getExperiencePlans); // Get all plans for experience
router.get("/experience/:experienceId/check", plansCtrl.checkUserPlanForExperience); // Lightweight: Check if user has plan for experience
router.put("/:id", modificationLimiter, validate(updatePlanSchema), plansCtrl.updatePlan); // Update plan
router.post("/:id/shift-item-dates", modificationLimiter, validate(shiftPlanItemDatesSchema), plansCtrl.shiftPlanItemDates); // Shift all root plan item scheduled_dates by diff_ms
router.put("/:id/reorder", modificationLimiter, validate(reorderPlanItemsSchema), plansCtrl.reorderPlanItems); // Reorder plan items
router.post("/:id/schedule-delete", modificationLimiter, plansCtrl.scheduleDeletePlan); // Schedule plan deletion (returns undo token)
router.delete("/scheduled/:token", modificationLimiter, plansCtrl.cancelScheduledDeletePlan); // Cancel a scheduled deletion (undo)
router.delete("/:id", modificationLimiter, plansCtrl.deletePlan); // Delete plan

// Plan item routes
router.post("/:id/items", modificationLimiter, validate(addPlanItemSchema), plansCtrl.addPlanItem); // Add plan item
router.patch("/:id/items/:itemId", modificationLimiter, validate(updatePlanItemSchema), plansCtrl.updatePlanItem); // Update specific plan item
router.delete("/:id/items/:itemId", modificationLimiter, plansCtrl.deletePlanItem); // Delete plan item
router.put("/:id/items/:itemId/pin", modificationLimiter, plansCtrl.pinPlanItem); // Pin/unpin plan item (toggle)
router.delete("/:id/pin", modificationLimiter, plansCtrl.unpinPlanItem); // Unpin currently pinned item

// Collaborator management (rate limited to prevent abuse)
router.get("/:id/collaborators", plansCtrl.getCollaborators); // Get plan collaborators
router.post("/:id/permissions/collaborator", collaboratorLimiter, validate(addCollaboratorSchema), plansCtrl.addCollaborator);
router.delete("/:id/permissions/collaborator/:userId", collaboratorLimiter, plansCtrl.removeCollaborator);

// Plan item details routes - Notes
router.post("/:id/items/:itemId/notes", modificationLimiter, validate(addPlanItemNoteSchema), plansCtrl.addPlanItemNote); // Add note to plan item
router.patch("/:id/items/:itemId/notes/:noteId", modificationLimiter, validate(updatePlanItemNoteSchema), plansCtrl.updatePlanItemNote); // Update note
router.delete("/:id/items/:itemId/notes/:noteId", modificationLimiter, plansCtrl.deletePlanItemNote); // Delete note
router.patch("/:id/items/:itemId/notes/:noteId/relevancy", modificationLimiter, plansCtrl.voteNoteRelevancy); // Toggle relevancy vote

// Plan item details routes - Generic (transport, parking, discount, documents, photos)
router.post("/:id/items/:itemId/details", modificationLimiter, validate(addPlanItemDetailSchema), plansCtrl.addPlanItemDetail); // Add detail
router.patch("/:id/items/:itemId/details/:detailId?", modificationLimiter, validate(updatePlanItemDetailSchema), plansCtrl.updatePlanItemDetail); // Update detail (detailId optional for single-object types)
router.delete("/:id/items/:itemId/details/:detailId?", modificationLimiter, plansCtrl.deletePlanItemDetail); // Delete detail (detailId optional for single-object types)

// Plan item assignment routes
router.post("/:id/items/:itemId/assign", modificationLimiter, validate(assignPlanItemSchema), plansCtrl.assignPlanItem); // Assign plan item
router.delete("/:id/items/:itemId/assign", modificationLimiter, plansCtrl.unassignPlanItem); // Unassign plan item

// Cost management routes
router.get("/:id/costs", plansCtrl.getCosts); // Get all costs for a plan (with optional filters)
router.get("/:id/costs/summary", plansCtrl.getCostSummary); // Get cost summary/report
router.post("/:id/costs", modificationLimiter, validate(addCostSchema), plansCtrl.addCost); // Add a cost entry
router.patch("/:id/costs/:costId", modificationLimiter, validate(updateCostSchema), plansCtrl.updateCost); // Update a cost entry
router.delete("/:id/costs/:costId", modificationLimiter, plansCtrl.deleteCost); // Delete a cost entry

// Entity AI config routes
router.get("/:id/ai-config", plansCtrl.getPlanAIConfig);
router.put("/:id/ai-config", modificationLimiter, validate(updatePlanAIConfigSchema), plansCtrl.updatePlanAIConfig);

// Member travel origin routes (any plan member manages their own location)
router.put("/:id/member-location", modificationLimiter, validate(setMemberLocationSchema), plansCtrl.setMemberLocation); // Set/update own travel origin
router.delete("/:id/member-location", modificationLimiter, plansCtrl.removeMemberLocation); // Remove own travel origin

module.exports = router;
