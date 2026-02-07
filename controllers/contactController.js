const asyncHandler = require('express-async-handler');
const ContactMessage = require('../models/ContactMessage');

// @desc    Submit contact message (public)
// @route   POST /api/contact
const submitContactMessage = asyncHandler(async (req, res) => {
    const { name, email, subject, message } = req.body;

    const msg = await ContactMessage.create({ name, email, subject, message });

    res.status(201).json({ success: true, message: 'Message received', contactMessage: msg });
});

// @desc    Get contact messages (admin)
// @route   GET /api/contact
const getContactMessages = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;

    const messages = await ContactMessage.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: messages.length, messages });
});

// @desc    Mark contact message as read (admin)
// @route   PUT /api/contact/:id/read
const markContactMessageRead = asyncHandler(async (req, res) => {
    const msg = await ContactMessage.findById(req.params.id);
    if (!msg) {
        res.status(404);
        throw new Error('Message not found');
    }

    msg.status = 'read';
    await msg.save();

    res.json({ success: true, contactMessage: msg });
});

module.exports = { submitContactMessage, getContactMessages, markContactMessageRead };
