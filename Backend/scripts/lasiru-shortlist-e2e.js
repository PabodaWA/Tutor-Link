/* Runs against a unique temporary database; never modifies the configured application database. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('../src/app');
const User = require('../src/models/User');

const testDatabase = `lasiru_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
let server;
let connected = false;

async function main() {
  assert.ok(process.env.MONGODB_URI, 'Backend/.env must define MONGODB_URI.');
  assert.ok(process.env.JWT_SECRET?.length >= 32, 'Backend/.env must define JWT_SECRET.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: testDatabase, serverSelectionTimeoutMS: 15000 });
  assert.equal(mongoose.connection.name, testDatabase, 'Refusing to use a non-test database.');
  connected = true;
  server = await new Promise((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method, route, { token, body, expected = 200 } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { ...(token && { Authorization: `Bearer ${token}` }), ...(body && { 'Content-Type': 'application/json' }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }

  const suffix = crypto.randomBytes(4).toString('hex');
  const learner = await request('POST', '/auth/register', { expected: 201, body: { name: 'Lasiru Learner', email: `lasiru-${suffix}@example.test`, password: 'DemoPass123!', role: 'student' } });
  const otherLearner = await request('POST', '/auth/register', { expected: 201, body: { name: 'Another Learner', email: `other-${suffix}@example.test`, password: 'DemoPass123!', role: 'student' } });
  const tutor = await request('POST', '/auth/register', { expected: 201, body: { name: 'Maths Tutor', email: `tutor-${suffix}@example.test`, password: 'DemoPass123!', role: 'tutor' } });

  await request('GET', '/tutor-shortlist', { expected: 401 });
  await request('POST', '/tutor-shortlist', { token: tutor.token, body: { tutorId: tutor.user.id }, expected: 403 });
  await request('POST', '/tutor-shortlist', { token: learner.token, body: { tutorId: 'invalid' }, expected: 400 });
  await request('POST', '/tutor-shortlist', { token: learner.token, body: { tutorId: tutor.user.id }, expected: 404 });

  await User.findByIdAndUpdate(tutor.user.id, { isVerified: true, verificationStatus: 'verified', onboardingCompleted: true, profile: { subjects: ['Mathematics'], experience: '3+ years', hourlyRate: 1800 } });
  const tutors = await request('GET', '/tutors?subject=Mathematics&sort=rate_low');
  assert.ok(tutors.tutors.some((item) => item._id === tutor.user.id));

  const created = await request('POST', '/tutor-shortlist', { token: learner.token, body: { tutorId: tutor.user.id }, expected: 201 });
  const id = created.entry._id;
  assert.equal(created.entry.tutor._id, tutor.user.id);
  assert.equal(created.entry.priority, 'medium');
  await request('POST', '/tutor-shortlist', { token: learner.token, body: { tutorId: tutor.user.id }, expected: 409 });
  const ownList = await request('GET', '/tutor-shortlist', { token: learner.token });
  assert.equal(ownList.shortlist.length, 1);
  assert.equal(ownList.shortlist[0].tutor.name, 'Maths Tutor');
  const otherList = await request('GET', '/tutor-shortlist', { token: otherLearner.token });
  assert.equal(otherList.shortlist.length, 0);

  const searchPayload = {
    name: 'Affordable maths tutors', query: 'algebra', subject: 'Mathematics', sort: 'rate_low',
    filters: { minRate: 1000, maxRate: 2500, minRating: 4, availability: 'week', experience: '3+ years' },
  };
  await request('GET', '/saved-searches', { expected: 401 });
  await request('POST', '/saved-searches', { token: tutor.token, body: searchPayload, expected: 403 });
  await request('POST', '/saved-searches', { token: learner.token, body: { ...searchPayload, filters: { ...searchPayload.filters, minRate: 3000, maxRate: 1000 } }, expected: 400 });
  const createdSearch = await request('POST', '/saved-searches', { token: learner.token, body: searchPayload, expected: 201 });
  const searchId = createdSearch.savedSearch._id;
  assert.equal(createdSearch.savedSearch.name, searchPayload.name);
  const ownSearches = await request('GET', '/saved-searches', { token: learner.token });
  assert.equal(ownSearches.savedSearches.length, 1);
  const otherSearches = await request('GET', '/saved-searches', { token: otherLearner.token });
  assert.equal(otherSearches.savedSearches.length, 0);
  await request('PUT', `/saved-searches/${searchId}`, { token: otherLearner.token, body: searchPayload, expected: 404 });
  const updatedSearch = await request('PUT', `/saved-searches/${searchId}`, { token: learner.token, body: { ...searchPayload, name: 'Best maths tutors', sort: 'rating' } });
  assert.equal(updatedSearch.savedSearch.name, 'Best maths tutors');
  assert.equal(updatedSearch.savedSearch.sort, 'rating');
  await request('DELETE', `/saved-searches/${searchId}`, { token: otherLearner.token, expected: 404 });
  await request('DELETE', `/saved-searches/${searchId}`, { token: learner.token });
  const searchesAfterDelete = await request('GET', '/saved-searches', { token: learner.token });
  assert.equal(searchesAfterDelete.savedSearches.length, 0);

  await request('PUT', `/tutor-shortlist/${id}`, { token: otherLearner.token, body: { note: 'Mine', priority: 'high' }, expected: 404 });
  await request('PUT', `/tutor-shortlist/${id}`, { token: learner.token, body: { note: 'Good tutor', priority: 'invalid' }, expected: 400 });
  const updated = await request('PUT', `/tutor-shortlist/${id}`, { token: learner.token, body: { note: 'Explains clearly', priority: 'high' } });
  assert.equal(updated.entry.note, 'Explains clearly');
  assert.equal(updated.entry.priority, 'high');
  const refreshed = await request('GET', '/tutor-shortlist', { token: learner.token });
  assert.equal(refreshed.shortlist[0].note, 'Explains clearly');

  await request('DELETE', `/tutor-shortlist/${id}`, { token: otherLearner.token, expected: 404 });
  await request('DELETE', `/tutor-shortlist/${id}`, { token: learner.token });
  await request('DELETE', `/tutor-shortlist/${id}`, { token: learner.token, expected: 404 });
  const afterDelete = await request('GET', '/tutor-shortlist', { token: learner.token });
  assert.equal(afterDelete.shortlist.length, 0);
  console.log('Lasiru CRUD E2E passed for tutor shortlist and saved searches: create, read, update, delete, validation and ownership.');
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (connected && mongoose.connection.name === testDatabase) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
