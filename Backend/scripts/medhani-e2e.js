/* Isolated credit-wallet and lesson-details test. Never uses the configured application database. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const Booking = require('../src/models/Booking');
const User = require('../src/models/User');

const testDatabase = `medhani_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
let server;
let connected = false;

async function main() {
  assert.ok(process.env.MONGODB_URI, 'Backend/.env must define MONGODB_URI.');
  assert.ok(process.env.JWT_SECRET?.length >= 32, 'Backend/.env must define JWT_SECRET.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: testDatabase, serverSelectionTimeoutMS: 15000 });
  assert.equal(mongoose.connection.name, testDatabase, 'Refusing to use a non-test database.');
  connected = true;
  server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, route, { token, body, expected = 200 } = {}) {
    const response = await fetch(`${base}${route}`, { method, headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }

  const suffix = crypto.randomBytes(4).toString('hex');
  const student = await request('POST', '/auth/register', { expected: 201, body: { name: 'Medhani Learner', email: `medhani-student-${suffix}@example.test`, password: 'DemoPass123!', role: 'student' } });
  const other = await request('POST', '/auth/register', { expected: 201, body: { name: 'Other Learner', email: `medhani-other-${suffix}@example.test`, password: 'DemoPass123!', role: 'student' } });
  const tutor = await request('POST', '/auth/register', { expected: 201, body: { name: 'Medhani Tutor', email: `medhani-tutor-${suffix}@example.test`, password: 'DemoPass123!', role: 'tutor' } });
  await User.findByIdAndUpdate(tutor.user.id, { isVerified: true, verificationStatus: 'verified', onboardingCompleted: true, profile: { subjects: ['Mathematics'], experience: '3+ years', hourlyRate: 1800 } });

  assert.equal((await request('GET', '/credits', { token: student.token })).balance, 0);
  await request('GET', '/credits', { expected: 401 });
  await request('GET', '/credits', { token: tutor.token, expected: 403 });

  const start = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const slot = await request('POST', '/availability', { token: tutor.token, expected: 201, body: { startsAt: start.toISOString(), durationMinutes: 60 } });
  await request('POST', '/bookings', { token: student.token, expected: 402, body: { tutorId: tutor.user.id, slotId: slot.slot._id, subject: 'Mathematics', sessionType: 'online' } });
  assert.equal((await request('POST', '/credits/redeem', { token: student.token, expected: 201, body: { code: 'TUTORLINK25' } })).balance, 25);
  await request('POST', '/credits/redeem', { token: student.token, expected: 409, body: { code: 'TUTORLINK25' } });
  assert.equal((await request('POST', '/credits/buy', { token: student.token, expected: 201, body: { packageId: 'starter' } })).balance, 50);

  const booked = await request('POST', '/bookings', { token: student.token, expected: 201, body: { tutorId: tutor.user.id, slotId: slot.slot._id, subject: 'Mathematics', sessionType: 'online' } });
  const bookingId = booked.booking._id;
  assert.equal(booked.booking.creditCost, 18);
  assert.equal((await request('GET', '/credits', { token: student.token })).balance, 50, 'Booking must check but not deduct credits.');
  await request('PATCH', `/bookings/${bookingId}`, { token: tutor.token, body: { action: 'confirm' } });

  const rescheduleStart = new Date(Date.now() + 72 * 60 * 60 * 1000);
  const rescheduleSlot = await request('POST', '/availability', { token: tutor.token, expected: 201, body: { startsAt: rescheduleStart.toISOString(), durationMinutes: 60 } });
  await request('POST', `/bookings/${bookingId}/reschedule`, { token: student.token, body: { slotId: rescheduleSlot.slot._id } });
  assert.equal((await request('GET', '/credits', { token: student.token })).balance, 50, 'Rescheduling must not deduct credits.');
  await request('PATCH', `/bookings/${bookingId}`, { token: tutor.token, body: { action: 'confirm' } });

  const unlocked = await request('POST', `/sessions/${bookingId}/unlock`, { token: student.token });
  assert.equal(unlocked.balance, 32);
  assert.equal((await request('POST', `/sessions/${bookingId}/unlock`, { token: student.token })).balance, 32, 'Unlock must be idempotent.');
  await request('POST', `/sessions/${bookingId}/join`, { token: student.token, expected: 409 });
  await request('PATCH', `/bookings/${bookingId}`, { token: student.token, body: { action: 'cancel', reason: 'Schedule conflict' } });
  assert.equal((await request('GET', '/credits', { token: student.token })).balance, 46, 'Cancellation keeps a 20% fee and refunds the rest.');

  const secondStart = new Date(Date.now() + 96 * 60 * 60 * 1000);
  const secondSlot = await request('POST', '/availability', { token: tutor.token, expected: 201, body: { startsAt: secondStart.toISOString(), durationMinutes: 60 } });
  const secondBooking = await request('POST', '/bookings', { token: student.token, expected: 201, body: { tutorId: tutor.user.id, slotId: secondSlot.slot._id, subject: 'Algebra', sessionType: 'online' } });
  const secondBookingId = secondBooking.booking._id;
  await request('PATCH', `/bookings/${secondBookingId}`, { token: tutor.token, body: { action: 'confirm' } });
  assert.equal((await request('POST', `/sessions/${secondBookingId}/unlock`, { token: student.token })).balance, 28);
  await request('PUT', `/sessions/${secondBookingId}/notes`, { token: tutor.token, body: { notes: 'Too early' }, expected: 409 });
  await request('PUT', `/sessions/${secondBookingId}/notes`, { token: student.token, body: { notes: 'Not allowed' }, expected: 403 });
  await request('PUT', `/sessions/${secondBookingId}/notes`, { token: tutor.token, body: { notes: 'x'.repeat(1001) }, expected: 400 });
  await Booking.findByIdAndUpdate(secondBookingId, { startsAt: new Date(Date.now() - 60 * 60 * 1000) });
  await request('POST', `/sessions/${secondBookingId}/complete`, { token: tutor.token });
  const savedNotes = await request('PUT', `/sessions/${secondBookingId}/notes`, { token: tutor.token, body: { notes: 'Covered algebra; practise equations.' } });
  const learnerDetails = await request('GET', `/sessions/${secondBookingId}`, { token: student.token });
  assert.equal(learnerDetails.session.notes, savedNotes.notes);
  const creditHistory = await request('GET', '/credits', { token: student.token });
  assert.ok(creditHistory.transactions.some((item) => item.type === 'meeting_unlock'));
  assert.ok(creditHistory.transactions.some((item) => item.type === 'cancellation_refund'));
  console.log('Medhani credit E2E passed: buy/redeem, booking balance check, no reschedule charge, meeting unlock, cancellation fee/refund, completion and notes.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (connected && mongoose.connection.name === testDatabase) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
