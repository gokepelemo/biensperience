const express = require("express");
const router = express.Router();
const plansCtrl = require("../../controllers/api/plans");
const ensureLoggedIn = require("../../config/ensureLoggedIn");
const { collaboratorLimiter, modificationLimiter } = require("../../config/rateLimiters");

// All routes require authentication
router.use(ensureLoggedIn);

// Plan CRUD routes
router.get("/", plansCtrl.getUserPlans); // Get all plans for current user
router.get("/:id", plansCtrl.getPlanById); // Get specific plan
router.post("/:id/access-requests", modificationLimiter, plansCtrl.requestPlanAccess); // Request access to a plan
router.get("/:id/access-requests", plansCtrl.getAccessRequests); // Get access requests (owner only)
router.patch("/:id/access-requests/:requestId", modificationLimiter, plansCtrl.respondToAccessRequest); // Approve/decline access request (owner only)
router.post("/experience/:experienceId", modificationLimiter, plansCtrl.createPlan); // Create plan for experience
router.get("/experience/:experienceId/all", plansCtrl.getExperiencePlans); // Get all plans for experience
router.get("/experience/:experienceId/check", plansCtrl.checkUserPlanForExperience); // Lightweight: Check if user has plan for experience
router.put("/:id", modificationLimiter, plansCtrl.updatePlan); // Update plan
router.put("/:id/reorder", modificationLimiter, plansCtrl.reorderPlanItems); // Reorder plan items
router.delete("/:id", modificationLimiter, plansCtrl.deletePlan); // Delete plan

// Plan item routes
router.post("/:id/items", modificationLimiter, plansCtrl.addPlanItem); // Add plan item
router.patch("/:id/items/:itemId", modificationLimiter, plansCtrl.updatePlanItem); // Update specific plan item
router.delete("/:id/items/:itemId", modificationLimiter, plansCtrl.deletePlanItem); // Delete plan item
router.put("/:id/items/:itemId/pin", modificationLimiter, plansCtrl.pinPlanItem); // Pin/unpin plan item (toggle)
router.delete("/:id/pin", modificationLimiter, plansCtrl.unpinPlanItem); // Unpin currently pinned item

// Collaborator management (rate limited to prevent abuse)
router.get("/:id/collaborators", plansCtrl.getCollaborators); // Get plan collaborators
router.post("/:id/permissions/collaborator", collaboratorLimiter, plansCtrl.addCollaborator);
router.delete("/:id/permissions/collaborator/:userId", collaboratorLimiter, plansCtrl.removeCollaborator);

// Plan item details routes - Notes
router.post("/:id/items/:itemId/notes", modificationLimiter, plansCtrl.addPlanItemNote); // Add note to plan item
router.patch("/:id/items/:itemId/notes/:noteId", modificationLimiter, plansCtrl.updatePlanItemNote); // Update note
router.delete("/:id/items/:itemId/notes/:noteId", modificationLimiter, plansCtrl.deletePlanItemNote); // Delete note

// Plan item details routes - Generic (transport, parking, discount, documents, photos)
router.post("/:id/items/:itemId/details", modificationLimiter, plansCtrl.addPlanItemDetail); // Add detail
router.patch("/:id/items/:itemId/details/:detailId?", modificationLimiter, plansCtrl.updatePlanItemDetail); // Update detail (detailId optional for single-object types)
router.delete("/:id/items/:itemId/details/:detailId?", modificationLimiter, plansCtrl.deletePlanItemDetail); // Delete detail (detailId optional for single-object types)

// Plan item assignment routes
router.post("/:id/items/:itemId/assign", modificationLimiter, plansCtrl.assignPlanItem); // Assign plan item
router.delete("/:id/items/:itemId/assign", modificationLimiter, plansCtrl.unassignPlanItem); // Unassign plan item

// Cost management routes
router.get("/:id/costs", plansCtrl.getCosts); // Get all costs for a plan (with optional filters)
router.get("/:id/costs/summary", plansCtrl.getCostSummary); // Get cost summary/report
router.post("/:id/costs", modificationLimiter, plansCtrl.addCost); // Add a cost entry
router.patch("/:id/costs/:costId", modificationLimiter, plansCtrl.updateCost); // Update a cost entry
router.delete("/:id/costs/:costId", modificationLimiter, plansCtrl.deleteCost); // Delete a cost entry

module.exports = router;
