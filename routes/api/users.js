const express = require('express');
const router = express.Router()
const usersCtrl = require('../../controllers/api/users');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', usersCtrl.create);
router.get('/:id', ensureLoggedIn, usersCtrl.getUser);
router.put('/:id', ensureLoggedIn, usersCtrl.updateUser);
router.post('/login', usersCtrl.login);
router.get('/check-token', ensureLoggedIn, usersCtrl.checkToken);

module.exports = router;