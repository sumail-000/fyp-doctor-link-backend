const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Personal Info (from DoctorApply Step 1)
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
    },
    cnic: {
        type: String,
        required: [true, 'CNIC is required'],
    },
    pmcNumber: {
        type: String,
        required: [true, 'PMC registration number is required'],
        unique: true,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
    },
    phone: {
        type: String,
        default: '',
    },
    // Professional Info (from DoctorApply Step 2)
    specialization: {
        type: String,
        required: [true, 'Specialization is required'],
    },
    experience: {
        type: Number,
        required: [true, 'Experience is required'],
    },
    fee: {
        type: Number,
        required: [true, 'Consultation fee is required'],
    },
    location: {
        type: String,
        required: [true, 'Location is required'],
    },
    degree: {
        type: String,
        default: '',
    },
    about: {
        type: String,
        default: '',
    },
    languages: [{
        type: String,
    }],
    // Profile
    avatar: {
        type: String,
        default: '',
    },
    // Documents (from DoctorApply Step 3)
    documents: {
        pmcLicense: { type: String, default: '' },
        degreeCertificate: { type: String, default: '' },
        cnicCopy: { type: String, default: '' },
    },
    // Schedule
    schedule: [{
        day: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        },
        slots: [String],
        isActive: {
            type: Boolean,
            default: true,
        },
    }],
    // Status
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    isAvailable: {
        type: Boolean,
        default: true,
    },
    // Provenance — 'manual' for self-applied, 'scraped' for ingested from external directory
    source: {
        type: String,
        enum: ['manual', 'scraped'],
        default: 'manual',
    },
    sourceUrl: {
        type: String,
        default: '',
    },
    // Geocoded clinic location (optional)
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    geocodedAt: { type: Date },
    // Stats (denormalized for performance)
    rating: {
        type: Number,
        default: 0,
    },
    totalReviews: {
        type: Number,
        default: 0,
    },
    totalPatients: {
        type: Number,
        default: 0,
    },
    totalEarnings: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Index for search/filter
doctorSchema.index({ specialization: 1, fee: 1, rating: -1, status: 1 });
doctorSchema.index({ user: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
