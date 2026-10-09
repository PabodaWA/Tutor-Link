const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Booking = require('../src/models/Booking');

function booking(overrides = {}) {
  return new Booking({
    student: new mongoose.Types.ObjectId(),
    tutor: new mongoose.Types.ObjectId(),
    availabilitySlot: new mongoose.Types.ObjectId(),
    subject: 'Mathematics',
    startsAt: new Date(Date.now() + 60_000),
    durationMinutes: 60,
    price: 1500,
    ...overrides,
  });
}

test('new bookings default to an online session', async () => {
  const value = booking();
  assert.equal(value.sessionType, 'online');
  await value.validate();
});

test('bookings accept in-person sessions', async () => {
  const value = booking({ sessionType: 'in_person' });
  assert.equal(value.sessionType, 'in_person');
  await value.validate();
});

test('bookings reject unsupported session types', async () => {
  await assert.rejects(
    booking({ sessionType: 'phone' }).validate(),
    /not a valid enum value/,
  );
});
