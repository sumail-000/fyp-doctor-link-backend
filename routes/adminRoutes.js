const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getPendingDoctors, approveDoctor, rejectDoctor, getAllDoctors, editDoctor,
    getAllUsers, blockUser, unblockUser,
    getAllAppointments, overrideAppointmentStatus,
    getAllPayments,
    getReports,
    getSettings, updateSettings,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Doctor management
router.get('/doctors', getAllDoctors);
router.get('/doctors/pending', getPendingDoctors);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);
router.put('/doctors/:id', editDoctor);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/block', blockUser);
router.put('/users/:id/unblock', unblockUser);

// Appointment management
router.get('/appointments', getAllAppointments);
router.put('/appointments/:id/status', overrideAppointmentStatus);

// Payments
router.get('/payments', getAllPayments);

// Reports
router.get('/reports', getReports);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

module.exports = router;
