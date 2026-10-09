const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isBookingRequest,
  shouldChargeCancellationFee,
} = require('../src/services/cancellation-policy');

test('pending and reschedule requests cancel without a learner fee', () => {
  assert.equal(isBookingRequest('pending'), true);
  assert.equal(isBookingRequest('reschedule_requested'), true);
  assert.equal(shouldChargeCancellationFee({ status: 'pending', isStudent: true }), false);
  assert.equal(shouldChargeCancellationFee({ status: 'reschedule_requested', isStudent: true }), false);
});

test('confirmed learner sessions keep the cancellation fee', () => {
  assert.equal(shouldChargeCancellationFee({ status: 'confirmed', isStudent: true }), true);
  assert.equal(shouldChargeCancellationFee({ status: 'scheduled', isStudent: true }), true);
});

test('tutor cancellations never charge a learner cancellation fee', () => {
  assert.equal(shouldChargeCancellationFee({ status: 'confirmed', isStudent: false }), false);
});
