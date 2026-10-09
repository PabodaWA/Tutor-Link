const mongoose = require('mongoose');

const tutorRequestMessageSchema = new mongoose.Schema({
  tutorRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'TutorRequest', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
}, { timestamps: true });

tutorRequestMessageSchema.index({ tutorRequest: 1, createdAt: 1 });

module.exports = mongoose.model('TutorRequestMessage', tutorRequestMessageSchema);
