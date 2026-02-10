const express = require('express');
const router = express.Router();
const {
    createAppointment, getMyAppointments, getDoctorAppointments,
    acceptAppointment, rejectAppointment, completeAppointment,
    cancelAppointment, getPatientDashboard, getAppointmentDetail,
    markNoShow, rescheduleAppointment, acceptReschedule, rejectReschedule,
    getDoctorNoShows,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');

// Patient routes
router.post('/', protect, authorize('patient'), createAppointment);
router.get('/my', protect, authorize('patient'), getMyAppointments);
router.get('/dashboard', protect, authorize('patient'), getPatientDashboard);

// Doctor routes (must come before /:id to avoid "doctor" being treated as an ObjectId)
router.get('/doctor', protect, authorize('doctor'), getDoctorAppointments);
router.get('/doctor/no-shows', protect, authorize('doctor'), getDoctorNoShows);
router.put('/:id/accept', protect, authorize('doctor'), acceptAppointment);
router.put('/:id/reject', protect, authorize('doctor'), rejectAppointment);
router.put('/:id/complete', protect, authorize('doctor'), completeAppointment);
router.put('/:id/no-show', protect, authorize('doctor'), markNoShow);
router.put('/:id/reschedule/accept', protect, authorize('doctor'), acceptReschedule);
router.put('/:id/reschedule/reject', protect, authorize('doctor'), rejectReschedule);

// Patient reschedule
router.put('/:id/reschedule', protect, authorize('patient'), rescheduleAppointment);

// Param routes (must be last)
router.get('/:id', protect, getAppointmentDetail);
router.put('/:id/cancel', protect, authorize('patient'), cancelAppointment);

module.exports = router;
