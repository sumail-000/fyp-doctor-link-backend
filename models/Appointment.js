const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
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
    date: {
        type: Date,
        required: [true, 'Appointment date is required'],
    },
    timeSlot: {
        type: String,
        required: [true, 'Time slot is required'],
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending',
    },
    fee: {
        type: Number,
        required: true,
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'refunded'],
        default: 'pending',
    },
    paymentId: {
        type: String,
        default: '',
    },
    stripeSessionId: {
        type: String,
        default: '',
    },
    cancelledBy: {
        type: String,
        enum: ['patient', 'doctor', 'admin', ''],
        default: '',
    },
    cancelReason: {
        type: String,
        default: '',
    },
    notes: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

appointmentSchema.index({ patient: 1, status: 1 });
appointmentSchema.index({ doctor: 1, status: 1 });
appointmentSchema.index({ date: 1, doctor: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
