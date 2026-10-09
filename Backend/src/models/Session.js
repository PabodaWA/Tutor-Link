const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  roomCode: { type: String, required: true, unique: true },
  status: { type: String, enum: ['scheduled', 'live', 'completed'], default: 'scheduled' },
  paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'refunded'], default: 'unpaid' },
  paymentReference: { type: String, trim: true },
  notes: { type: String, trim: true, maxlength: 1000 },
  sharedNotes: [{
    text: { type: String, required: true, trim: true, maxlength: 280 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
