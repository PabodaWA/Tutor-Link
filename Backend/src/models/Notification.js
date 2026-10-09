const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['booking', 'payment', 'session', 'verification', 'account', 'reminder', 'system'], default: 'system', index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  message: { type: String, required: true, trim: true, maxlength: 280 },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  actionRoute: { type: String, trim: true, maxlength: 160 },
  uniqueKey: { type: String, unique: true, sparse: true, index: true },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
