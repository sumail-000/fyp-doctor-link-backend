const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const DOCTOR_DIR = path.join(UPLOAD_ROOT, 'doctors');

// Ensure folders exist (multer will not create them)
[UPLOAD_ROOT, DOCTOR_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, DOCTOR_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeBase = file.fieldname.replace(/[^a-z0-9]/gi, '');
        cb(null, `${safeBase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) {
        return cb(new Error('Only JPG/PNG/WEBP/PDF allowed'));
    }
    cb(null, true);
};

const uploadDoctorDocs = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).fields([
    { name: 'pmcLicense', maxCount: 1 },
    { name: 'degreeCertificate', maxCount: 1 },
    { name: 'cnicCopy', maxCount: 1 },
]);

// In-memory storage for symptom-analyzer images so we can base64 them and
// hand them to Claude without ever writing to disk.
const symptomImageUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            return cb(new Error('Only JPG/PNG/WEBP images allowed for symptom photos'));
        }
        cb(null, true);
    },
    limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB per image
}).single('image');

// Disk storage for prescriptions (PDF or image)
const PRESCRIPTION_DIR = path.join(__dirname, '..', 'uploads', 'prescriptions');
if (!fs.existsSync(PRESCRIPTION_DIR)) fs.mkdirSync(PRESCRIPTION_DIR, { recursive: true });

const prescriptionStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, PRESCRIPTION_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `rx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});
const uploadPrescription = multer({
    storage: prescriptionStorage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp', '.pdf'].includes(ext)) {
            return cb(new Error('Only JPG/PNG/WEBP/PDF allowed'));
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
}).single('prescription');

module.exports = { uploadDoctorDocs, symptomImageUpload, uploadPrescription };
