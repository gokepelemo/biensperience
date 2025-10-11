const express = require('express');
const router = express.Router();
const multer  = require('multer')
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../../uploads/images') })
const photosCtrl = require('../../controllers/api/photos');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, upload.single('image'), photosCtrl.create);
router.post('/url', ensureLoggedIn, photosCtrl.createFromUrl);
router.delete('/:id', ensureLoggedIn, photosCtrl.delete);
router.put('/:id', ensureLoggedIn, photosCtrl.update);

module.exports = router;
