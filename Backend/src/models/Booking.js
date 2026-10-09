const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  availabilitySlot: { type: mongoose.Schema.Types.ObjectId, ref: 'Availability', required: true },
  subject: { type: String, required: true, trim: true, maxlength: 80 },
  notes: { type: String, trim: true, maxlength: 300, default: '' },
  sessionType: { type: String, enum: ['online', 'in_person'], default: 'online' },
  startsAt: { type: Date, required: true },
  durationMinutes: { type: Number, enum: [30, 60, 90, 120], default: 60 },
  status: { type: String, enum: ['pending', 'confirmed', 'paid', 'scheduled', 'live', 'completed', 'cancelled', 'reschedule_requested', 'refund_pending', 'refunded'], default: 'pending' },
  price: { type: Number, required: true, min: 0 },
  creditCost: { type: Number, min: 1 },
  creditsCharged: { type: Boolean, default: false },
  creditsChargedAt: { type: Date },
  cancellationFeeCredits: { type: Number, min: 0 },
  creditRefundedAt: { type: Date },
  reminderEnabled: { type: Boolean, default: true },
  cancellationReason: { type: String, trim: true, maxlength: 240 },
  cancelledBy: { type: String, enum: ['student', 'tutor', 'admin'] },
  previousStartsAt: { type: Date },
  previousAvailabilitySlot: { type: mongoose.Schema.Types.ObjectId, ref: 'Availability' },
  previousDurationMinutes: { type: Number, enum: [30, 60, 90, 120] },
  previousPrice: { type: Number, min: 0 },
  previousStatus: { type: String, enum: ['pending', 'confirmed', 'scheduled'] },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
