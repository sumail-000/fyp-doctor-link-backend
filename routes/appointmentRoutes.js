const express = require('express');
const router = express.Router();
const {
    createAppointment, getMyAppointments, getDoctorAppointments,
    acceptAppointment, rejectAppointment, completeAppointment,
    cancelAppointment, getPatientDashboard,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

// Patient routes
router.post('/', protect, authorize('patient'), createAppointment);
router.get('/my', protect, authorize('patient'), getMyAppointments);
router.get('/dashboard', protect, authorize('patient'), getPatientDashboard);
router.put('/:id/cancel', protect, authorize('patient'), cancelAppointment);

// Doctor routes
router.get('/doctor', protect, authorize('doctor'), getDoctorAppointments);
router.put('/:id/accept', protect, authorize('doctor'), acceptAppointment);
router.put('/:id/reject', protect, authorize('doctor'), rejectAppointment);
router.put('/:id/complete', protect, authorize('doctor'), completeAppointment);

module.exports = router;
