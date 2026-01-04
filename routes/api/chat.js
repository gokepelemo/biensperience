const express = require('express');
const router = express.Router();
const ensureLoggedIn = require('../../config/ensureLoggedIn');
const { modificationLimiter } = require('../../config/rateLimiters');
const chatCtrl = require('../../controllers/api/chat');

// All chat routes require authentication
router.use(ensureLoggedIn);

// Token for Stream Chat client
router.post('/token', modificationLimiter, chatCtrl.token);

// Channel creation/get-or-create endpoints
router.post('/channels/dm', modificationLimiter, chatCtrl.dmChannel);
router.post('/channels/plan', modificationLimiter, chatCtrl.planChannel);
router.post('/channels/plan-item', modificationLimiter, chatCtrl.planItemChannel);

// BienBot is a per-user standard channel for notifications.
// "Cancel" means deleting the channel on Stream Chat; it will be recreated when a new notification is published.
router.delete('/channels/bienbot', modificationLimiter, chatCtrl.cancelBienBot);

module.exports = router;
