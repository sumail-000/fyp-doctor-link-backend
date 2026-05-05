const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');

// Load env vars (for local dev — Vercel injects env vars directly)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// CORS — evaluate allowed origins dynamically per-request
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
            .split(',')
            .map(s => s.trim().replace(/\/+$/, '')); // strip trailing slashes
        const cleanOrigin = origin ? origin.replace(/\/+$/, '') : '';
        // In dev, allow any localhost / 127.0.0.1 port (Vite picks 5173/5174/5175 depending on availability)
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin);
        if (!origin || allowedOrigins.includes(cleanOrigin) || (process.env.NODE_ENV !== 'production' && isLocalhost)) {
            callback(null, true);
        } else {
            console.log(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`);
            callback(null, false);
        }
    },
    credentials: true,
}));

app.use(express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express.urlencoded({ extended: true }));

// Static uploads (works on local dev; on Vercel serverless the disk is
// ephemeral so uploads only persist for the lifetime of one function instance)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Connect to DB on every request (uses cached connection)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB connection failed:', err.message);
        res.status(500).json({ success: false, message: 'Database connection failed' });
    }
});

// Routes
app.use('/api/auth', require('../routes/authRoutes'));
app.use('/api/doctors', require('../routes/doctorRoutes'));
app.use('/api/appointments', require('../routes/appointmentRoutes'));
app.use('/api/payments', require('../routes/paymentRoutes'));
app.use('/api/reviews', require('../routes/reviewRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));
app.use('/api/contact', require('../routes/contactRoutes'));
app.use('/api/notifications', require('../routes/notificationRoutes'));
app.use('/api/announcements', require('../routes/announcementRoutes'));
app.use('/api/cron', require('../routes/cronRoutes'));
app.use('/api/ai', require('../routes/aiRoutes'));
app.use('/api/messages', require('../routes/messageRoutes'));

// Health check — also shows env debug info
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        clientUrl: process.env.CLIENT_URL || 'NOT SET',
        nodeEnv: process.env.NODE_ENV || 'NOT SET',
        mongoConfigured: !!process.env.MONGO_URI,
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : (err.statusCode || 500);
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Server Error',
    });
});

module.exports = app;
