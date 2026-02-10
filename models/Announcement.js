const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: 200,
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: 5000,
    },
    type: {
        type: String,
        enum: ['info', 'warning', 'critical', 'success'],
        default: 'info',
    },
    audience: {
        type: String,
        enum: ['all', 'patients', 'doctors'],
        default: 'all',
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    isDismissible: {
        type: Boolean,
        default: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    dismissedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Announcement', announcementSchema);
