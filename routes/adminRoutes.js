const express = require('express');
const router = express.Router();
const {
    getDashboardStats,
    getPendingDoctors, approveDoctor, rejectDoctor, getAllDoctors, editDoctor,
    getAllUsers, blockUser, unblockUser,
    getUserDetail, resetUserPassword,
    getDoctorDetail,
    getAllAppointments, overrideAppointmentStatus,
    getAllPayments,
    getReports,
    getSettings, updateSettings, resetAllSettings,
    changeAdminPassword, clearAllNotifications,
    getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Doctor management
router.get('/doctors', getAllDoctors);
router.get('/doctors/pending', getPendingDoctors);
router.get('/doctors/:id/detail', getDoctorDetail);
router.put('/doctors/:id/approve', approveDoctor);
router.put('/doctors/:id/reject', rejectDoctor);
router.put('/doctors/:id', editDoctor);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/block', blockUser);
router.put('/users/:id/unblock', unblockUser);
router.put('/users/:id/reset-password', resetUserPassword);

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
router.put('/settings/reset', resetAllSettings);

// Security
router.put('/change-password', changeAdminPassword);

// Notifications
router.delete('/notifications/clear', clearAllNotifications);

// Announcements
router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

module.exports = router;
