const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, trim: true, minlength: 1, maxlength: 1000 },
}, { timestamps: true });

messageSchema.index({ booking: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
