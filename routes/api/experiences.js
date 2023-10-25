const express = require('express');
const router = express.Router()
const experiencesCtrl = require('../../controllers/api/experiences');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, experiencesCtrl.create);
router.delete('/:id', ensureLoggedIn, experiencesCtrl.delete);
router.put('/:id', ensureLoggedIn, experiencesCtrl.update);
router.get('/:id', ensureLoggedIn, experiencesCtrl.show);
// update plan items with its own controller function
router.post('/:experienceId/plan-item', ensureLoggedIn, experiencesCtrl.update);
router.delete('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.update);
router.put('/:experienceId/plan-item/:planItemId', ensureLoggedIn, experiencesCtrl.update);

module.exports = router;
