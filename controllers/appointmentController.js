const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');

// @desc    Create appointment (patient books)
// @route   POST /api/appointments
const createAppointment = asyncHandler(async (req, res) => {
    const { doctorId, date, timeSlot } = req.body;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.status !== 'approved') {
        res.status(404);
        throw new Error('Doctor not found or not approved');
    }

    // Check if slot is already booked
    const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: new Date(date),
        timeSlot,
        status: { $in: ['pending', 'confirmed'] },
    });

    if (existingAppointment) {
        res.status(400);
        throw new Error('This time slot is already booked');
    }

    const appointment = await Appointment.create({
        patient: req.user._id,
        doctor: doctorId,
        date: new Date(date),
        timeSlot,
        fee: doctor.fee,
        status: 'pending',
        paymentStatus: 'pending',
    });

    await Notification.create({
        user: doctor.user,
        title: 'New appointment request',
        message: `New appointment requested for ${appointment.date.toDateString()} at ${appointment.timeSlot}.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    res.status(201).json({ success: true, appointment });
});

// @desc    Get patient's appointments
// @route   GET /api/appointments/my
const getMyAppointments = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = { patient: req.user._id };
    if (status && status !== 'all') query.status = status;

    const appointments = await Appointment.find(query)
        .populate({
            path: 'doctor',
            select: 'fullName specialization avatar location fee rating',
        })
        .sort({ date: -1 });

    res.json({ success: true, count: appointments.length, appointments });
});

// @desc    Get doctor's appointments
// @route   GET /api/appointments/doctor
const getDoctorAppointments = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    const { status } = req.query;
    const query = { doctor: doctor._id };
    if (status && status !== 'all') query.status = status;

    const appointments = await Appointment.find(query)
        .populate('patient', 'name email phone avatar city')
        .sort({ date: -1 });

    res.json({ success: true, count: appointments.length, appointments });
});

// @desc    Accept appointment (doctor)
// @route   PUT /api/appointments/:id/accept
const acceptAppointment = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.doctor.toString() !== doctor._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (appointment.status !== 'pending') {
        res.status(400);
        throw new Error('Appointment is not in pending state');
    }

    appointment.status = 'confirmed';
    await appointment.save();

    await Notification.create({
        user: appointment.patient,
        title: 'Appointment confirmed',
        message: `Your appointment has been confirmed for ${appointment.date.toDateString()} at ${appointment.timeSlot}.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    res.json({ success: true, appointment });
});

// @desc    Reject appointment (doctor)
// @route   PUT /api/appointments/:id/reject
const rejectAppointment = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.doctor.toString() !== doctor._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    appointment.status = 'cancelled';
    appointment.cancelledBy = 'doctor';
    appointment.cancelReason = req.body.reason || 'Rejected by doctor';
    await appointment.save();

    await Notification.create({
        user: appointment.patient,
        title: 'Appointment rejected',
        message: `Your appointment request was rejected. Reason: ${req.body.reason || 'Not provided'}.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    // Refund if paid
    if (appointment.paymentStatus === 'paid') {
        await Payment.findOneAndUpdate(
            { appointment: appointment._id },
            { status: 'refunded', refundedAt: new Date() }
        );
        appointment.paymentStatus = 'refunded';
        await appointment.save();
    }

    res.json({ success: true, appointment });
});

// @desc    Complete appointment (doctor)
// @route   PUT /api/appointments/:id/complete
const completeAppointment = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.doctor.toString() !== doctor._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (appointment.status !== 'confirmed') {
        res.status(400);
        throw new Error('Only confirmed appointments can be completed');
    }

    appointment.status = 'completed';
    await appointment.save();

    await Notification.create({
        user: appointment.patient,
        title: 'Appointment completed',
        message: `Your appointment on ${appointment.date.toDateString()} at ${appointment.timeSlot} is marked as completed.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    // Update doctor stats
    const uniquePatients = await Appointment.distinct('patient', {
        doctor: doctor._id,
        status: 'completed',
    });
    doctor.totalPatients = uniquePatients.length;
    await doctor.save();

    res.json({ success: true, appointment });
});

