const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireEmailVerification } = require('../../utilities/email-verification-middleware');
const { collaboratorLimiter, modificationLimiter } = require('../../config/rateLimiters');
const { validate } = require('../../utilities/validate');
const {
  createExperienceSchema,
  updateExperienceSchema,
  createPlanItemSchema,
  updatePlanItemSchema,
  reorderPlanItemsSchema,
  transferOwnershipSchema,
  archiveExperienceSchema,
  addExperiencePhotoSchema,
  setDefaultPhotoSchema,
  addExperiencePermissionSchema,
  updateExperiencePermissionSchema,
  updateAIConfigSchema,
} = require('../../controllers/api/experiences.schemas');

router.get('/', experiencesCtrl.index);
router.post('/', ensureLoggedIn, requireEmailVerification, modificationLimiter, validate(createExperienceSchema), experiencesCtrl.create);
router.get('/tag/:tagSlug', experiencesCtrl.getTagName);
router.get('/tags', experiencesCtrl.getExperienceTags);
router.get('/user/:userId/created', ensureLoggedIn, experiencesCtrl.showUserCreatedExperiences);
router.get('/user/:userId', ensureLoggedIn, experiencesCtrl.showUserExperiences);
router.delete('/:id', ensureLoggedIn, modificationLimiter, experiencesCtrl.delete);
router.put('/:id/transfer-ownership', ensureLoggedIn, collaboratorLimiter, validate(transferOwnershipSchema), experiencesCtrl.transferOwnership);
router.get('/:id/check-plans', ensureLoggedIn, experiencesCtrl.checkExperiencePlans);
router.post('/:id/archive', ensureLoggedIn, modificationLimiter, experiencesCtrl.archiveExperience);
router.put('/:id', ensureLoggedIn, requireEmailVerification, modificationLimiter, validate(updateExperienceSchema), experiencesCtrl.update);
// OPTIMIZATION: Combined endpoint for SingleExperience page - must come before /:id to avoid route conflict
router.get('/:id/with-context', ensureLoggedIn, experiencesCtrl.showWithContext);
router.get('/:id', experiencesCtrl.show);
router.post('/:experienceId/plan-item', ensureLoggedIn, modificationLimiter, validate(createPlanItemSchema), experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, validate(updatePlanItemSchema), experiencesCtrl.updatePlanItem);
router.put('/:experienceId/reorder-plan-items', ensureLoggedIn, modificationLimiter, validate(reorderPlanItemsSchema), experiencesCtrl.reorderExperiencePlanItems);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, modificationLimiter, validate(addExperiencePhotoSchema), experiencesCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, modificationLimiter, experiencesCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, modificationLimiter, validate(setDefaultPhotoSchema), experiencesCtrl.setDefaultPhoto);

// Entity AI config routes
router.get('/:id/ai-config', ensureLoggedIn, experiencesCtrl.getAIConfig);
router.put('/:id/ai-config', ensureLoggedIn, modificationLimiter, validate(updateAIConfigSchema), experiencesCtrl.updateAIConfig);

// Permission management routes (rate limited to prevent abuse)
router.post('/:id/permissions', ensureLoggedIn, collaboratorLimiter, validate(addExperiencePermissionSchema), experiencesCtrl.addExperiencePermission);
router.get('/:id/permissions', ensureLoggedIn, experiencesCtrl.getExperiencePermissions);
router.delete('/:id/permissions/:entityId/:entityType', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.removeExperiencePermission);
router.patch('/:id/permissions/:userId', ensureLoggedIn, collaboratorLimiter, validate(updateExperiencePermissionSchema), experiencesCtrl.updateExperiencePermission);

module.exports = router;
