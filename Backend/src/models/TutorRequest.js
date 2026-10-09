const mongoose = require('mongoose');

const tutorRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending', index: true },
  sessionStatus: { type: String, enum: ['not_started', 'live', 'completed'], default: 'not_started', index: true },
  sessionStartedAt: { type: Date },
  sessionCompletedAt: { type: Date },
  roomCode: { type: String, unique: true, sparse: true },
  sharedNotes: [{
    text: { type: String, required: true, trim: true, maxlength: 280 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

tutorRequestSchema.index(
  { student: 1, tutor: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

module.exports = mongoose.model('TutorRequest', tutorRequestSchema);
