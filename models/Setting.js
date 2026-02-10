const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    siteName: { type: String, default: 'DoctorLink' },
    siteEmail: { type: String, default: 'admin@doctorlink.pk' },
    supportEmail: { type: String, default: 'support@doctorlink.pk' },
    maintenanceMode: { type: Boolean, default: false },
    newRegistrations: { type: Boolean, default: true },
    doctorApplications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    appointmentAlerts: { type: Boolean, default: true },
    paymentAlerts: { type: Boolean, default: true },
    newDoctorAlerts: { type: Boolean, default: true },
    autoApprove: { type: Boolean, default: false },
    maxAppointmentsPerDay: { type: Number, default: 20 },
    cancellationWindow: { type: Number, default: 24 },
    patientPlatformFeePercent: { type: Number, default: 0 },
    doctorPlatformFeePercent: { type: Number, default: 10 },
    minDoctorFee: { type: Number, default: 500 },
    maxDoctorFee: { type: Number, default: 10000 },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Setting', settingSchema);
