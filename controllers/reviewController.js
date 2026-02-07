const asyncHandler = require('express-async-handler');
const Review = require('../models/Review');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');

// @desc    Create review (patient, after completed appointment)
// @route   POST /api/reviews
const createReview = asyncHandler(async (req, res) => {
    const { appointmentId, rating, comment } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.patient.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (appointment.status !== 'completed') {
        res.status(400);
        throw new Error('Can only review completed appointments');
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({ appointment: appointmentId });
    if (existingReview) {
        res.status(400);
        throw new Error('You have already reviewed this appointment');
    }

    const review = await Review.create({
        patient: req.user._id,
        doctor: appointment.doctor,
        appointment: appointmentId,
        rating,
        comment: comment || '',
    });

    res.status(201).json({ success: true, review });
});

// @desc    Get reviews for a doctor (public)
// @route   GET /api/reviews/doctor/:doctorId
const getDoctorReviews = asyncHandler(async (req, res) => {
    const reviews = await Review.find({ doctor: req.params.doctorId })
        .populate('patient', 'name avatar')
        .sort({ createdAt: -1 });

    res.json({ success: true, count: reviews.length, reviews });
});

module.exports = { createReview, getDoctorReviews };
