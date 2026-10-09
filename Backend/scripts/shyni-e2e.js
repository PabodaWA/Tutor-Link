/* Isolated API/UI smoke test. Never uses or drops the configured application database. */
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../src/models/User');
const Booking = require('../src/models/Booking');
const Availability = require('../src/models/Availability');
const { removeFiles } = require('../src/services/verification-files');
const app = require('../src/app');

const testDatabase = `tutor_link_shyni_e2e_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
const screenshots = process.argv.includes('--screenshots');
const repoRoot = path.resolve(__dirname, '../..');
const mobileRoot = path.join(repoRoot, 'mobile');
const screenshotDirectory = path.join(repoRoot, 'docs/screenshots');
let apiServer;
let expoServer;
let browser;
let databaseWritten = false;

function createPdf() {
  const parts = ['%PDF-1.4\n'];
  const offsets = [0];
  for (const object of [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> >>',
  ]) {
    offsets.push(Buffer.byteLength(parts.join('')));
    parts.push(`${offsets.length - 1} 0 obj\n${object}\nendobj\n`);
  }
  const xrefOffset = Buffer.byteLength(parts.join(''));
  parts.push('xref\n0 4\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) parts.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  parts.push(`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return Buffer.from(parts.join(''));
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Expo web server stopped before it was ready.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Expo web server did not become ready in 90 seconds.');
}

