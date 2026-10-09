const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Message = require('../src/models/Message');
const { chatRoom } = require('../src/services/booking-chat');

function message(text) {
  return new Message({
    booking: new mongoose.Types.ObjectId(),
    sender: new mongoose.Types.ObjectId(),
    text,
  });
}

test('accepts a valid booking chat message', async () => {
  await assert.doesNotReject(message('Can we review question three?').validate());
});

test('rejects empty and oversized booking chat messages', async () => {
  await assert.rejects(message('   ').validate(), /text/i);
  await assert.rejects(message('x'.repeat(1001)).validate(), /text/i);
});

test('uses a booking-specific real-time room', () => {
  const bookingId = new mongoose.Types.ObjectId().toString();
  assert.equal(chatRoom(bookingId), `booking:${bookingId}`);
});
