const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');

// @desc    Register user (patient)
// @route   POST /api/auth/register
const register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists with this email');
    }

    const user = await User.create({ name, email, password, role: 'patient' });

    res.status(201).json({
        success: true,
        token: user.getSignedJwtToken(),
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
        },
    });
});

// @desc    Login user
// @route   POST /api/auth/login
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    if (user.isBlocked) {
        res.status(403);
        throw new Error('Your account has been blocked. Contact admin.');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid credentials');
    }

    res.json({
        success: true,
        token: user.getSignedJwtToken(),
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            city: user.city,
        },
    });
});

// @desc    Get current user profile
// @route   GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    res.json({ success: true, user });
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
    const { name, email, phone, city, avatar, dob, gender, address } = req.body;

    const user = await User.findById(req.user._id);

    if (email && email !== user.email) {
        const exists = await User.findOne({ email, _id: { $ne: user._id } });
        if (exists) {
            res.status(400);
            throw new Error('Email already in use by another account');
        }
        user.email = email;
    }

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (city !== undefined) user.city = city;
    if (avatar !== undefined) user.avatar = avatar;
    if (dob !== undefined) user.dob = dob;
    if (gender !== undefined) user.gender = gender;
    if (address !== undefined) user.address = address;

    await user.save();

    res.json({ success: true, user });
});

// @desc    Change password
// @route   PUT /api/auth/password
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
        res.status(400);
        throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
});

// @desc    Request password reset link
// @route   POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('Email is required');
    }

    const user = await User.findOne({ email });

    // Always respond the same on success/failure to avoid leaking which emails exist.
    // The reset URL is only returned when a user actually matched.
    const generic = { success: true, message: 'If an account exists for that email, a reset link has been generated.' };

    if (!user) {
        return res.json(generic);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashed;
    user.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

    // Email integration is not configured for this FYP demo, so the URL is
    // returned in the response. Swap this for a Mailgun/SMTP call when ready.
    res.json({ ...generic, resetUrl });
});

// @desc    Reset password using token
// @route   POST /api/auth/reset-password/:token
const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters');
    }

    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
        resetPasswordToken: hashed,
        resetPasswordExpire: { $gt: new Date() },
    }).select('+password +resetPasswordToken +resetPasswordExpire');

    if (!user) {
        res.status(400);
        throw new Error('Reset link is invalid or has expired');
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset. You can now log in.' });
});

module.exports = { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword };
