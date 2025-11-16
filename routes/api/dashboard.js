const express = require('express');
const router = express.Router();
const dashboardCtrl = require('../../controllers/api/dashboard');
const ensureLoggedIn = require('../../config/ensureLoggedIn');

router.get('/', ensureLoggedIn, dashboardCtrl.getDashboard);
router.get('/activity-feed', ensureLoggedIn, dashboardCtrl.getActivityFeed);
router.get('/upcoming-plans', ensureLoggedIn, dashboardCtrl.getUpcomingPlansEndpoint);

module.exports = router;