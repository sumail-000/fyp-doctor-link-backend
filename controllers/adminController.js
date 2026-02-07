const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Setting = require('../models/Setting');

// ==================== DASHBOARD ====================

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
    const [
        totalUsers, totalDoctors, totalAppointments,
        pendingDoctors, pendingAppointments,
        completedAppointments, cancelledAppointments,
    ] = await Promise.all([
        User.countDocuments({ role: 'patient' }),
        Doctor.countDocuments({ status: 'approved' }),
        Appointment.countDocuments(),
        Doctor.countDocuments({ status: 'pending' }),
        Appointment.countDocuments({ status: 'pending' }),
        Appointment.countDocuments({ status: 'completed' }),
        Appointment.countDocuments({ status: 'cancelled' }),
    ]);

    // Revenue
    const revenueResult = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' }, platformTotal: { $sum: '$platformFee' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;
    const platformRevenue = revenueResult[0]?.platformTotal || 0;

    // Recent pending doctors
    const recentPendingDoctors = await Doctor.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('fullName specialization experience pmcNumber location createdAt avatar');

    // Recent appointments
    const recentAppointments = await Appointment.find()
        .populate('patient', 'name avatar')
        .populate({ path: 'doctor', select: 'fullName specialization' })
        .sort({ createdAt: -1 })
        .limit(5);

    // Recent users
    const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name email role avatar createdAt');

    res.json({
        success: true,
        stats: {
            totalUsers,
            totalDoctors,
            totalAppointments,
            totalRevenue,
            platformRevenue,
            pendingDoctors,
            pendingAppointments,
            completedAppointments,
            cancelledAppointments,
        },
        recentPendingDoctors,
        recentAppointments,
        recentUsers,
    });
});

// ==================== DOCTOR APPROVALS ====================

// @desc    Get pending doctor applications
// @route   GET /api/admin/doctors/pending
const getPendingDoctors = asyncHandler(async (req, res) => {
    const doctors = await Doctor.find({ status: 'pending' })
        .populate('user', 'email createdAt')
        .sort({ createdAt: -1 });

    res.json({ success: true, count: doctors.length, doctors });
});

// @desc    Approve doctor
// @route   PUT /api/admin/doctors/:id/approve
const approveDoctor = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor not found');
    }

    doctor.status = 'approved';
    await doctor.save();

    res.json({ success: true, message: 'Doctor approved successfully', doctor });
});

// @desc    Reject doctor
// @route   PUT /api/admin/doctors/:id/reject
const rejectDoctor = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor not found');
    }

    doctor.status = 'rejected';
    await doctor.save();

    res.json({ success: true, message: 'Doctor rejected', doctor });
});

// @desc    Get all doctors (admin view)
// @route   GET /api/admin/doctors
const getAllDoctors = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { specialization: { $regex: search, $options: 'i' } },
        ];
    }

    const doctors = await Doctor.find(query)
        .populate('user', 'email isBlocked createdAt')
        .sort({ createdAt: -1 });

    res.json({ success: true, count: doctors.length, doctors });
});

// @desc    Edit doctor details (admin)
// @route   PUT /api/admin/doctors/:id
const editDoctor = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    if (!doctor) {
        res.status(404);
        throw new Error('Doctor not found');
    }

    res.json({ success: true, doctor });
});

// ==================== USER MANAGEMENT ====================

// @desc    Get all users
// @route   GET /api/admin/users
const getAllUsers = asyncHandler(async (req, res) => {
    const { role, status, search } = req.query;
    const query = {};

    if (role && role !== 'all') query.role = role;
    if (status === 'active') query.isBlocked = false;
    if (status === 'blocked') query.isBlocked = true;
    if (search) {
        query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
        ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });

    res.json({ success: true, count: users.length, users });
});

// @desc    Block user
// @route   PUT /api/admin/users/:id/block
const blockUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    if (user.role === 'admin') {
        res.status(400);
        throw new Error('Cannot block admin users');
    }

    user.isBlocked = true;
    await user.save();

    res.json({ success: true, message: 'User blocked', user });
});

// @desc    Unblock user
// @route   PUT /api/admin/users/:id/unblock
const unblockUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    user.isBlocked = false;
    await user.save();

    res.json({ success: true, message: 'User unblocked', user });
});

// ==================== APPOINTMENT MANAGEMENT ====================

