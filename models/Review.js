const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        required: true,
    },
    rating: {
        type: Number,
        required: [true, 'Rating is required'],
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        default: '',
        maxlength: 500,
    },
}, {
    timestamps: true,
});

// One review per appointment
reviewSchema.index({ appointment: 1 }, { unique: true });
reviewSchema.index({ doctor: 1 });

// Update doctor rating after save
reviewSchema.statics.calcAverageRating = async function (doctorId) {
    const stats = await this.aggregate([
        { $match: { doctor: doctorId } },
        {
            $group: {
                _id: '$doctor',
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const Doctor = require('./Doctor');
    if (stats.length > 0) {
        await Doctor.findByIdAndUpdate(doctorId, {
            rating: Math.round(stats[0].avgRating * 10) / 10,
            totalReviews: stats[0].totalReviews,
        });
    } else {
        await Doctor.findByIdAndUpdate(doctorId, { rating: 0, totalReviews: 0 });
    }
};

reviewSchema.post('save', function () {
    this.constructor.calcAverageRating(this.doctor);
});

module.exports = mongoose.model('Review', reviewSchema);
