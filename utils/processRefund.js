const Payment = require('../models/Payment');
const Doctor = require('../models/Doctor');

// Process a real refund: calls Stripe (when applicable), updates the Payment
// record, and decrements the doctor's totalEarnings. Throws on Stripe failure
// so the caller can abort the cancellation cleanly.
const processRefund = async (appointmentId) => {
    const payment = await Payment.findOne({ appointment: appointmentId });
    if (!payment || payment.status !== 'completed') {
        return payment;
    }

    const isRealStripePayment =
        payment.stripePaymentIntentId &&
        payment.stripePaymentIntentId.startsWith('pi_');

    if (isRealStripePayment) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const refund = await stripe.refunds.create({
            payment_intent: payment.stripePaymentIntentId,
        });
        payment.refundId = refund.id;
    }

    payment.status = 'refunded';
    payment.refundedAt = new Date();
    await payment.save();

    if (payment.doctorEarning > 0) {
        await Doctor.findByIdAndUpdate(payment.doctor, {
            $inc: { totalEarnings: -payment.doctorEarning },
        });
    }

    return payment;
};

module.exports = processRefund;
