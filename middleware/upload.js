const multer = require('multer');
const path = require('path');
const fs = require('fs');

// On Vercel/Lambda the project filesystem is read-only — only /tmp is writable.
// Uploads on Vercel are ephemeral (gone when the function instance recycles)
// but at least the routes load and the demo runs. For real persistence on
// Vercel, swap to Vercel Blob / Cloudinary / S3.
const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const UPLOAD_ROOT = IS_SERVERLESS
    ? '/tmp/uploads'
    : path.join(__dirname, '..', 'uploads');
const DOCTOR_DIR = path.join(UPLOAD_ROOT, 'doctors');
const PRESCRIPTION_DIR = path.join(UPLOAD_ROOT, 'prescriptions');

// Ensure folders exist (multer will not create them). Wrapped in try/catch
// so a read-only filesystem at boot doesn't crash the whole module.
const ensureDir = (dir) => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
        console.warn(`[upload] could not create ${dir}: ${e.message}`);
    }
};
[UPLOAD_ROOT, DOCTOR_DIR, PRESCRIPTION_DIR].forEach(ensureDir);

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
