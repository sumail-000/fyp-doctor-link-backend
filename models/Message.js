const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Denormalized for fast conversation indexing — always patient's User._id
    // and doctor's User._id, regardless of who sent the message.
    patientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    body: { type: String, required: true, maxlength: 2000, trim: true },
    isRead: { type: Boolean, default: false },
}, { timestamps: true });

messageSchema.index({ patientUser: 1, doctorUser: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model('Message', messageSchema);