// @desc    Cancel appointment (patient)
// @route   PUT /api/appointments/:id/cancel
const cancelAppointment = asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.patient.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (!['pending', 'confirmed'].includes(appointment.status)) {
        res.status(400);
        throw new Error('Cannot cancel this appointment');
    }

    appointment.status = 'cancelled';
    appointment.cancelledBy = 'patient';
    appointment.cancelReason = req.body.reason || 'Cancelled by patient';
    await appointment.save();

    const doctor = await Doctor.findById(appointment.doctor).select('user');
    if (doctor?.user) {
        await Notification.create({
            user: doctor.user,
            title: 'Appointment cancelled',
            message: `A patient cancelled their appointment on ${appointment.date.toDateString()} at ${appointment.timeSlot}.`,
            type: 'appointment',
            meta: { appointmentId: appointment._id.toString() },
        });
    }

    // Refund if paid
    if (appointment.paymentStatus === 'paid') {
        await Payment.findOneAndUpdate(
            { appointment: appointment._id },
            { status: 'refunded', refundedAt: new Date() }
        );
        appointment.paymentStatus = 'refunded';
        await appointment.save();
    }

    res.json({ success: true, appointment });
});

// @desc    Get patient dashboard stats
// @route   GET /api/appointments/dashboard
const getPatientDashboard = asyncHandler(async (req, res) => {
    const [upcoming, total, completed, doctors] = await Promise.all([
        Appointment.find({
            patient: req.user._id,
            status: { $in: ['pending', 'confirmed'] },
            date: { $gte: new Date() },
        })
            .populate({ path: 'doctor', select: 'fullName specialization avatar location' })
            .sort({ date: 1 })
            .limit(5),
        Appointment.countDocuments({ patient: req.user._id }),
        Appointment.countDocuments({ patient: req.user._id, status: 'completed' }),
        Appointment.distinct('doctor', { patient: req.user._id, status: 'completed' }),
    ]);

    // Get recent doctors
    const recentDoctors = await Doctor.find({ _id: { $in: doctors } })
        .select('fullName specialization avatar rating')
        .limit(5);

    res.json({
        success: true,
        stats: {
            totalAppointments: total,
            completedAppointments: completed,
            upcomingAppointments: upcoming.length,
            doctorsConsulted: doctors.length,
        },
        upcomingAppointments: upcoming,
        recentDoctors,
    });
});

// @desc    Get single appointment with payment details (patient)
// @route   GET /api/appointments/:id
const getAppointmentDetail = asyncHandler(async (req, res) => {
    const appointment = await Appointment.findById(req.params.id)
        .populate({
            path: 'doctor',
            select: 'fullName specialization avatar location fee rating education languages',
        })
        .populate({
            path: 'patient',
            select: 'name email phone',
        });

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    // Ensure the requesting user is the patient or the doctor
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const doctor = await Doctor.findOne({ user: req.user._id });
    const isDoctor = doctor && appointment.doctor._id.toString() === doctor._id.toString();

    if (!isPatient && !isDoctor) {
        res.status(403);
        throw new Error('Not authorized to view this appointment');
    }

    // Get payment record for this appointment
    const payment = await Payment.findOne({
        appointment: appointment._id,
        status: { $in: ['completed', 'refunded'] },
    });

    // Get platform fee settings for display
    const Setting = require('../models/Setting');
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});

    res.json({
        success: true,
        appointment,
        payment: payment || null,
        patientPlatformFeePercent: settings.patientPlatformFeePercent ?? 0,
        doctorPlatformFeePercent: settings.doctorPlatformFeePercent ?? 10,
    });
});

module.exports = {
    createAppointment, getMyAppointments, getDoctorAppointments,
    acceptAppointment, rejectAppointment, completeAppointment,
    cancelAppointment, getPatientDashboard, getAppointmentDetail,
};
