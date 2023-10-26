const express = require('express');
const router = express.Router()
const usersCtrl = require('../../controllers/api/users');
const ensureLoggedIn = require('../../config/ensureLoggedIn')

router.post('/', usersCtrl.create);
router.get('/:id', ensureLoggedIn, usersCtrl.getUser);
router.post('/login', usersCtrl.login);
router.get('/check-token', ensureLoggedIn, usersCtrl.checkToken);
router.post('/:userId/experiences/:experienceId', ensureLoggedIn, usersCtrl.addExperience);
router.delete('/:userId/experiences/:experienceId', ensureLoggedIn, usersCtrl.removeExperience);

module.exports = router;