// @desc    Get all appointments (admin)
// @route   GET /api/admin/appointments
const getAllAppointments = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    let appointments = await Appointment.find(query)
        .populate('patient', 'name avatar email')
        .populate({ path: 'doctor', select: 'fullName specialization avatar' })
        .sort({ createdAt: -1 });

    // Filter by search on populated fields
    if (search) {
        const s = search.toLowerCase();
        appointments = appointments.filter(a =>
            (a.patient?.name?.toLowerCase().includes(s)) ||
            (a.doctor?.fullName?.toLowerCase().includes(s))
        );
    }

    res.json({ success: true, count: appointments.length, appointments });
});

// @desc    Override appointment status (admin)
// @route   PUT /api/admin/appointments/:id/status
const overrideAppointmentStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid status');
    }

    // Handle refund if cancelling a paid appointment
    if (status === 'cancelled' && appointment.paymentStatus === 'paid') {
        await Payment.findOneAndUpdate(
            { appointment: appointment._id },
            { status: 'refunded', refundedAt: new Date() }
        );
        appointment.paymentStatus = 'refunded';
        appointment.cancelledBy = 'admin';
    }

    appointment.status = status;
    await appointment.save();

    res.json({ success: true, appointment });
});

// ==================== PAYMENTS ====================

// @desc    Get all payments (admin)
// @route   GET /api/admin/payments
const getAllPayments = asyncHandler(async (req, res) => {
    const { status, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    let payments = await Payment.find(query)
        .populate('patient', 'name avatar email')
        .populate({ path: 'doctor', select: 'fullName specialization' })
        .populate({ path: 'appointment', select: 'date timeSlot' })
        .sort({ createdAt: -1 });

    if (search) {
        const s = search.toLowerCase();
        payments = payments.filter(p =>
            (p.patient?.name?.toLowerCase().includes(s)) ||
            (p.doctor?.fullName?.toLowerCase().includes(s))
        );
    }

    // Summary stats
    const totalRevenue = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
    const totalRefunds = payments.filter(p => p.status === 'refunded').reduce((sum, p) => sum + p.amount, 0);
    const pendingAmount = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

    res.json({
        success: true,
        count: payments.length,
        summary: { totalRevenue, totalRefunds, pendingAmount },
        payments,
    });
});

// ==================== REPORTS ====================

// @desc    Get reports & analytics
// @route   GET /api/admin/reports
const getReports = asyncHandler(async (req, res) => {
    // Platform stats
    const [totalUsers, totalDoctors, totalAppointments] = await Promise.all([
        User.countDocuments({ role: 'patient' }),
        Doctor.countDocuments({ status: 'approved' }),
        Appointment.countDocuments(),
    ]);

    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const completionRate = totalAppointments > 0
        ? Math.round((completedAppointments / totalAppointments) * 100)
        : 0;

    // Revenue
    const revenueResult = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    // Average rating
    const ratingResult = await Doctor.aggregate([
        { $match: { status: 'approved', totalReviews: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
    ]);
    const avgRating = ratingResult[0]?.avgRating ? Math.round(ratingResult[0].avgRating * 10) / 10 : 0;

    // Top doctors
    const topDoctors = await Doctor.find({ status: 'approved' })
        .sort({ totalEarnings: -1 })
        .limit(5)
        .select('fullName specialization avatar rating totalReviews totalPatients totalEarnings');

    // Specialization distribution
    const specDistribution = await Doctor.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: '$specialization', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    // Monthly growth (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyUsers = await User.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const monthlyAppointments = await Appointment.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    const monthlyRevenue = await Payment.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                total: { $sum: '$amount' },
            },
        },
        { $sort: { _id: 1 } },
    ]);

    res.json({
        success: true,
        platformStats: {
            totalUsers,
            totalDoctors,
            totalAppointments,
            totalRevenue,
            avgRating,
            completionRate,
        },
        topDoctors,
        specDistribution,
        monthlyGrowth: { monthlyUsers, monthlyAppointments, monthlyRevenue },
    });
});

// ==================== SETTINGS ====================

// @desc    Get platform settings
// @route   GET /api/admin/settings
const getSettings = asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    res.json({ success: true, settings });
});

// @desc    Update platform settings
// @route   PUT /api/admin/settings
const updateSettings = asyncHandler(async (req, res) => {
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});

    Object.keys(req.body).forEach(key => {
        if (settings.schema.paths[key]) {
            settings[key] = req.body[key];
        }
    });

    await settings.save();
    res.json({ success: true, settings });
});

module.exports = {
    getDashboardStats,
    getPendingDoctors, approveDoctor, rejectDoctor, getAllDoctors, editDoctor,
    getAllUsers, blockUser, unblockUser,
    getAllAppointments, overrideAppointmentStatus,
    getAllPayments,
    getReports,
    getSettings, updateSettings,
};
