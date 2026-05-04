const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const processRefund = require('../utils/processRefund');

// Normalize '9:00 AM' → '09:00 AM' for consistent slot format
const normalizeSlot = (slot) => {
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return slot;
    return `${match[1].padStart(2, '0')}:${match[2]} ${match[3].toUpperCase()}`;
};

// @desc    Create appointment (patient books)
// @route   POST /api/appointments
const createAppointment = asyncHandler(async (req, res) => {
    const { doctorId, date, timeSlot } = req.body;
    const normalizedSlot = normalizeSlot(timeSlot);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || doctor.status !== 'approved') {
        res.status(404);
        throw new Error('Doctor not found or not approved');
    }

    // Check if slot is already booked (include rescheduling to prevent conflicts)
    const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: new Date(date),
        timeSlot: normalizedSlot,
        status: { $in: ['pending', 'confirmed', 'rescheduling'] },
    });

    // Also check if any rescheduling appointment has this as its pending slot
    const pendingRescheduleConflict = await Appointment.findOne({
        doctor: doctorId,
        'pendingReschedule.date': new Date(date),
        'pendingReschedule.timeSlot': normalizedSlot,
        status: 'rescheduling',
    });

    if (existingAppointment || pendingRescheduleConflict) {
        res.status(400);
        throw new Error('This time slot is already booked');
    }

    const appointment = await Appointment.create({
        patient: req.user._id,
        doctor: doctorId,
        date: new Date(date),
        timeSlot: normalizedSlot,
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
    if (status && status !== 'all') {
        query.status = status.includes(',') ? { $in: status.split(',') } : status;
    }

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

    // Refund first so we don't cancel the appointment if Stripe fails
    if (appointment.paymentStatus === 'paid') {
        await processRefund(appointment._id);
        appointment.paymentStatus = 'refunded';
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

    if (appointment.paymentStatus === 'paid') {
        await processRefund(appointment._id);
        appointment.paymentStatus = 'refunded';
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

    // Ensure the requesting user is the patient, the doctor, or an admin
    const isAdmin = req.user.role === 'admin';
    const isPatient = appointment.patient._id.toString() === req.user._id.toString();
    const doctor = await Doctor.findOne({ user: req.user._id });
    const isDoctor = doctor && appointment.doctor._id.toString() === doctor._id.toString();

    if (!isPatient && !isDoctor && !isAdmin) {
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

// @desc    Mark appointment as no-show (doctor)
// @route   PUT /api/appointments/:id/no-show
const markNoShow = asyncHandler(async (req, res) => {
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
        throw new Error('Only confirmed appointments can be marked as no-show');
    }

    // Ensure appointment date+time has passed
    const now = new Date();
    const aptDate = new Date(appointment.date);
    if (aptDate > now) {
        res.status(400);
        throw new Error('Cannot mark future appointments as no-show');
    }

    appointment.status = 'no-show';
    appointment.noShowAt = now;
    appointment.noShowMarkedBy = 'doctor';
    await appointment.save();

    await Notification.create({
        user: appointment.patient,
        title: 'Missed Appointment',
        message: `You missed your appointment on ${appointment.date.toDateString()} at ${appointment.timeSlot}. You may reschedule up to ${appointment.maxReschedules - appointment.rescheduleCount} more time(s).`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    res.json({ success: true, appointment });
});

// @desc    Patient requests reschedule for a no-show appointment
// @route   PUT /api/appointments/:id/reschedule
const rescheduleAppointment = asyncHandler(async (req, res) => {
    const { date, timeSlot } = req.body;
    if (!date || !timeSlot) {
        res.status(400);
        throw new Error('New date and time slot are required');
    }

    const normalizedSlot = normalizeSlot(timeSlot);
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.patient.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (appointment.status !== 'no-show') {
        res.status(400);
        throw new Error('Only no-show appointments can be rescheduled');
    }

    if (appointment.rescheduleCount >= appointment.maxReschedules) {
        // Max reschedules reached — expire it
        appointment.status = 'expired';
        await appointment.save();
        res.status(400);
        throw new Error('Maximum reschedule attempts reached. This appointment has expired.');
    }

    // Check the new slot isn't already booked
    const conflict = await Appointment.findOne({
        doctor: appointment.doctor,
        date: new Date(date),
        timeSlot: normalizedSlot,
        status: { $in: ['pending', 'confirmed', 'rescheduling'] },
        _id: { $ne: appointment._id },
    });

    if (conflict) {
        res.status(400);
        throw new Error('This time slot is already booked');
    }

    // Store the old slot info and set pending reschedule
    appointment.pendingReschedule = {
        date: new Date(date),
        timeSlot: normalizedSlot,
        requestedAt: new Date(),
    };
    appointment.status = 'rescheduling';
    await appointment.save();

    // Notify doctor
    const doctor = await Doctor.findById(appointment.doctor).select('user');
    if (doctor?.user) {
        await Notification.create({
            user: doctor.user,
            title: 'Reschedule Request',
            message: `A patient has requested to reschedule their appointment to ${new Date(date).toDateString()} at ${normalizedSlot}.`,
            type: 'appointment',
            meta: { appointmentId: appointment._id.toString() },
        });
    }

    res.json({ success: true, appointment });
});

// @desc    Doctor accepts reschedule request
// @route   PUT /api/appointments/:id/reschedule/accept
const acceptReschedule = asyncHandler(async (req, res) => {
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

    if (appointment.status !== 'rescheduling' || !appointment.pendingReschedule?.date) {
        res.status(400);
        throw new Error('No pending reschedule request');
    }

    // Double-check the new slot is still free
    const conflict = await Appointment.findOne({
        doctor: doctor._id,
        date: appointment.pendingReschedule.date,
        timeSlot: appointment.pendingReschedule.timeSlot,
        status: { $in: ['pending', 'confirmed', 'rescheduling'] },
        _id: { $ne: appointment._id },
    });

    if (conflict) {
        res.status(400);
        throw new Error('The requested slot has been booked by another patient in the meantime');
    }

    // Record in history
    appointment.rescheduleHistory.push({
        fromDate: appointment.date,
        fromTimeSlot: appointment.timeSlot,
        toDate: appointment.pendingReschedule.date,
        toTimeSlot: appointment.pendingReschedule.timeSlot,
        requestedAt: appointment.pendingReschedule.requestedAt,
        status: 'accepted',
        respondedAt: new Date(),
    });

    // Move to new slot
    appointment.date = appointment.pendingReschedule.date;
    appointment.timeSlot = appointment.pendingReschedule.timeSlot;
    appointment.pendingReschedule = undefined;
    appointment.rescheduleCount += 1;
    appointment.status = 'confirmed';
    await appointment.save();

    await Notification.create({
        user: appointment.patient,
        title: 'Reschedule Accepted',
        message: `Your reschedule request has been accepted. New appointment: ${appointment.date.toDateString()} at ${appointment.timeSlot}.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    res.json({ success: true, appointment });
});

// @desc    Doctor rejects reschedule request
// @route   PUT /api/appointments/:id/reschedule/reject
const rejectReschedule = asyncHandler(async (req, res) => {
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

    if (appointment.status !== 'rescheduling' || !appointment.pendingReschedule?.date) {
        res.status(400);
        throw new Error('No pending reschedule request');
    }

    // Record in history
    appointment.rescheduleHistory.push({
        fromDate: appointment.date,
        fromTimeSlot: appointment.timeSlot,
        toDate: appointment.pendingReschedule.date,
        toTimeSlot: appointment.pendingReschedule.timeSlot,
        requestedAt: appointment.pendingReschedule.requestedAt,
        status: 'rejected',
        respondedAt: new Date(),
    });

    appointment.pendingReschedule = undefined;
    appointment.rescheduleCount += 1;

    // If max reschedules reached, expire it
    if (appointment.rescheduleCount >= appointment.maxReschedules) {
        appointment.status = 'expired';
    } else {
        appointment.status = 'no-show'; // Back to no-show so patient can try again
    }
    await appointment.save();

    const remainingAttempts = appointment.maxReschedules - appointment.rescheduleCount;
    await Notification.create({
        user: appointment.patient,
        title: 'Reschedule Rejected',
        message: remainingAttempts > 0
            ? `Your reschedule request was rejected. You have ${remainingAttempts} reschedule attempt(s) remaining.`
            : `Your reschedule request was rejected and the appointment has expired. No more reschedule attempts available.`,
        type: 'appointment',
        meta: { appointmentId: appointment._id.toString() },
    });

    res.json({ success: true, appointment });
});

// @desc    Get no-show patients for a doctor
// @route   GET /api/appointments/doctor/no-shows
const getDoctorNoShows = asyncHandler(async (req, res) => {
    const doctor = await Doctor.findOne({ user: req.user._id });
    if (!doctor) {
        res.status(404);
        throw new Error('Doctor profile not found');
    }

    const noShows = await Appointment.find({
        doctor: doctor._id,
        status: { $in: ['no-show', 'expired', 'rescheduling'] },
    })
        .populate('patient', 'name email phone avatar city')
        .sort({ noShowAt: -1 });

    // Aggregate no-show counts per patient
    const patientMap = {};
    noShows.forEach(apt => {
        const pid = apt.patient?._id?.toString();
        if (!pid) return;
        if (!patientMap[pid]) {
            patientMap[pid] = {
                patient: apt.patient,
                noShowCount: 0,
                appointments: [],
            };
        }
        patientMap[pid].noShowCount += 1;
        patientMap[pid].appointments.push(apt);
    });

    res.json({
        success: true,
        totalNoShows: noShows.length,
        patients: Object.values(patientMap),
        appointments: noShows,
    });
});

module.exports = {
    createAppointment, getMyAppointments, getDoctorAppointments,
    acceptAppointment, rejectAppointment, completeAppointment,
    cancelAppointment, getPatientDashboard, getAppointmentDetail,
    markNoShow, rescheduleAppointment, acceptReschedule, rejectReschedule,
    getDoctorNoShows,
};
