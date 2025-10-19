const express = require('express');
const router = express.Router()
const usersCtrl = require('../../controllers/api/users');
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { authLimiter, modificationLimiter } = require('../../config/rateLimiters');

router.post('/', authLimiter, usersCtrl.create); // Rate limit signup
router.get('/search', ensureLoggedIn, usersCtrl.searchUsers);
router.get('/all', ensureLoggedIn, usersCtrl.getAllUsers);
router.get('/:id', ensureLoggedIn, usersCtrl.getUser);
router.put('/:id', ensureLoggedIn, modificationLimiter, usersCtrl.updateUser);
router.post('/login', authLimiter, usersCtrl.login); // Rate limit login attempts
router.get('/check-token', ensureLoggedIn, usersCtrl.checkToken);

// Photo management routes
router.post('/:id/photos', ensureLoggedIn, modificationLimiter, usersCtrl.addPhoto);
router.delete('/:id/photos/:photoIndex', ensureLoggedIn, modificationLimiter, usersCtrl.removePhoto);
router.put('/:id/photos/default', ensureLoggedIn, modificationLimiter, usersCtrl.setDefaultPhoto);

// Role management routes (super admin only)
router.put('/:id/role', ensureLoggedIn, modificationLimiter, usersCtrl.updateUserRole);

module.exports = router;