async function takeScreenshot(label, route, token, focusText) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await context.addInitScript((authToken) => localStorage.setItem('tutor-link-auth-token', authToken), token);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:8093${route}`, { waitUntil: 'domcontentloaded' });
  const expected = label.includes('tutor-verification') || label.includes('tutor-rejected') ? 'Tutor verification' : 'Shyni Demo Tutor';
  await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 30000 });
  if (focusText) {
    await page.getByText(focusText, { exact: true }).first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(screenshotDirectory, label) });
  await context.close();
}

async function main() {
  assert.ok(process.env.MONGODB_URI, 'Backend/.env must define MONGODB_URI.');
  assert.ok(process.env.JWT_SECRET?.length >= 32, 'Backend/.env must define a long JWT_SECRET.');
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { dbName: testDatabase, serverSelectionTimeoutMS: 10000 });
      break;
    } catch (error) {
      await mongoose.disconnect().catch(() => undefined);
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
    }
  }
  assert.equal(mongoose.connection.name, testDatabase, 'Refusing to use a non-test database.');
  databaseWritten = true;
  apiServer = await new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
  const apiBase = `http://127.0.0.1:${apiServer.address().port}/api`;

  async function request(method, route, { token, body, expected = 200 } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${apiBase}${route}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }

  const suffix = crypto.randomBytes(4).toString('hex');
  const tutor = await request('POST', '/auth/register', { expected: 201, body: { name: 'Shyni Demo Tutor', email: `shyni-tutor-${suffix}@example.test`, password: 'DemoPass123!', role: 'tutor' } });
  const learner = await request('POST', '/auth/register', { expected: 201, body: { name: 'Demo Learner', email: `shyni-learner-${suffix}@example.test`, password: 'DemoPass123!', role: 'student' } });
  await User.create({ name: 'Demo Administrator', email: `shyni-admin-${suffix}@example.test`, password: await bcrypt.hash('DemoPass123!', 12), role: 'admin', onboardingCompleted: true });
  const admin = await request('POST', '/auth/login', { body: { email: `shyni-admin-${suffix}@example.test`, password: 'DemoPass123!' } });

  await request('PUT', '/users/onboarding', { token: tutor.token, body: { role: 'tutor', subjects: ['Mathematics'], experience: '3+ years', hourlyRate: 1800 } });
  await request('PUT', '/users/onboarding', { token: learner.token, body: { role: 'student', interests: ['Mathematics'], studyLevel: 'Undergraduate', learningGoal: 'Pass exams' } });
  await request('PUT', '/users/onboarding', { token: tutor.token, expected: 409, body: { role: 'tutor', subjects: ['Other'], experience: 'New tutor', hourlyRate: 500 } });
  await request('PATCH', '/users/profile', { token: tutor.token, body: { bio: 'Friendly mathematics lessons.', qualifications: ['BSc Mathematics'] } });
  const beforeApproval = await request('GET', '/tutors?limit=10');
  assert.equal(beforeApproval.tutors.length, 0);

  function evidenceForm(content = createPdf()) {
    const form = new FormData();
    form.append('qualifications', JSON.stringify(['BSc Mathematics']));
    form.append('documents', new Blob([content], { type: 'application/pdf' }), 'degree.pdf');
    return form;
  }
  await request('POST', '/users/verification', { token: tutor.token, expected: 400, body: evidenceForm(Buffer.from('not a PDF')) });
  let submission = await request('POST', '/users/verification', { token: tutor.token, body: evidenceForm() });
  assert.equal(submission.user.verificationStatus, 'pending');
  assert.equal(submission.user.profile.verificationFiles.length, 1);
  let fileId = submission.user.profile.verificationFiles[0].id;

  const queue = await request('GET', '/admin/users', { token: admin.token });
  assert.ok(queue.users.some((user) => String(user._id) === tutor.user.id && user.profile.verificationFiles[0].id === fileId));
  await request('POST', `/admin/users/${tutor.user.id}/verification-files/${fileId}/preview`, { token: learner.token, expected: 403 });
  let preview = await request('POST', `/admin/users/${tutor.user.id}/verification-files/${fileId}/preview`, { token: admin.token });
  let previewResponse = await fetch(`http://127.0.0.1:${apiServer.address().port}${preview.path}`);
  assert.equal(previewResponse.status, 200);
  assert.equal(previewResponse.headers.get('content-type'), 'application/pdf');
  assert.deepEqual(Buffer.from(await previewResponse.arrayBuffer()), createPdf());

  if (screenshots) {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    expoServer = spawn(process.execPath, [path.join(mobileRoot, 'node_modules/expo/bin/cli'), 'start', '--web', '--port', '8093', '--non-interactive'], {
      cwd: mobileRoot,
      env: { ...process.env, EXPO_PUBLIC_API_URL: apiBase, CI: '1' },
      windowsHide: true,
      stdio: 'ignore',
    });
    await waitForServer('http://127.0.0.1:8093', expoServer);
    const { chromium } = require('@playwright/test');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    await takeScreenshot('shyni-tutor-verification-pending.png', '/edit-profile', tutor.token);
    await takeScreenshot('shyni-tutor-verification-details.png', '/edit-profile', tutor.token, 'Tutor verification');
    await takeScreenshot('shyni-admin-verification-queue.png', '/admin?view=verify', admin.token);
  }

  const rejection = await request('PATCH', `/admin/users/${tutor.user.id}`, { token: admin.token, body: { isVerified: false, verificationNote: 'Please upload a clearer document.' } });
  assert.equal(rejection.user.verificationStatus, 'rejected');
  assert.match((await request('GET', '/users/profile', { token: tutor.token })).user.verificationNote, /clearer document/);
  if (screenshots) await takeScreenshot('shyni-tutor-rejected.png', '/edit-profile', tutor.token, 'Tutor verification');
  submission = await request('POST', '/users/verification', { token: tutor.token, body: evidenceForm() });
  fileId = submission.user.profile.verificationFiles[0].id;

  await request('PATCH', `/admin/users/${tutor.user.id}`, { token: admin.token, body: { isVerified: true } });
  const profile = await request('GET', `/tutors/${tutor.user.id}`);
  assert.equal(profile.tutor.isVerified, true);
  assert.equal(profile.tutor.profile.qualifications[0], 'BSc Mathematics');
  assert.equal(profile.tutor.profile.verificationFiles, undefined, 'Private evidence must not appear in the public profile.');
  assert.equal((await request('GET', `/tutors/${tutor.user.id}/review-eligibility`, { token: learner.token })).canReview, false);
  await request('POST', `/tutors/${tutor.user.id}/reviews`, { token: learner.token, expected: 403, body: { rating: 5, comment: 'Excellent lesson.' } });

  const start = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const slot = await Availability.create({ tutor: tutor.user.id, startsAt: start, endsAt: new Date(start.getTime() + 60 * 60 * 1000), isBooked: true });
  await Booking.create({ student: learner.user.id, tutor: tutor.user.id, availabilitySlot: slot._id, subject: 'Mathematics', startsAt: start, durationMinutes: 60, status: 'completed', price: 1800 });
  assert.equal((await request('GET', `/tutors/${tutor.user.id}/review-eligibility`, { token: learner.token })).canReview, true);
  await request('POST', `/tutors/${tutor.user.id}/reviews`, { token: learner.token, expected: 201, body: { rating: 5, comment: 'Clear explanations and helpful examples.' } });
  let reviewed = await request('GET', `/tutors/${tutor.user.id}`);
  assert.equal(reviewed.tutor.averageRating, 5);
  assert.equal(reviewed.tutor.ratingBreakdown[0].count, 1);
  assert.equal(reviewed.tutor.completedSessions, 1);
  assert.equal(reviewed.reviews.length, 1);
  await request('POST', `/tutors/${tutor.user.id}/reviews`, { token: learner.token, expected: 201, body: { rating: 4, comment: 'Updated after another look.' } });
  reviewed = await request('GET', `/tutors/${tutor.user.id}`);
  assert.equal(reviewed.tutor.averageRating, 4);
  assert.equal(reviewed.reviews.length, 1);

  if (screenshots) {
    await takeScreenshot('shyni-learner-tutor-profile.png', `/tutor/${tutor.user.id}`, learner.token);
    await takeScreenshot('shyni-learner-reviews.png', `/tutor/${tutor.user.id}`, learner.token, 'Student reviews');
    await takeScreenshot('shyni-learner-review-editor.png', `/tutor/${tutor.user.id}`, learner.token, 'Edit your verified review');
  }

  const bioOnly = await request('PATCH', '/users/profile', { token: tutor.token, body: { bio: 'Updated teaching introduction.' } });
  assert.equal(bioOnly.user.isVerified, true);
  const changedIdentity = await request('PATCH', '/users/profile', { token: tutor.token, body: { name: 'Shyni Updated Tutor' } });
  assert.equal(changedIdentity.user.isVerified, false);
  assert.equal(changedIdentity.user.verificationStatus, 'not_requested');
  assert.equal(changedIdentity.user.profile.verificationFiles.length, 0);
  await request('GET', `/tutors/${tutor.user.id}`, { expected: 404 });
  console.log('Shyni isolated E2E passed: upload, preview, reject/resubmit, approve, review eligibility, review update, and re-verification.');
  if (screenshots) console.log('Automated screenshots saved in docs/screenshots/.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close().catch(() => undefined);
  if (expoServer) expoServer.kill();
  if (apiServer) {
    apiServer.closeAllConnections();
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (mongoose.connection.readyState === 1 && mongoose.connection.name === testDatabase && databaseWritten) {
    const users = await User.find().select('profile.verificationFiles').lean();
    await removeFiles(users.flatMap((user) => user.profile?.verificationFiles || []));
    assert.equal(mongoose.connection.name, testDatabase, 'Refusing to drop a non-test database.');
    await mongoose.connection.dropDatabase();
    console.log('Temporary isolated test database removed.');
  }
  await mongoose.disconnect();
});
