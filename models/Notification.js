const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000,
    },
    type: {
        type: String,
        default: 'info',
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    meta: {
        type: Object,
        default: {},
    },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
