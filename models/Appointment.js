const mongoose = require('mongoose');

const rescheduleEntrySchema = new mongoose.Schema({
    fromDate: { type: Date, required: true },
    fromTimeSlot: { type: String, required: true },
    toDate: { type: Date, required: true },
    toTimeSlot: { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    respondedAt: { type: Date },
}, { _id: true });

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
        enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show', 'rescheduling', 'expired'],
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
    // No-show tracking
    noShowAt: {
        type: Date,
    },
    noShowMarkedBy: {
        type: String,
        enum: ['doctor', 'system', ''],
        default: '',
    },
    // Reschedule tracking
    rescheduleCount: {
        type: Number,
        default: 0,
    },
    maxReschedules: {
        type: Number,
        default: 2,
    },
    rescheduleHistory: [rescheduleEntrySchema],
    // Pending reschedule request (the new slot patient wants)
    pendingReschedule: {
        date: { type: Date },
        timeSlot: { type: String },
        requestedAt: { type: Date },
    },
    // Reminder tracking
    reminderSentAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

appointmentSchema.index({ patient: 1, status: 1 });
appointmentSchema.index({ doctor: 1, status: 1 });
appointmentSchema.index({ date: 1, doctor: 1 });
appointmentSchema.index({ status: 1, date: 1 }); // For auto-detect cron queries

module.exports = mongoose.model('Appointment', appointmentSchema);
