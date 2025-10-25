const express = require('express');
const router = express.Router()
const destinationsCtrl = require('../../controllers/api/destinations');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireEmailVerification } = require('../../utilities/email-verification-middleware');
const { collaboratorLimiter, modificationLimiter } = require('../../config/rateLimiters');

router.get('/', ensureLoggedIn, destinationsCtrl.index);
router.post('/', ensureLoggedIn, requireEmailVerification, modificationLimiter, destinationsCtrl.create);
router.delete('/:id', ensureLoggedIn, modificationLimiter, destinationsCtrl.delete);
router.put('/:id', ensureLoggedIn, requireEmailVerification, modificationLimiter, destinationsCtrl.update);
router.get('/:id', ensureLoggedIn, destinationsCtrl.show);
router.post('/:destinationId/user/:userId', ensureLoggedIn, destinationsCtrl.toggleUserFavoriteDestination);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, modificationLimiter, destinationsCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, modificationLimiter, destinationsCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, modificationLimiter, destinationsCtrl.setDefaultPhoto);

// Permission management routes (rate limited to prevent abuse)
router.post('/:id/permissions', ensureLoggedIn, collaboratorLimiter, destinationsCtrl.addDestinationPermission);
router.get('/:id/permissions', ensureLoggedIn, destinationsCtrl.getDestinationPermissions);
router.delete('/:id/permissions/:entityId/:entityType', ensureLoggedIn, collaboratorLimiter, destinationsCtrl.removeDestinationPermission);
router.patch('/:id/permissions/:userId', ensureLoggedIn, collaboratorLimiter, destinationsCtrl.updateDestinationPermission);

module.exports = router;
