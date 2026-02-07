const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        maxlength: 150,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000,
    },
    status: {
        type: String,
        enum: ['new', 'read'],
        default: 'new',
    },
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
