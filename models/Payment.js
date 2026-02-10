const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    platformFee: {
        type: Number,
        default: 0,
    },
    patientPlatformFee: {
        type: Number,
        default: 0,
    },
    doctorEarning: {
        type: Number,
        default: 0,
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'refunded', 'failed'],
        default: 'pending',
    },
    method: {
        type: String,
        default: 'stripe',
    },
    stripePaymentIntentId: {
        type: String,
        default: '',
    },
    stripeSessionId: {
        type: String,
        default: '',
    },
    refundId: {
        type: String,
        default: '',
    },
    refundedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

paymentSchema.index({ patient: 1 });
paymentSchema.index({ doctor: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
