const express = require('express');
const router = express.Router();
const multer  = require('multer')
const path = require('path');
const upload = multer({ dest: path.join(__dirname, '../../uploads/images') })
const photosCtrl = require('../../controllers/api/photos');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', ensureLoggedIn, upload.single('image'), photosCtrl.create);
router.post('/batch', ensureLoggedIn, upload.array('images', 10), photosCtrl.createBatch);
router.post('/batch-get', ensureLoggedIn, photosCtrl.getByIds);
router.post('/url', ensureLoggedIn, photosCtrl.createFromUrl);
router.delete('/:id', ensureLoggedIn, photosCtrl.delete);
router.put('/:id', ensureLoggedIn, photosCtrl.update);

// Permission management routes
router.post('/:id/permissions/collaborator', ensureLoggedIn, photosCtrl.addCollaborator);
router.delete('/:id/permissions/collaborator/:userId', ensureLoggedIn, photosCtrl.removeCollaborator);
router.post('/:id/permissions/contributor', ensureLoggedIn, photosCtrl.addContributor);
router.delete('/:id/permissions/contributor/:userId', ensureLoggedIn, photosCtrl.removeContributor);

module.exports = router;
