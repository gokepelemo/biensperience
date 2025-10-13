const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { collaboratorLimiter, modificationLimiter } = require('../../config/rateLimiters');

router.get('/', ensureLoggedIn, experiencesCtrl.index);
router.post('/', ensureLoggedIn, modificationLimiter, experiencesCtrl.create);
router.get('/tag/:tagSlug', ensureLoggedIn, experiencesCtrl.getTagName);
router.get('/user/:userId/created', ensureLoggedIn, experiencesCtrl.showUserCreatedExperiences);
router.get('/user/:userId', ensureLoggedIn, experiencesCtrl.showUserExperiences);
router.delete('/:id', ensureLoggedIn, modificationLimiter, experiencesCtrl.delete);
router.put('/:id/transfer-ownership', ensureLoggedIn, collaboratorLimiter, experiencesCtrl.transferOwnership);
router.put('/:id', ensureLoggedIn, modificationLimiter, experiencesCtrl.update);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
router.post('/:experienceId/plan-item', ensureLoggedIn, modificationLimiter, experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, modificationLimiter, experiencesCtrl.updatePlanItem);
router.post('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.addUser);
router.delete('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.removeUser);
router.post('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.userPlanItemDone);

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
