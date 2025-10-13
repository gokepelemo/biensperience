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
router.post("/experience/:experienceId", modificationLimiter, plansCtrl.createPlan); // Create plan for experience
router.get("/experience/:experienceId/all", plansCtrl.getExperiencePlans); // Get all plans for experience
router.put("/:id", modificationLimiter, plansCtrl.updatePlan); // Update plan
router.delete("/:id", modificationLimiter, plansCtrl.deletePlan); // Delete plan

// Plan item routes
router.post("/:id/items", modificationLimiter, plansCtrl.addPlanItem); // Add plan item
router.patch("/:id/items/:itemId", modificationLimiter, plansCtrl.updatePlanItem); // Update specific plan item
router.delete("/:id/items/:itemId", modificationLimiter, plansCtrl.deletePlanItem); // Delete plan item

// Collaborator management (rate limited to prevent abuse)
router.get("/:id/collaborators", plansCtrl.getCollaborators); // Get plan collaborators
router.post("/:id/permissions/collaborator", collaboratorLimiter, plansCtrl.addCollaborator);
router.delete("/:id/permissions/collaborator/:userId", collaboratorLimiter, plansCtrl.removeCollaborator);

module.exports = router;
