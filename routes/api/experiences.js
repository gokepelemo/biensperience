const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.get('/', ensureLoggedIn, experiencesCtrl.index);
router.post('/', ensureLoggedIn, experiencesCtrl.create);
router.get('/tag/:tagSlug', ensureLoggedIn, experiencesCtrl.getTagName);
router.get('/user/:userId/created', ensureLoggedIn, experiencesCtrl.showUserCreatedExperiences);
router.get('/user/:userId', ensureLoggedIn, experiencesCtrl.showUserExperiences);
router.delete('/:id', ensureLoggedIn, experiencesCtrl.delete);
router.put('/:id', ensureLoggedIn, experiencesCtrl.update);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
router.post('/:experienceId/plan-item', ensureLoggedIn, experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.updatePlanItem);
router.post('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.addUser);
router.delete('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.removeUser);
router.post('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.userPlanItemDone);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, experiencesCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, experiencesCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, experiencesCtrl.setDefaultPhoto);

module.exports = router;
