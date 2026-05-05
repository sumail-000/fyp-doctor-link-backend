const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Doctor = require('../models/Doctor');
const Notification = require('../models/Notification');

// Resolve the conversation pair given:
// - acting user (req.user, role: patient or doctor)
// - "other" id (doctor profile _id when acting user is a patient,
//   patient User._id when acting user is a doctor)
const resolvePair = async (actingUser, otherId) => {
    if (!mongoose.isValidObjectId(otherId)) {
        const err = new Error('Invalid other-party id');
        err.statusCode = 400;
        throw err;
    }

    if (actingUser.role === 'patient') {
        const doctor = await Doctor.findById(otherId).select('user fullName');
        if (!doctor || !doctor.user) {
            const err = new Error('Doctor not found');
            err.statusCode = 404;
            throw err;
        }
        return {
            patientUser: actingUser._id,
            doctorUser: doctor.user,
            doctorProfile: doctor._id,
        };
    }
    if (actingUser.role === 'doctor') {
        const myDoctor = await Doctor.findOne({ user: actingUser._id }).select('_id');
        if (!myDoctor) {
            const err = new Error('Doctor profile not found');
            err.statusCode = 404;
            throw err;
        }
        return {
            patientUser: otherId,
            doctorUser: actingUser._id,
            doctorProfile: myDoctor._id,
        };
    }
    const err = new Error('Only patients or doctors can message');
    err.statusCode = 403;
    throw err;
};

// @desc    List conversations for the acting user
// @route   GET /api/messages/conversations
const listConversations = asyncHandler(async (req, res) => {
    const meId = req.user._id;
    const role = req.user.role;
    if (!['patient', 'doctor'].includes(role)) {
        return res.json({ success: true, conversations: [] });
    }

    const matchField = role === 'patient' ? 'patientUser' : 'doctorUser';
    const otherField = role === 'patient' ? 'doctorUser' : 'patientUser';

    const convos = await Message.aggregate([
        { $match: { [matchField]: meId } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: `$${otherField}`,
                lastMessage: { $first: '$body' },
                lastSender: { $first: '$sender' },
                lastAt: { $first: '$createdAt' },
                doctorProfile: { $first: '$doctorProfile' },
                unread: {
                    $sum: {
                        $cond: [
                            { $and: [
                                { $eq: ['$recipient', meId] },
                                { $eq: ['$isRead', false] },
                            ] },
                            1,
                            0,
                        ],
                    },
                },
            },
        },
        { $sort: { lastAt: -1 } },
        { $limit: 100 },
    ]);

    // Hydrate counterpart name
    if (convos.length === 0) {
        return res.json({ success: true, conversations: [] });
    }

    const userIds = convos.map((c) => c._id);
    const User = require('../models/User');
    const users = await User.find({ _id: { $in: userIds } }).select('name email avatar');
    const usersMap = Object.fromEntries(users.map((u) => [String(u._id), u]));

    let doctorsMap = {};
    if (role === 'patient') {
        const docIds = convos.map((c) => c.doctorProfile).filter(Boolean);
        if (docIds.length) {
            const docs = await Doctor.find({ _id: { $in: docIds } }).select('fullName specialization avatar');
            doctorsMap = Object.fromEntries(docs.map((d) => [String(d._id), d]));
        }
    }

    const out = convos.map((c) => {
        const u = usersMap[String(c._id)] || {};
        const docProf = role === 'patient' && c.doctorProfile ? doctorsMap[String(c.doctorProfile)] : null;
        return {
            otherUserId: c._id,
            doctorProfileId: c.doctorProfile || null,
            displayName: docProf?.fullName || u.name || 'User',
            displaySubtitle: docProf?.specialization || u.email || '',
            avatar: docProf?.avatar || u.avatar || '',
            lastMessage: c.lastMessage,
            lastAt: c.lastAt,
            unread: c.unread,
        };
    });

    res.json({ success: true, conversations: out });
});

// @desc    Get the full message thread with another party
// @route   GET /api/messages/thread?with=ID
const getThread = asyncHandler(async (req, res) => {
    const { with: otherId } = req.query;
    if (!otherId) { res.status(400); throw new Error('with is required'); }

    let pair;
    try { pair = await resolvePair(req.user, otherId); }
    catch (err) { res.status(err.statusCode || 500); throw err; }

    const messages = await Message.find({
        patientUser: pair.patientUser,
        doctorUser: pair.doctorUser,
    })
        .sort({ createdAt: 1 })
        .lean();

    res.json({ success: true, count: messages.length, messages });
});

// @desc    Send a message to another party
// @route   POST /api/messages
const sendMessage = asyncHandler(async (req, res) => {
    const { with: otherId, body } = req.body;
    if (!otherId || !body || !body.trim()) {
        res.status(400);
        throw new Error('with and body are required');
    }
    if (body.length > 2000) {
        res.status(400);
        throw new Error('Message is too long (max 2000 chars)');
    }

    let pair;
    try { pair = await resolvePair(req.user, otherId); }
    catch (err) { res.status(err.statusCode || 500); throw err; }

    const recipient = req.user.role === 'patient' ? pair.doctorUser : pair.patientUser;

    const msg = await Message.create({
        sender: req.user._id,
        recipient,
        patientUser: pair.patientUser,
        doctorUser: pair.doctorUser,
        doctorProfile: pair.doctorProfile,
        body: body.trim(),
    });

    // Notify recipient
    await Notification.create({
        user: recipient,
        title: 'New message',
        message: `${req.user.name || 'Someone'}: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`,
        type: 'info',
        meta: { messageId: msg._id.toString() },
    });

    res.status(201).json({ success: true, message: msg });
});

// @desc    Mark all messages from another party as read
// @route   PUT /api/messages/read?with=ID
const markThreadRead = asyncHandler(async (req, res) => {
    const { with: otherId } = req.query;
    if (!otherId) { res.status(400); throw new Error('with is required'); }

    let pair;
    try { pair = await resolvePair(req.user, otherId); }
    catch (err) { res.status(err.statusCode || 500); throw err; }

    const result = await Message.updateMany(
        {
            patientUser: pair.patientUser,
            doctorUser: pair.doctorUser,
            recipient: req.user._id,
            isRead: false,
        },
        { $set: { isRead: true } },
    );

    res.json({ success: true, modified: result.modifiedCount });
});

// @desc    Total unread count for current user (used for nav badge)
// @route   GET /api/messages/unread-count
const unreadCount = asyncHandler(async (req, res) => {
    const count = await Message.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, count });
});

module.exports = { listConversations, getThread, sendMessage, markThreadRead, unreadCount };
