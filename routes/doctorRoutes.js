const express = require('express');
const router = express.Router();
const {
    applyDoctor, doctorLogin, getDoctors, getDoctor, getDoctorSlots,
    getMyProfile, updateMyProfile, updateSchedule,
    getDashboardStats, getMyPatients, getMyEarnings,
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.post('/apply', applyDoctor);
router.post('/login', doctorLogin);
router.get('/', getDoctors);

// Protected doctor routes (must come before /:id)
router.get('/me/profile', protect, authorize('doctor'), getMyProfile);
router.put('/me/profile', protect, authorize('doctor'), updateMyProfile);
router.put('/me/schedule', protect, authorize('doctor'), updateSchedule);
router.get('/me/dashboard', protect, authorize('doctor'), getDashboardStats);
router.get('/me/patients', protect, authorize('doctor'), getMyPatients);
router.get('/me/earnings', protect, authorize('doctor'), getMyEarnings);

// Public param routes (after /me/*)
router.get('/:id', getDoctor);
router.get('/:id/slots', getDoctorSlots);

module.exports = router;
