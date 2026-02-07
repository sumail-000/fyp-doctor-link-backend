const express = require('express');
const router = express.Router();
const { getMyNotifications, markNotificationRead, markAllRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.get('/my', protect, getMyNotifications);
router.put('/read-all', protect, markAllRead);
router.put('/:id/read', protect, markNotificationRead);

module.exports = router;
