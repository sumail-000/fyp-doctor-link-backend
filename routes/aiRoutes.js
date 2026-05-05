const express = require('express');
const router = express.Router();
const { analyzeSymptoms } = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');
const { symptomImageUpload } = require('../middleware/upload');

router.post('/analyze-symptoms',
    protect,
    authorize('patient'),
    symptomImageUpload,
    analyzeSymptoms,
);

module.exports = router;
