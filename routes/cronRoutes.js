const express = require('express');
const asyncHandler = require('express-async-handler');
const { autoDetectNoShows, sendAppointmentReminders } = require('../utils/appointmentCron');

const router = express.Router();

// Optional secret check. Set CRON_SECRET in Vercel env vars; Vercel Cron sends
// it as `Authorization: Bearer <secret>`. If unset, the route is open.
const verifyCron = (req, res, next) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return next();
    if (req.headers.authorization === `Bearer ${secret}`) return next();
    res.status(401).json({ success: false, message: 'Unauthorized' });
};

router.get('/no-shows', verifyCron, asyncHandler(async (req, res) => {
    await autoDetectNoShows();
    res.json({ success: true, ran: 'autoDetectNoShows' });
}));

router.get('/reminders', verifyCron, asyncHandler(async (req, res) => {
    await sendAppointmentReminders();
    res.json({ success: true, ran: 'sendAppointmentReminders' });
}));

module.exports = router;
