const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireEmailVerification } = require('../../utilities/email-verification-middleware');
const { collaboratorLimiter, modificationLimiter } = require('../../config/rateLimiters');

router.get('/', ensureLoggedIn, experiencesCtrl.index);
router.post('/', ensureLoggedIn, requireEmailVerification, modificationLimiter, experiencesCtrl.create);
router.get('/tag/:tagSlug', ensureLoggedIn, experiencesCtrl.getTagName);
router.get('/user/:userId/created', ensureLoggedIn, experiencesCtrl.showUserCreatedExperiences);
router.get('/user/:userId', ensureLoggedIn, experiencesCtrl.showUserExperiences);
router.delete('/:id', ensureLoggedIn, modificationLimiter, experiencesCtrl.delete);
router.put('/:id/transfer-ownership', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.transferOwnership);
router.put('/:id', ensureLoggedIn, requireEmailVerification, modificationLimiter, experiencesCtrl.update);
// OPTIMIZATION: Combined endpoint for SingleExperience page - must come before /:id to avoid route conflict
router.get('/:id/with-context', ensureLoggedIn, experiencesCtrl.showWithContext);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
router.post('/:experienceId/plan-item', ensureLoggedIn, modificationLimiter, experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, experiencesCtrl.updatePlanItem);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, modificationLimiter, experiencesCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, modificationLimiter, experiencesCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, modificationLimiter, experiencesCtrl.setDefaultPhoto);

// Permission management routes (rate limited to prevent abuse)
router.post('/:id/permissions', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.addExperiencePermission);
router.get('/:id/permissions', ensureLoggedIn, experiencesCtrl.getExperiencePermissions);
router.delete('/:id/permissions/:entityId/:entityType', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.removeExperiencePermission);
router.patch('/:id/permissions/:userId', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.updateExperiencePermission);

module.exports = router;
