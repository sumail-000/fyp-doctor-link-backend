const asyncHandler = require('express-async-handler');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

// @desc    Apply as doctor (public - creates user + doctor profile)
// @route   POST /api/doctors/apply
const applyDoctor = asyncHandler(async (req, res) => {
    const {
        fullName, email, password, cnic, pmcNumber,
        specialization, experience, fee, location,
        degree, about, phone,
    } = req.body;

    // Check if PMC already registered
    const existingDoctor = await Doctor.findOne({ pmcNumber });
    if (existingDoctor) {
        res.status(400);
        throw new Error('A doctor with this PMC number already exists');
    }

    // Check if email already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.status(400);
        throw new Error('An account with this email already exists');
    }

    // Create user account with doctor role
    const user = await User.create({
        name: fullName,
        email,
        password,
        role: 'doctor',
        phone: phone || '',
    });

    // Create doctor profile
    const doctor = await Doctor.create({
        user: user._id,
        fullName,
        email,
        phone: phone || '',
        cnic,
        pmcNumber,
        specialization,
        experience,
        fee,
        location,
        degree: degree || '',
        about: about || '',
        status: 'pending',
    });

    res.status(201).json({
        success: true,
        message: 'Application submitted successfully. You will be notified once approved.',
        doctor: {
            _id: doctor._id,
            fullName: doctor.fullName,
            specialization: doctor.specialization,
            status: doctor.status,
        },
    });
});

// @desc    Doctor login (only approved doctors)
// @route   POST /api/doctors/login
const doctorLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email, role: 'doctor' }).select('+password');
    if (!user) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    if (user.isBlocked) {
        res.status(403);
        throw new Error('Your account has been blocked. Contact admin.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    const doctor = await Doctor.findOne({ user: user._id });
    if (!doctor || doctor.status !== 'approved') {
        res.status(403);
        throw new Error('Your application is still pending approval or has been rejected.');
    }

    res.json({
        success: true,
        token: user.getSignedJwtToken(),
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
        doctor: {
            _id: doctor._id,
            fullName: doctor.fullName,
            specialization: doctor.specialization,
            status: doctor.status,
            avatar: doctor.avatar,
        },
    });
});

// @desc    Get all approved doctors (public - for Doctors listing page)
// @route   GET /api/doctors
const getDoctors = asyncHandler(async (req, res) => {
    const { specialization, minFee, maxFee, minExperience, sort, search, page = 1, limit = 12 } = req.query;

    const query = { status: 'approved' };

    if (specialization && specialization !== 'All Specializations') {
        query.specialization = specialization;
    }
    if (minFee || maxFee) {
        query.fee = {};
        if (minFee) query.fee.$gte = Number(minFee);
        if (maxFee) query.fee.$lte = Number(maxFee);
    }
    if (minExperience) {
        query.experience = { $gte: Number(minExperience) };
    }
    if (search) {
        query.$or = [
            { fullName: { $regex: search, $options: 'i' } },
            { specialization: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
        ];
    }

    let sortOption = { rating: -1 };
    if (sort === 'experience') sortOption = { experience: -1 };
    if (sort === 'fee-low') sortOption = { fee: 1 };
    if (sort === 'fee-high') sortOption = { fee: -1 };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Doctor.countDocuments(query);
    const doctors = await Doctor.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(Number(limit))
        .select('-documents -cnic');

    res.json({
        success: true,
        count: doctors.length,
        total,
        totalPages: Math.ceil(total / Number(limit)),
        page: Number(page),
        doctors,
    });
});

// @desc    Get single doctor (public - for DoctorProfile page)
// @route   GET /api/doctors/:id
const getDoctor = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findById(req.params.id).select('-documents -cnic');
    if (!doctor || doctor.status !== 'approved') {
        res.status(404);
        throw new Error('Doctor not found');
    }

    res.json({ success: true, doctor });
});

// @desc    Get doctor's available slots for a date range (public - for booking)
// @route   GET /api/doctors/:id/slots
const getDoctorSlots = asyncHandler(async (req, res) => {
    const Appointment = require('../models/Appointment');
    const doctor = await Doctor.findById(req.params.id).select('schedule fee fullName');
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor not found');
    }

    // If a specific date is provided, return booked slots for that date
    let bookedSlots = [];
    if (req.query.date) {
        const queryDate = new Date(req.query.date);
        queryDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(queryDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const bookedAppointments = await Appointment.find({
            doctor: doctor._id,
            date: { $gte: queryDate, $lt: nextDay },
            status: { $in: ['pending', 'confirmed'] },
        }).select('timeSlot');

        bookedSlots = bookedAppointments.map(a => a.timeSlot);
    }

    res.json({
        success: true,
        schedule: doctor.schedule,
        fee: doctor.fee,
        bookedSlots,
    });
});

