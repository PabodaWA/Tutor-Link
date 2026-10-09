const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500, default: '' },
}, { timestamps: true });

reviewSchema.index({ tutor: 1, student: 1 }, { unique: true });
module.exports = mongoose.model('Review', reviewSchema);
