const asyncHandler = require('express-async-handler');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const Doctor = require('../models/Doctor');
const Setting = require('../models/Setting');
const Notification = require('../models/Notification');

// @desc    Create payment intent (Stripe checkout)
// @route   POST /api/payments/create-checkout
const createCheckout = asyncHandler(async (req, res) => {
    const { appointmentId } = req.body;
    const User = require('../models/User');

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

    // SECURITY: Always use doctor's current fee from DB, not the stored appointment fee
    const currentDoctorFee = appointment.doctor.fee;
    if (!currentDoctorFee || currentDoctorFee <= 0) {
        res.status(400);
        throw new Error('Invalid doctor fee configuration');
    }

    // Sync appointment fee with doctor's current fee (in case it changed)
    if (appointment.fee !== currentDoctorFee) {
        appointment.fee = currentDoctorFee;
        await appointment.save();
    }

    // Get platform fee settings
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    const patientFeePercent = settings.patientPlatformFeePercent ?? 0;
    const doctorFeePercent = settings.doctorPlatformFeePercent ?? 10;

    const consultationFee = currentDoctorFee;
    const patientPlatformFee = Math.round(consultationFee * (patientFeePercent / 100));
    const totalPatientPays = consultationFee + patientPlatformFee;
    const doctorPlatformFee = Math.round(consultationFee * (doctorFeePercent / 100));
    const doctorEarning = consultationFee - doctorPlatformFee;

    // Get patient email for Stripe checkout
    const patient = await User.findById(req.user._id).select('email');

    // Create Stripe checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Build line items — always show consultation fee, add patient platform fee line only if > 0
    const lineItems = [{
        price_data: {
            currency: 'pkr',
            product_data: {
                name: `Consultation with ${appointment.doctor.fullName}`,
                description: `${appointment.date.toDateString()} at ${appointment.timeSlot}`,
            },
            unit_amount: consultationFee * 100,
        },
        quantity: 1,
    }];

    if (patientPlatformFee > 0) {
        lineItems.push({
            price_data: {
                currency: 'pkr',
                product_data: {
                    name: 'Platform Service Fee',
                    description: `${patientFeePercent}% platform fee`,
                },
                unit_amount: patientPlatformFee * 100,
            },
            quantity: 1,
        });
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: patient?.email || undefined,
        line_items: lineItems,
        mode: 'payment',
        success_url: `${process.env.CLIENT_URL}/patient/appointments?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/patient/appointments?payment=cancelled`,
        metadata: {
            appointmentId: appointment._id.toString(),
            patientId: req.user._id.toString(),
            doctorId: appointment.doctor._id.toString(),
            totalAmount: totalPatientPays.toString(),
        },
    });

    // Remove any old pending payment for this appointment (retry scenario)
    await Payment.deleteMany({
        appointment: appointment._id,
        status: 'pending',
    });

    // Create payment record
    await Payment.create({
        appointment: appointment._id,
        patient: req.user._id,
        doctor: appointment.doctor._id,
        amount: totalPatientPays,
        platformFee: doctorPlatformFee,
        patientPlatformFee,
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
        const payload = req.rawBody || req.body;
        event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        res.status(400);
        throw new Error(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Update payment
        const payment = await Payment.findOne({ stripeSessionId: session.id });
        if (payment) {
            // SECURITY: Validate amount matches
            const expectedAmountInCents = payment.amount * 100;
            if (session.amount_total && session.amount_total !== expectedAmountInCents) {
                console.error(`[SECURITY] Payment amount mismatch for session ${session.id}: expected ${expectedAmountInCents}, got ${session.amount_total}`);
                return res.status(400).json({ error: 'Amount mismatch' });
            }

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

                await Notification.create({
                    user: appointment.patient,
                    title: 'Payment successful',
                    message: 'Your payment was successful and your appointment is confirmed.',
                    type: 'payment',
                    meta: { appointmentId: appointment._id.toString(), paymentId: payment._id.toString() },
                });

                const doctorDoc = await Doctor.findById(payment.doctor).select('user');
                if (doctorDoc?.user) {
                    await Notification.create({
                        user: doctorDoc.user,
                        title: 'New paid appointment',
                        message: 'A patient completed payment for an appointment.',
                        type: 'payment',
                        meta: { appointmentId: appointment._id.toString(), paymentId: payment._id.toString() },
                    });
                }
            }

            // Update doctor earnings
            await Doctor.findByIdAndUpdate(payment.doctor, {
                $inc: { totalEarnings: payment.doctorEarning },
            });
        }
    }

    res.json({ received: true });
});

