const express = require('express');
const router = express.Router();
const multer  = require('multer')
const upload = multer({ dest: '../../uploads/images' })
const photosCtrl = require('../../controllers/api/photos');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, upload.single('image'), photosCtrl.create);
router.delete('/:id', ensureLoggedIn, photosCtrl.delete);
router.put('/:id', ensureLoggedIn, photosCtrl.update);

module.exports = router;
