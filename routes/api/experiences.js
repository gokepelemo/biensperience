const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.get('/', ensureLoggedIn, experiencesCtrl.index);
router.post('/', ensureLoggedIn, experiencesCtrl.create);
router.delete('/:id', ensureLoggedIn, experiencesCtrl.delete);
router.put('/:id', ensureLoggedIn, experiencesCtrl.update);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
router.get('/user/:userId', ensureLoggedIn, experiencesCtrl.showUserExperiences);
router.post('/:experienceId/plan-item', ensureLoggedIn, experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.updatePlanItem);
router.post('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.addUser);
router.delete('/:experienceId/user/:userId', ensureLoggedIn, experiencesCtrl.removeUser);
router.post('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.userPlanItemDone);

module.exports = router;
