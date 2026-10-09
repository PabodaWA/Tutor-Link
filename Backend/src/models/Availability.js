const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  isBooked: { type: Boolean, default: false, index: true },
}, { timestamps: true });

availabilitySchema.index({ tutor: 1, startsAt: 1 }, { unique: true });
availabilitySchema.path('endsAt').validate(function validateEnd(value) { return value > this.startsAt; }, 'End time must be after start time.');

module.exports = mongoose.model('Availability', availabilitySchema);
