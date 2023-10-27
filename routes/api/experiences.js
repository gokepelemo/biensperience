const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.get('/', ensureLoggedIn, experiencesCtrl.index);
router.post('/', ensureLoggedIn, experiencesCtrl.create);
router.delete('/:id', ensureLoggedIn, experiencesCtrl.delete);
router.put('/:id', ensureLoggedIn, experiencesCtrl.update);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
router.post('/:experienceId/plan-item', ensureLoggedIn, experiencesCtrl.createPlanItem);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.deletePlanItem);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.updatePlanItem);

module.exports = router;
