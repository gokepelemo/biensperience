const express = require('express');
const router = express.Router();
const { createUploadMiddleware } = require('../../utilities/upload-middleware');
const photosCtrl = require('../../controllers/api/photos');
const ensureLoggedIn = require('../../config/ensureLoggedIn')
const { validate } = require('../../utilities/validate');
const {
  createPhotoSchema,
  createPhotoBatchSchema,
  getByIdsSchema,
  createPhotoFromUrlSchema,
  updatePhotoSchema,
  photoCollaboratorSchema,
} = require('../../controllers/api/photos.schemas');

const { upload } = createUploadMiddleware({ dest: 'uploads/images' });

router.post('/', ensureLoggedIn, upload.single('image'), validate(createPhotoSchema), photosCtrl.create);
router.post('/batch', ensureLoggedIn, upload.array('images', 10), validate(createPhotoBatchSchema), photosCtrl.createBatch);
router.post('/batch-get', ensureLoggedIn, validate(getByIdsSchema), photosCtrl.getByIds);
router.post('/url', ensureLoggedIn, validate(createPhotoFromUrlSchema), photosCtrl.createFromUrl);
router.delete('/:id', ensureLoggedIn, photosCtrl.delete);
router.put('/:id', ensureLoggedIn, validate(updatePhotoSchema), photosCtrl.update);

// Permission management routes
router.post('/:id/permissions/collaborator', ensureLoggedIn, validate(photoCollaboratorSchema), photosCtrl.addCollaborator);
router.delete('/:id/permissions/collaborator/:userId', ensureLoggedIn, photosCtrl.removeCollaborator);
router.post('/:id/permissions/contributor', ensureLoggedIn, validate(photoCollaboratorSchema), photosCtrl.addContributor);
router.delete('/:id/permissions/contributor/:userId', ensureLoggedIn, photosCtrl.removeContributor);

module.exports = router;
