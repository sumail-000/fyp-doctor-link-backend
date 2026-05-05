const express = require('express');
const router = express.Router();
const {
    listConversations, getThread, sendMessage, markThreadRead, unreadCount,
} = require('../controllers/messageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('patient', 'doctor'));

router.get('/conversations', listConversations);
router.get('/thread', getThread);
router.post('/', sendMessage);
router.put('/read', markThreadRead);
router.get('/unread-count', unreadCount);

module.exports = router;
