const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

// Score components:
//   rating          (0-5)         × 2.0    → strong signal of quality
//   log(reviews+1)  saturating    × 0.6    → social proof, diminishing returns
//   patients (cap)  min(p, 50)    × 0.05   → activity, capped to avoid runaway
//   specMatch       0|1           × 5.0    → dominant when patient asked for X
//   experience cap  min(yrs, 20)  × 0.15   → senior doctors edge
const scoreDoctor = (doc, specialization) => {
    const rating = Number(doc.rating) || 0;
    const reviews = Number(doc.totalReviews) || 0;
    const patients = Math.min(Number(doc.totalPatients) || 0, 50);
    const exp = Math.min(Number(doc.experience) || 0, 20);
    const specMatch = specialization && doc.specialization &&
        doc.specialization.toLowerCase() === specialization.toLowerCase() ? 1 : 0;

    return (rating * 2.0)
        + (Math.log(reviews + 1) * 0.6)
        + (patients * 0.05)
        + (specMatch * 5.0)
        + (exp * 0.15);
};

// Generic recommender: optional specialization filter, returns top N approved doctors
// ranked by score. Excludes any doctor in `excludeIds`.
const recommendDoctors = async ({ specialization, limit = 5, excludeIds = [] } = {}) => {
    const query = { status: 'approved', isAvailable: true };
    if (specialization) query.specialization = specialization;
    if (excludeIds.length) query._id = { $nin: excludeIds };

    const doctors = await Doctor.find(query)
        .select('fullName specialization fee experience location avatar rating totalReviews totalPatients about')
        .lean();

    return doctors
        .map((d) => ({ ...d, score: scoreDoctor(d, specialization) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
};

// Personalized recommender: weights doctors whose specializations the patient
// has consulted before, then falls back to generic if no history.
const recommendForPatient = async (patientId, { limit = 5 } = {}) => {
    const past = await Appointment.find({ patient: patientId })
        .select('doctor status')
        .populate({ path: 'doctor', select: 'specialization' })
        .lean();

    const specCount = {};
    for (const a of past) {
        const s = a.doctor?.specialization;
        if (s) specCount[s] = (specCount[s] || 0) + 1;
    }

    const doctors = await Doctor.find({ status: 'approved', isAvailable: true })
        .select('fullName specialization fee experience location avatar rating totalReviews totalPatients about')
        .lean();

    if (!Object.keys(specCount).length) {
        return doctors
            .map((d) => ({ ...d, score: scoreDoctor(d) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    return doctors
        .map((d) => {
            const base = scoreDoctor(d);
            const affinity = (specCount[d.specialization] || 0) * 1.5;
            return { ...d, score: base + affinity };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
};

module.exports = { recommendDoctors, recommendForPatient, scoreDoctor };
