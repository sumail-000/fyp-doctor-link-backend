const express = require('express');
const router = express.Router();
const { submitContactMessage, getContactMessages, markContactMessageRead } = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', submitContactMessage);
router.get('/', protect, authorize('admin'), getContactMessages);
router.put('/:id/read', protect, authorize('admin'), markContactMessageRead);

module.exports = router;
