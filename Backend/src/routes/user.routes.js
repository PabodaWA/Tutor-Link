const express = require('express');
const multer = require('multer');
const { z } = require('zod');

const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const { saveFiles, removeFiles } = require('../services/verification-files');
const { verificationIdentityChanged } = require('../services/verification-policy');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 5, fields: 1, parts: 6 } }).array('documents', 5);
const choices = z.array(z.string().trim().min(1).max(50)).min(1).max(8);
const onboardingSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal('student'),
    interests: choices,
    studyLevel: z.enum(['Foundation', 'Undergraduate', 'Postgraduate']),
    learningGoal: z.enum(['Pass exams', 'Build skills', 'Master a subject']),
  }),
  z.object({
    role: z.literal('tutor'),
    subjects: choices,
    experience: z.enum(['New tutor', '1-2 years', '3+ years']),
    hourlyRate: z.number().min(500).max(25000),
  }),
]);

function accountResponse(user, includeProfile = false) {
  const result = {
    id: user._id.toString(), name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl,
    status: user.status, isVerified: user.isVerified, verificationStatus: user.verificationStatus,
    verificationNote: user.verificationNote, verificationReviewedAt: user.verificationReviewedAt,
    onboardingCompleted: user.onboardingCompleted,
  };
  if (includeProfile) result.profile = user.profile || {};
  return result;
}

router.get('/me', requireAuth, (request, response) => {
  const user = request.user;
  return response.json({
    user: accountResponse(user),
  });
});

router.get('/profile', requireAuth, (request, response) => response.json({ user: accountResponse(request.user, true) }));

router.patch('/profile', requireAuth, async (request, response, next) => {
  try {
    const common = {
      name: z.string().trim().min(2).max(80).optional(),
      bio: z.string().trim().max(500).optional(),
    };
    const studentSchema = z.object({
      ...common,
      interests: choices.optional(),
      studyLevel: z.enum(['Foundation', 'Undergraduate', 'Postgraduate']).optional(),
      learningGoal: z.enum(['Pass exams', 'Build skills', 'Master a subject']).optional(),
      preferredSubject: z.string().trim().min(1).max(50).optional(),
      currentProficiency: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
      learningStyles: z.array(z.enum(['Step-by-step', 'Interactive', 'Visual examples', 'Exam prep', 'Online', 'Physical', 'Group'])).min(1).max(2).optional(),
      tutorMatchGoal: z.string().trim().min(1).max(150).optional(),
    });
    const tutorSchema = z.object({ ...common, subjects: choices.optional(), experience: z.enum(['New tutor', '1-2 years', '3+ years']).optional(), hourlyRate: z.number().min(500).max(25000).optional(), qualifications: z.array(z.string().trim().min(2).max(120)).max(10).optional() });
    const schema = request.auth.role === 'tutor' ? tutorSchema : request.auth.role === 'student' ? studentSchema : z.object(common);
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid profile details.' });
    const { name, ...profileFields } = parsed.data;
    const existing = await User.findById(request.auth.sub).select('name role verificationStatus profile.qualifications profile.verificationFiles');
    if (!existing) return response.status(404).json({ message: 'Account not found.' });
    const update = {};
    if (name) update.name = name;
    Object.entries(profileFields).forEach(([key, value]) => { if (value !== undefined) update[`profile.${key}`] = value; });
    const identityChanged = request.auth.role === 'tutor' && verificationIdentityChanged(existing, name, profileFields.qualifications);
    if (identityChanged && existing.verificationStatus !== 'not_requested') {
      Object.assign(update, {
        isVerified: false,
        verificationStatus: 'not_requested',
        verificationNote: 'Your identity or qualifications changed. Submit new evidence for verification.',
        verificationReviewedAt: null,
        verificationReviewedBy: null,
        'profile.verificationFiles': [],
        'profile.verificationDocuments': [],
      });
    }
    const user = await User.findByIdAndUpdate(request.auth.sub, update, { returnDocument: 'after', runValidators: true });
    if (identityChanged && existing.verificationStatus !== 'not_requested') await removeFiles(existing.profile?.verificationFiles || []);
    return response.json({ user: accountResponse(user, true) });
  } catch (error) { return next(error); }
});

router.post('/verification', requireAuth, allowTutor, (request, response, next) => {
  upload(request, response, (error) => error
    ? response.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Each document must be 5 MB or smaller.' : 'Upload up to five PDF, PNG, or JPEG documents.' })
    : next());
}, async (request, response, next) => {
  let saved = [];
  try {
    let qualifications;
    try { qualifications = JSON.parse(request.body.qualifications); } catch { return response.status(400).json({ message: 'Invalid qualifications.' }); }
    const parsed = z.array(z.string().trim().min(2).max(120)).min(1).max(10).safeParse(qualifications);
    if (!parsed.success || !request.files?.length) return response.status(400).json({ message: 'Add a qualification and at least one PDF, PNG, or JPEG document.' });
    saved = await saveFiles(request.files);
    const existing = await User.findById(request.auth.sub).select('profile.verificationFiles');
    const user = await User.findByIdAndUpdate(request.auth.sub, { 'profile.qualifications': parsed.data, 'profile.verificationDocuments': [], 'profile.verificationFiles': saved, verificationStatus: 'pending', isVerified: false, verificationNote: '', verificationReviewedAt: null, verificationReviewedBy: null }, { returnDocument: 'after', runValidators: true });
    if (!user) { await removeFiles(saved); return response.status(404).json({ message: 'Account not found.' }); }
    await removeFiles(existing?.profile?.verificationFiles || []);
    return response.json({ user: accountResponse(user, true), message: 'Verification submitted for admin review.' });
  } catch (error) { await removeFiles(saved); if (error.status === 400) return response.status(400).json({ message: error.message }); return next(error); }
});

router.put('/onboarding', requireAuth, async (request, response, next) => {
  try {
    if (request.user.onboardingCompleted) return response.status(409).json({ message: 'Onboarding is already complete. Use Edit profile to make changes.' });
    const parsed = onboardingSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid onboarding details.' });
    if (parsed.data.role !== request.auth.role) return response.status(403).json({ message: 'This profile does not match your account role.' });

    const { role, ...profile } = parsed.data;
    const user = await User.findByIdAndUpdate(request.auth.sub, { profile, onboardingCompleted: true }, { new: true, runValidators: true });
    if (!user) return response.status(404).json({ message: 'Account not found.' });
    return response.json({
      user: accountResponse(user),
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

function allowTutor(request, response, next) {
  if (request.auth.role !== 'tutor') return response.status(403).json({ message: 'Only tutor accounts can request verification.' });
  return next();
}
