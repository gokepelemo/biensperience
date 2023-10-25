const express = require('express');
const router = express.Router()
const destinationsCtrl = require('../../controllers/api/destinations');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, destinationsCtrl.create);
router.delete('/:id', ensureLoggedIn, destinationsCtrl.delete);
router.put('/:id', ensureLoggedIn, destinationsCtrl.update);
router.get('/:id', ensureLoggedIn, destinationsCtrl.show);

module.exports = router;
