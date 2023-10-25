const express = require('express');
const router = express.Router()
const photosCtrl = require('../../controllers/api/photos');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, photosCtrl.create);
router.delete('/:id', ensureLoggedIn, photosCtrl.delete);
router.put('/:id', ensureLoggedIn, photosCtrl.update);

module.exports = router;