// @desc    Get doctor's own profile (authenticated doctor)
// @route   GET /api/doctors/me/profile
const getMyProfile = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }
    res.json({ success: true, doctor });
});

// @desc    Update doctor profile (authenticated doctor)
// @route   PUT /api/doctors/me/profile
const updateMyProfile = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    const allowedFields = [
        'fullName', 'phone', 'specialization', 'experience', 'fee',
        'location', 'degree', 'about', 'languages', 'avatar', 'isAvailable',
    ];

    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            doctor[field] = req.body[field];
        }
    });

    await doctor.save();

    // Sync name to user
    if (req.body.fullName) {
        await User.findByIdAndUpdate(req.user._id, { name: req.body.fullName });
    }

    if (req.body.avatar !== undefined) {
        await User.findByIdAndUpdate(req.user._id, { avatar: req.body.avatar });
    }

    res.json({ success: true, doctor });
});

// @desc    Update doctor schedule (authenticated doctor)
// @route   PUT /api/doctors/me/schedule
const updateSchedule = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    doctor.schedule = req.body.schedule;
    await doctor.save();

    res.json({ success: true, schedule: doctor.schedule });
});

// @desc    Get doctor dashboard stats
// @route   GET /api/doctors/me/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
    const Appointment = require('../models/Appointment');
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayAppointments, totalAppointments, pendingAppointments, completedAppointments] = await Promise.all([
        Appointment.find({ doctor: doctor._id, date: { $gte: today, $lt: tomorrow } })
            .populate('patient', 'name avatar')
            .sort({ timeSlot: 1 }),
        Appointment.countDocuments({ doctor: doctor._id }),
        Appointment.countDocuments({ doctor: doctor._id, status: 'pending' }),
        Appointment.countDocuments({ doctor: doctor._id, status: 'completed' }),
    ]);

    res.json({
        success: true,
        stats: {
            todayAppointments: todayAppointments.length,
            totalAppointments,
            pendingAppointments,
            completedAppointments,
            totalPatients: doctor.totalPatients,
            totalEarnings: doctor.totalEarnings,
            rating: doctor.rating,
            totalReviews: doctor.totalReviews,
        },
        todaySchedule: todayAppointments,
    });
});

// @desc    Get doctor's patients list
// @route   GET /api/doctors/me/patients
const getMyPatients = asyncHandler(async (req, res) => {
    const Appointment = require('../models/Appointment');
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    // Get unique patients from completed/confirmed appointments
    const appointments = await Appointment.find({
        doctor: doctor._id,
        status: { $in: ['completed', 'confirmed'] },
    }).populate('patient', 'name email phone avatar city createdAt');

    // Deduplicate patients and count appointments per patient
    const patientMap = new Map();
    appointments.forEach(apt => {
        if (apt.patient) {
            const pid = apt.patient._id.toString();
            if (!patientMap.has(pid)) {
                patientMap.set(pid, {
                    ...apt.patient.toObject(),
                    lastVisit: apt.date,
                    totalAppointments: 1,
                });
            } else {
                const existing = patientMap.get(pid);
                existing.totalAppointments += 1;
                if (new Date(apt.date) > new Date(existing.lastVisit)) {
                    existing.lastVisit = apt.date;
                }
            }
        }
    });

    const patients = Array.from(patientMap.values());

    res.json({ success: true, count: patients.length, patients });
});

// @desc    Get doctor's earnings
// @route   GET /api/doctors/me/earnings
const getMyEarnings = asyncHandler(async (req, res) => {
    const Payment = require('../models/Payment');
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    const payments = await Payment.find({ doctor: doctor._id, status: 'completed' })
        .populate('patient', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(20);

    // Monthly breakdown
    const monthlyEarnings = await Payment.aggregate([
        { $match: { doctor: doctor._id, status: 'completed' } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                total: { $sum: '$doctorEarning' },
                count: { $sum: 1 },
            },
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
    ]);

    res.json({
        success: true,
        totalEarnings: doctor.totalEarnings,
        recentPayments: payments,
        monthlyEarnings,
    });
});

module.exports = {
    applyDoctor, doctorLogin, getDoctors, getDoctor, getDoctorSlots,
    getMyProfile, updateMyProfile, updateSchedule,
    getDashboardStats, getMyPatients, getMyEarnings,
};
