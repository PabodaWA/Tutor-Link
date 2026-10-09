const express = require('express');
const fs = require('fs/promises');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const { requireAuth, allowRoles } = require('../middleware/auth');
const { notify } = require('../services/notifications');
const { filePath } = require('../services/verification-files');
const { ensureDefaultAvailabilityForTutor } = require('../services/default-availability');

const router = express.Router();
router.use(requireAuth, allowRoles('admin'));

router.get('/overview', async (_request, response, next) => {
  try {
    const [users, students, tutors, activeUsers, pendingTutors, bookings, payments, refundPending, revenue] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: 'student' }), User.countDocuments({ role: 'tutor' }), User.countDocuments({ status: 'active' }),
      User.countDocuments({ role: 'tutor', status: 'active', isVerified: false, verificationStatus: { $in: ['not_requested', 'pending'] } }), Booking.countDocuments(), Payment.countDocuments({ status: 'succeeded' }),
      Payment.countDocuments({ status: 'refund_pending' }), Payment.aggregate([{ $match: { status: 'succeeded' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    return response.json({ stats: { users, students, tutors, activeUsers, pendingTutors, bookings, payments, refundPending, revenue: revenue[0]?.total || 0 } });
  } catch (error) { return next(error); }
});

router.get('/users', async (request, response, next) => {
  try {
    const query = request.query.role ? { role: request.query.role } : {};
    const users = await User.find(query).select('name email role status isVerified verificationStatus verificationNote verificationReviewedAt onboardingCompleted createdAt profile.qualifications profile.verificationDocuments profile.verificationFiles').sort({ createdAt: -1 }).limit(100).lean();
    return response.json({ users });
  } catch (error) { return next(error); }
});

router.post('/users/:id/verification-files/:fileId/preview', async (request, response, next) => {
  try {
    const user = await User.findById(request.params.id).select('role profile.verificationFiles');
    if (user?.role !== 'tutor' || !user.profile?.verificationFiles?.some((file) => file.id === request.params.fileId)) {
      return response.status(404).json({ message: 'Document not found.' });
    }
    const previewToken = jwt.sign({ purpose: 'verification-preview', adminId: request.auth.sub, tutorId: user.id, fileId: request.params.fileId }, process.env.JWT_SECRET, { expiresIn: '60s' });
    return response.json({ path: `/api/verification-preview/${encodeURIComponent(previewToken)}` });
  } catch (error) { return next(error); }
});

router.patch('/users/:id', async (request, response, next) => {
  try {
    const parsed = z.object({ status: z.enum(['active', 'suspended']).optional(), isVerified: z.boolean().optional(), verificationNote: z.string().trim().max(300).optional() }).refine((data) => Object.keys(data).length > 0).refine((data) => data.isVerified !== false || Boolean(data.verificationNote?.length), { message: 'Add a reason when rejecting verification.' }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Invalid user update.' });
    if (request.params.id === request.auth.sub) return response.status(409).json({ message: 'You cannot change your own admin account here.' });
    const existing = await User.findById(request.params.id).select('role verificationStatus profile.verificationFiles');
    if (!existing) return response.status(404).json({ message: 'User not found.' });
    if (parsed.data.isVerified !== undefined && existing.role !== 'tutor') return response.status(409).json({ message: 'Only tutor verification can be changed.' });
    if (parsed.data.isVerified === true && existing.verificationStatus === 'rejected') return response.status(409).json({ message: 'The tutor must resubmit after rejection before approval.' });
    if (parsed.data.isVerified === true && existing.profile?.verificationFiles?.length) {
      try { await Promise.all(existing.profile.verificationFiles.map((file) => fs.access(filePath(file.id)))); }
      catch { return response.status(409).json({ message: 'An uploaded document is missing. Ask the tutor to resubmit.' }); }
    }
    const update = { ...parsed.data };
    if (parsed.data.isVerified === true) update.verificationStatus = 'verified';
    if (parsed.data.isVerified === false) update.verificationStatus = 'rejected';
    if (parsed.data.isVerified !== undefined) {
      update.verificationNote = parsed.data.isVerified ? (parsed.data.verificationNote || 'Approved by Tutor Link administration.') : parsed.data.verificationNote;
      update.verificationReviewedAt = new Date();
      update.verificationReviewedBy = request.auth.sub;
    }
    const user = await User.findByIdAndUpdate(request.params.id, update, { returnDocument: 'after', runValidators: true }).select('name email role status isVerified verificationStatus');
    const verificationChanged = parsed.data.isVerified !== undefined;
    if (parsed.data.isVerified === true) {
      await ensureDefaultAvailabilityForTutor(user._id).catch(() => null);
    }
    await notify(user._id, { type: verificationChanged ? 'verification' : 'account', title: verificationChanged ? (parsed.data.isVerified ? 'Tutor profile verified' : 'Verification update') : 'Account status updated', message: verificationChanged ? (parsed.data.isVerified ? 'Your tutor profile is verified and visible to learners.' : `Changes requested: ${parsed.data.verificationNote}`) : `Your account is now ${parsed.data.status}.`, actionRoute: '/profile' }).catch(() => null);
    return response.json({ user });
  } catch (error) { return next(error); }
});

module.exports = router;
