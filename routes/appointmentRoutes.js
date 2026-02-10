const express = require('express');
const router = express.Router();
const {
    createAppointment, getMyAppointments, getDoctorAppointments,
    acceptAppointment, rejectAppointment, completeAppointment,
    cancelAppointment, getPatientDashboard, getAppointmentDetail,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

// Patient routes
router.post('/', protect, authorize('patient'), createAppointment);
router.get('/my', protect, authorize('patient'), getMyAppointments);
router.get('/dashboard', protect, authorize('patient'), getPatientDashboard);

// Doctor routes (must come before /:id to avoid "doctor" being treated as an ObjectId)
router.get('/doctor', protect, authorize('doctor'), getDoctorAppointments);
router.put('/:id/accept', protect, authorize('doctor'), acceptAppointment);
router.put('/:id/reject', protect, authorize('doctor'), rejectAppointment);
router.put('/:id/complete', protect, authorize('doctor'), completeAppointment);

// Param routes (must be last)
router.get('/:id', protect, getAppointmentDetail);
router.put('/:id/cancel', protect, authorize('patient'), cancelAppointment);

module.exports = router;
