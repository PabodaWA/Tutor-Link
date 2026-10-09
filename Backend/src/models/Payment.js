const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tutor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'lkr', lowercase: true },
  status: { type: String, enum: ['pending', 'succeeded', 'failed', 'refund_pending', 'refunded'], default: 'pending', index: true },
  provider: { type: String, default: 'demo' },
  method: { type: String, enum: ['demo_card', 'demo_wallet'], default: 'demo_card' },
  last4: { type: String, maxlength: 4 },
  providerCheckoutId: { type: String, index: true },
  providerPaymentIntentId: { type: String, index: true },
  paidAt: { type: Date },
  refundedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
