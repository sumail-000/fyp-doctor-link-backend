const Appointment = require('../models/Appointment');
const Notification = require('../models/Notification');
const Doctor = require('../models/Doctor');

// Auto-detect no-shows: confirmed appointments where date+time has passed by 24 hours
const autoDetectNoShows = async () => {
    try {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);

        const staleAppointments = await Appointment.find({
            status: 'confirmed',
            date: { $lt: cutoff },
        });

        for (const apt of staleAppointments) {
            apt.status = 'no-show';
            apt.noShowAt = new Date();
            apt.noShowMarkedBy = 'system';
            await apt.save();

            // Notify patient
            await Notification.create({
                user: apt.patient,
                title: 'Missed Appointment',
                message: `Your appointment on ${apt.date.toDateString()} at ${apt.timeSlot} was marked as missed. You may reschedule up to ${apt.maxReschedules - apt.rescheduleCount} time(s).`,
                type: 'appointment',
                meta: { appointmentId: apt._id.toString() },
            });

            // Notify doctor
            const doctor = await Doctor.findById(apt.doctor).select('user');
            if (doctor?.user) {
                await Notification.create({
                    user: doctor.user,
                    title: 'Patient No-Show',
                    message: `A patient did not show up for their appointment on ${apt.date.toDateString()} at ${apt.timeSlot}. It has been automatically marked as no-show.`,
                    type: 'appointment',
                    meta: { appointmentId: apt._id.toString() },
                });
            }
        }

        if (staleAppointments.length > 0) {
            console.log(`[Cron] Auto-marked ${staleAppointments.length} appointment(s) as no-show`);
        }
    } catch (err) {
        console.error('[Cron] autoDetectNoShows error:', err.message);
    }
};

// Send reminder notifications for appointments happening in the next 3 hours
const sendAppointmentReminders = async () => {
    try {
        const now = new Date();
        const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

        // Find confirmed appointments happening today that haven't been reminded yet
        const upcoming = await Appointment.find({
            status: 'confirmed',
            date: {
                $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
            },
            reminderSentAt: { $exists: false },
        }).populate({ path: 'doctor', select: 'fullName user' });

        for (const apt of upcoming) {
            // Parse the timeSlot to check if it's within 3 hours
            const slotMatch = apt.timeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (!slotMatch) continue;

            let hours = parseInt(slotMatch[1]);
            const minutes = parseInt(slotMatch[2]);
            const period = slotMatch[3].toUpperCase();

            if (period === 'PM' && hours !== 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;

            const aptDateTime = new Date(apt.date);
            aptDateTime.setHours(hours, minutes, 0, 0);

            // Only send reminder if appointment is between now and 3 hours from now
            if (aptDateTime > now && aptDateTime <= threeHoursLater) {
                // Notify patient
                await Notification.create({
                    user: apt.patient,
                    title: 'Upcoming Appointment Reminder',
                    message: `Reminder: You have an appointment with Dr. ${apt.doctor?.fullName || 'your doctor'} today at ${apt.timeSlot}. Please be on time.`,
                    type: 'reminder',
                    meta: { appointmentId: apt._id.toString() },
                });

                // Notify doctor
                if (apt.doctor?.user) {
                    await Notification.create({
                        user: apt.doctor.user,
                        title: 'Upcoming Appointment',
                        message: `Reminder: You have a patient appointment today at ${apt.timeSlot}.`,
                        type: 'reminder',
                        meta: { appointmentId: apt._id.toString() },
                    });
                }

                apt.reminderSentAt = now;
                await apt.save();
            }
        }
    } catch (err) {
        console.error('[Cron] sendAppointmentReminders error:', err.message);
    }
};

// Start the cron intervals
const startAppointmentCron = () => {
    // Run auto-detect every hour
    setInterval(autoDetectNoShows, 60 * 60 * 1000);
    // Run reminders every 30 minutes
    setInterval(sendAppointmentReminders, 30 * 60 * 1000);

    // Also run once on startup (after a short delay to let DB connect)
    setTimeout(() => {
        autoDetectNoShows();
        sendAppointmentReminders();
    }, 10000);

    console.log('[Cron] Appointment cron jobs started (no-show detection: 1hr, reminders: 30min)');
};

module.exports = { startAppointmentCron, autoDetectNoShows, sendAppointmentReminders };
