const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

// @desc    Get my notifications
// @route   GET /api/notifications/my
const getMyNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50);

    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

    res.json({ success: true, unreadCount, notifications });
});

// @desc    Mark one notification read
// @route   PUT /api/notifications/:id/read
const markNotificationRead = asyncHandler(async (req, res) => {
    const n = await Notification.findOne({ _id: req.params.id, user: req.user._id });
    if (!n) {
        res.status(404);
        throw new Error('Notification not found');
    }

    n.isRead = true;
    await n.save();

    res.json({ success: true, notification: n });
});

// @desc    Mark all notifications read
// @route   PUT /api/notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
    res.json({ success: true });
});

module.exports = { getMyNotifications, markNotificationRead, markAllRead };