// @desc    Verify Stripe checkout session and update payment/appointment status
// @route   POST /api/payments/verify-session
const verifySession = asyncHandler(async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        res.status(400);
        throw new Error('Session ID is required');
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
        res.status(404);
        throw new Error('Session not found');
    }

    // Find the payment record
    const payment = await Payment.findOne({ stripeSessionId: sessionId });
    if (!payment) {
        res.status(404);
        throw new Error('Payment record not found');
    }

    // Already processed
    if (payment.status === 'completed') {
        const appointment = await Appointment.findById(payment.appointment);
        return res.json({ success: true, already: true, payment, appointment });
    }

    // SECURITY: Validate the amount paid matches what we expect
    const expectedAmountInCents = payment.amount * 100;
    if (session.amount_total && session.amount_total !== expectedAmountInCents) {
        res.status(400);
        throw new Error('Payment amount mismatch — possible tampering detected');
    }

    // Check if payment was successful
    if (session.payment_status === 'paid') {
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

            // Notifications
            await Notification.create({
                user: appointment.patient,
                title: 'Payment successful',
                message: 'Your payment was successful and your appointment is confirmed.',
                type: 'payment',
                meta: { appointmentId: appointment._id.toString(), paymentId: payment._id.toString() },
            });

            const doctorDoc = await Doctor.findById(payment.doctor).select('user');
            if (doctorDoc?.user) {
                await Notification.create({
                    user: doctorDoc.user,
                    title: 'New paid appointment',
                    message: 'A patient completed payment for an appointment.',
                    type: 'payment',
                    meta: { appointmentId: appointment._id.toString(), paymentId: payment._id.toString() },
                });
            }

            // Update doctor earnings
            await Doctor.findByIdAndUpdate(payment.doctor, {
                $inc: { totalEarnings: payment.doctorEarning },
            });

            return res.json({ success: true, payment, appointment });
        }
    }

    res.json({ success: false, message: 'Payment not completed yet', status: session.payment_status });
});

// @desc    Simulate payment success (for development without Stripe)
// @route   POST /api/payments/simulate
const simulatePayment = asyncHandler(async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        res.status(404);
        throw new Error('Not found');
    }

    const { appointmentId } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
        res.status(404);
        throw new Error('Appointment not found');
    }

    // Get platform fee settings
    let settings = await Setting.findOne();
    if (!settings) settings = await Setting.create({});
    const patientFeePercent = settings.patientPlatformFeePercent ?? 0;
    const doctorFeePercent = settings.doctorPlatformFeePercent ?? 10;

    const consultationFee = appointment.fee;
    const patientPlatformFee = Math.round(consultationFee * (patientFeePercent / 100));
    const totalPatientPays = consultationFee + patientPlatformFee;
    const doctorPlatformFee = Math.round(consultationFee * (doctorFeePercent / 100));
    const doctorEarning = consultationFee - doctorPlatformFee;

    // Create payment
    const payment = await Payment.create({
        appointment: appointment._id,
        patient: appointment.patient,
        doctor: appointment.doctor,
        amount: totalPatientPays,
        platformFee: doctorPlatformFee,
        patientPlatformFee,
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

module.exports = { createCheckout, stripeWebhook, verifySession, simulatePayment, getMyPayments };
