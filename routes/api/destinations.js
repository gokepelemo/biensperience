const express = require('express');
const router = express.Router()
const destinationsCtrl = require('../../controllers/api/destinations');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.get('/', ensureLoggedIn, destinationsCtrl.index);
router.post('/', ensureLoggedIn, destinationsCtrl.create);
router.delete('/:id', ensureLoggedIn, destinationsCtrl.delete);
router.put('/:id', ensureLoggedIn, destinationsCtrl.update);
router.get('/:id', ensureLoggedIn, destinationsCtrl.show);
router.post('/:destinationId/user/:userId', ensureLoggedIn, destinationsCtrl.toggleUserFavoriteDestination)

module.exports = router;
