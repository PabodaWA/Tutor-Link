const mongoose = require('mongoose');

const tutorShortlistSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
}, { timestamps: true });

tutorShortlistSchema.index({ student: 1, tutor: 1 }, { unique: true });

module.exports = mongoose.model('TutorShortlist', tutorShortlistSchema);
