const mongoose = require('mongoose');

const creditTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  type: {
    type: String,
    enum: ['buy', 'redeem', 'meeting_unlock', 'cancellation_fee', 'cancellation_refund'],
    required: true,
    index: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  description: { type: String, required: true, trim: true, maxlength: 180 },
  reference: { type: String, trim: true, uppercase: true },
}, { timestamps: true });

creditTransactionSchema.index(
  { user: 1, reference: 1 },
  { unique: true, partialFilterExpression: { reference: { $type: 'string' } } },
);

module.exports = mongoose.model('CreditTransaction', creditTransactionSchema);
