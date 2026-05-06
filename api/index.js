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

// Static uploads. On Vercel the project FS is read-only outside /tmp, so we
// serve from /tmp/uploads when running serverless. Files there are ephemeral
// (lost on cold start) — for real persistence, route uploads to Vercel Blob.
const _IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const _UPLOAD_DIR = _IS_SERVERLESS ? '/tmp/uploads' : path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(_UPLOAD_DIR));

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

// Per-route load tracking so a single broken require doesn't kill the whole
// function. NOTE: Vercel's bundler uses static analysis on require() calls,
// so we must use literal string paths — dynamic require(variable) silently
// drops files from the deployment.
const _routeStatus = {};
const tryMount = (mountPath, loader) => {
    try {
        app.use(mountPath, loader());
        _routeStatus[mountPath] = 'ok';
    } catch (e) {
        _routeStatus[mountPath] = `LOAD_ERROR: ${e.message}`;
        console.error(`[boot] failed to mount ${mountPath}:`, e);
        app.use(mountPath, (req, res) => {
            res.status(500).json({
                success: false,
                message: `Route ${mountPath} failed to load on this deployment`,
                error: e.message,
            });
        });
    }
};

tryMount('/api/auth', () => require('../routes/authRoutes'));
tryMount('/api/doctors', () => require('../routes/doctorRoutes'));
tryMount('/api/appointments', () => require('../routes/appointmentRoutes'));
tryMount('/api/payments', () => require('../routes/paymentRoutes'));
tryMount('/api/reviews', () => require('../routes/reviewRoutes'));
tryMount('/api/admin', () => require('../routes/adminRoutes'));
tryMount('/api/contact', () => require('../routes/contactRoutes'));
tryMount('/api/notifications', () => require('../routes/notificationRoutes'));
tryMount('/api/announcements', () => require('../routes/announcementRoutes'));
tryMount('/api/cron', () => require('../routes/cronRoutes'));
tryMount('/api/ai', () => require('../routes/aiRoutes'));
tryMount('/api/messages', () => require('../routes/messageRoutes'));

// Health check — also shows env debug info
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        clientUrl: process.env.CLIENT_URL || 'NOT SET',
        nodeEnv: process.env.NODE_ENV || 'NOT SET',
        mongoConfigured: !!process.env.MONGO_URI,
        node: process.version,
    });
});

// Boot-time diagnostic — shows which routes loaded vs failed.
app.get('/api/_diag', (req, res) => {
    res.json({
        node: process.version,
        envFlags: {
            MONGO_URI: !!process.env.MONGO_URI,
            JWT_SECRET: !!process.env.JWT_SECRET,
            ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
            STRIPE_SECRET_KEY: !!process.env.STRIPE_SECRET_KEY,
            CLIENT_URL: process.env.CLIENT_URL || null,
            NODE_ENV: process.env.NODE_ENV || null,
        },
        routes: _routeStatus,
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
