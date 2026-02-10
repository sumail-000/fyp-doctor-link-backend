const express = require('express');
const router = express.Router();
const { getActiveAnnouncements, dismissAnnouncement } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/active', getActiveAnnouncements);
router.put('/:id/dismiss', dismissAnnouncement);

module.exports = router;
