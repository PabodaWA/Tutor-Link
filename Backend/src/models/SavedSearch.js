const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 60 },
  query: { type: String, trim: true, maxlength: 80, default: '' },
  subject: { type: String, trim: true, maxlength: 80, default: 'All' },
  sort: { type: String, enum: ['rating', 'rate_low', 'rate_high', 'newest'], default: 'rating' },
  filters: {
    minRate: { type: Number, min: 0, max: 100000, default: 0 },
    maxRate: { type: Number, min: 0, max: 100000, default: 0 },
    minRating: { type: Number, enum: [0, 3, 4, 4.5], default: 0 },
    availability: { type: String, enum: ['any', 'today', 'week'], default: 'any' },
    experience: { type: String, enum: ['any', 'New tutor', '1-2 years', '3+ years'], default: 'any' },
  },
}, { timestamps: true });

savedSearchSchema.index({ student: 1, updatedAt: -1 });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
