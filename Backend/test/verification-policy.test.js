const assert = require('node:assert/strict');
const test = require('node:test');
const { verificationIdentityChanged } = require('../src/services/verification-policy');

const tutor = { name: 'A Tutor', profile: { qualifications: ['BSc Computing'] } };

test('editing biography does not invalidate verification', () => {
  assert.equal(verificationIdentityChanged(tutor, 'A Tutor', ['BSc Computing']), false);
});

test('changing the verified name requires new verification', () => {
  assert.equal(verificationIdentityChanged(tutor, 'Another Tutor', ['BSc Computing']), true);
});

test('changing qualifications requires new verification', () => {
  assert.equal(verificationIdentityChanged(tutor, 'A Tutor', ['MSc Computing']), true);
});
