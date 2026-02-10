const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('../config/db');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// CORS — must be FIRST so preflight OPTIONS requests pass
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
