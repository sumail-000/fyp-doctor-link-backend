const express = require('express');
const router = express.Router();
const {
    applyDoctor, doctorLogin, getDoctors, getDoctor, getDoctorSlots,
    getMyProfile, updateMyProfile, updateSchedule,
    getDashboardStats, getMyPatients, getMyEarnings,
    getRecommendedDoctors, getRecommendedForMe,
    geocodeMyLocation,
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');
const { uploadDoctorDocs } = require('../middleware/upload');

// Public routes
router.post('/apply', uploadDoctorDocs, applyDoctor);
router.post('/login', doctorLogin);
router.get('/', getDoctors);
router.get('/recommended', getRecommendedDoctors);

// Protected doctor routes (must come before /:id)
router.get('/me/profile', protect, authorize('doctor'), getMyProfile);
router.put('/me/profile', protect, authorize('doctor'), updateMyProfile);
router.put('/me/schedule', protect, authorize('doctor'), updateSchedule);
router.get('/me/dashboard', protect, authorize('doctor'), getDashboardStats);
router.get('/me/patients', protect, authorize('doctor'), getMyPatients);
router.get('/me/earnings', protect, authorize('doctor'), getMyEarnings);
router.get('/recommended-for-me', protect, authorize('patient'), getRecommendedForMe);
router.post('/me/geocode', protect, authorize('doctor'), geocodeMyLocation);

// Public param routes (after /me/*)
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);

module.exports = router;
