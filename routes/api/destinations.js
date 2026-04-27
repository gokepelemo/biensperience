const express = require('express');
const router = express.Router()
const destinationsCtrl = require('../../controllers/api/destinations');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { requireEmailVerification } = require('../../utilities/email-verification-middleware');
const { collaboratorLimiter, modificationLimiter } = require('../../config/rateLimiters');
const { validate } = require('../../utilities/validate');
const {
  createDestinationSchema,
  updateDestinationSchema,
  addDestinationPhotoSchema,
  setDefaultPhotoSchema,
  addDestinationPermissionSchema,
  updateDestinationPermissionSchema,
} = require('../../controllers/api/destinations.schemas');

router.get('/', destinationsCtrl.index);
router.post('/', ensureLoggedIn, requireEmailVerification, modificationLimiter, validate(createDestinationSchema), destinationsCtrl.create);
router.delete('/:id', ensureLoggedIn, modificationLimiter, destinationsCtrl.delete);
router.put('/:id', ensureLoggedIn, requireEmailVerification, modificationLimiter, validate(updateDestinationSchema), destinationsCtrl.update);
router.get('/:id', destinationsCtrl.show);
router.post('/:destinationId/user/:userId', ensureLoggedIn, destinationsCtrl.toggleUserFavoriteDestination);

// External data enrichment
router.get('/:id/enrich', ensureLoggedIn, destinationsCtrl.enrich);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, modificationLimiter, validate(addDestinationPhotoSchema), destinationsCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, modificationLimiter, destinationsCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, modificationLimiter, validate(setDefaultPhotoSchema), destinationsCtrl.setDefaultPhoto);

// Permission management routes (rate limited to prevent abuse)
router.post('/:id/permissions', ensureLoggedIn, collaboratorLimiter, validate(addDestinationPermissionSchema), destinationsCtrl.addDestinationPermission);
router.get('/:id/permissions', ensureLoggedIn, destinationsCtrl.getDestinationPermissions);
router.delete('/:id/permissions/:entityId/:entityType', ensureLoggedIn, collaboratorLimiter, destinationsCtrl.removeDestinationPermission);
router.patch('/:id/permissions/:userId', ensureLoggedIn, collaboratorLimiter, validate(updateDestinationPermissionSchema), destinationsCtrl.updateDestinationPermission);

module.exports = router;
