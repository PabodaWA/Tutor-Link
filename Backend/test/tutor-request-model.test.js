const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const TutorRequest = require('../src/models/TutorRequest');
const TutorRequestMessage = require('../src/models/TutorRequestMessage');
const { tutorRequestRoom } = require('../src/services/tutor-request-chat');

const student = new mongoose.Types.ObjectId();
const tutor = new mongoose.Types.ObjectId();

test('new tutor requests default to pending', async () => {
  const request = new TutorRequest({ student, tutor });
  assert.equal(request.status, 'pending');
  assert.equal(request.sessionStatus, 'not_started');
  await request.validate();
});

test('tutor requests accept final response statuses', async () => {
  for (const status of ['accepted', 'rejected']) {
    const request = new TutorRequest({ student, tutor, status });
    await request.validate();
  }
});

test('tutor requests reject unsupported statuses', async () => {
  const request = new TutorRequest({ student, tutor, status: 'confirmed' });
  await assert.rejects(request.validate(), /not a valid enum value/);
});

test('live tutor requests store valid shared notes', async () => {
  const request = new TutorRequest({
    student,
    tutor,
    status: 'accepted',
    sessionStatus: 'live',
    roomCode: 'direct-room-code',
    sharedNotes: [{ text: 'Review the worked example.' }],
  });
  await request.validate();
  assert.equal(request.sharedNotes[0].text, 'Review the worked example.');
});

test('tutor request chat messages require text', async () => {
  const valid = new TutorRequestMessage({ tutorRequest: new mongoose.Types.ObjectId(), sender: student, text: 'Hello tutor' });
  await valid.validate();
  const invalid = new TutorRequestMessage({ tutorRequest: new mongoose.Types.ObjectId(), sender: student, text: '' });
  await assert.rejects(invalid.validate(), /Path `text` is required/);
});

test('tutor request conversations use isolated realtime rooms', () => {
  assert.equal(tutorRequestRoom('request-123'), 'tutor-request:request-123');
});
