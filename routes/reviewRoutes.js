const express = require('express');
const router = express.Router();
const { createReview, getDoctorReviews } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, authorize('patient'), createReview);
router.get('/doctor/:doctorId', getDoctorReviews);

module.exports = router;
