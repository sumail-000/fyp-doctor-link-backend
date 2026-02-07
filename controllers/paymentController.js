const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Doctor = require('../models/Doctor');
const Setting = require('../models/Setting');

// @desc    Create payment intent (Stripe checkout)
// @route   POST /api/payments/create-checkout
const createCheckout = asyncHandler(async (req, res) => {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId).populate({
        path: 'doctor',
        select: 'fullName fee',
    });

    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    if (appointment.patient.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized');
    }

    if (appointment.paymentStatus === 'paid') {
        res.status(400);
        throw new Error('Payment already completed');
    }

    // Get platform fee
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    const platformFeePercent = settings.platformFeePercent || 10;

    const amount = appointment.fee;
    const platformFee = Math.round(amount * (platformFeePercent / 100));
    const doctorEarning = amount - platformFee;

    // Create Stripe checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
            price_data: {
                currency: 'pkr',
                product_data: {
                    name: `Consultation with ${appointment.doctor.fullName}`,
                    description: `Appointment on ${appointment.date.toDateString()} at ${appointment.timeSlot}`,
                },
                unit_amount: amount * 100, // Stripe uses smallest currency unit
            },
            quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL}/patient/appointments?payment=success`,
        cancel_url: `${process.env.CLIENT_URL}/patient/appointments?payment=cancelled`,
        metadata: {
            appointmentId: appointment._id.toString(),
            patientId: req.user._id.toString(),
            doctorId: appointment.doctor._id.toString(),
        },
    });

    // Create payment record
    await Payment.create({
        appointment: appointment._id,
        patient: req.user._id,
        doctor: appointment.doctor._id,
        amount,
        platformFee,
        doctorEarning,
        status: 'pending',
        stripeSessionId: session.id,
    });

    appointment.stripeSessionId = session.id;
    await appointment.save();

    res.json({ success: true, sessionId: session.id, url: session.url });
});

// @desc    Stripe webhook handler
// @route   POST /api/payments/webhook
const stripeWebhook = asyncHandler(async (req, res) => {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        res.status(400);
        throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Update payment
        const payment = await Payment.findOne({ stripeSessionId: session.id });
        if (payment) {
            payment.status = 'completed';
            payment.stripePaymentIntentId = session.payment_intent;
            await payment.save();

            // Update appointment
            const appointment = await Appointment.findById(payment.appointment);
            if (appointment) {
                appointment.paymentStatus = 'paid';
                appointment.paymentId = session.payment_intent;
                if (appointment.status === 'pending') {
                    appointment.status = 'confirmed';
                }
                await appointment.save();
            }

            // Update doctor earnings
            await Doctor.findByIdAndUpdate(payment.doctor, {
                $inc: { totalEarnings: payment.doctorEarning },
            });
        }
    }

    res.json({ received: true });
});

// @desc    Simulate payment success (for development without Stripe)
// @route   POST /api/payments/simulate
const simulatePayment = asyncHandler(async (req, res) => {
    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    // Get platform fee
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    const platformFeePercent = settings.platformFeePercent || 10;

    const amount = appointment.fee;
    const platformFee = Math.round(amount * (platformFeePercent / 100));
    const doctorEarning = amount - platformFee;

    // Create payment
    const payment = await Payment.create({
        appointment: appointment._id,
        patient: appointment.patient,
        doctor: appointment.doctor,
        amount,
        platformFee,
        doctorEarning,
        status: 'completed',
        stripePaymentIntentId: `sim_${Date.now()}`,
    });

    // Update appointment
    appointment.paymentStatus = 'paid';
    appointment.paymentId = payment.stripePaymentIntentId;
    if (appointment.status === 'pending') {
        appointment.status = 'confirmed';
    }
    await appointment.save();

    // Update doctor earnings
    await Doctor.findByIdAndUpdate(appointment.doctor, {
        $inc: { totalEarnings: doctorEarning },
    });

    res.json({ success: true, payment, appointment });
});

// @desc    Get patient's payment history
// @route   GET /api/payments/my
const getMyPayments = asyncHandler(async (req, res) => {
    const payments = await Payment.find({ patient: req.user._id })
        .populate({ path: 'doctor', select: 'fullName specialization' })
        .populate({ path: 'appointment', select: 'date timeSlot' })
        .sort({ createdAt: -1 });

    res.json({ success: true, count: payments.length, payments });
});

module.exports = { createCheckout, stripeWebhook, simulatePayment, getMyPayments };
