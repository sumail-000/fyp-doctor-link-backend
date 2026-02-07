const express = require('express');
const router = express.Router();
const { createCheckout, stripeWebhook, simulatePayment, getMyPayments } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

// Stripe webhook
router.post('/webhook', stripeWebhook);

// Protected routes
router.post('/create-checkout', protect, authorize('patient'), createCheckout);
router.post('/simulate', protect, authorize('patient'), simulatePayment);
router.get('/my', protect, authorize('patient'), getMyPayments);

module.exports = router;
