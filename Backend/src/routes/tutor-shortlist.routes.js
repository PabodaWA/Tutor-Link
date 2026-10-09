const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const { requireAuth, allowRoles } = require('../middleware/auth');
const TutorShortlist = require('../models/TutorShortlist');
const User = require('../models/User');

const router = express.Router();
router.use(requireAuth, allowRoles('student'));

const tutorFields = 'name profile.subjects profile.hourlyRate status isVerified';
const editSchema = z.strictObject({
  note: z.string().trim().max(300),
  priority: z.enum(['high', 'medium', 'low']),
});

router.get('/', async (request, response, next) => {
  try {
    const shortlist = await TutorShortlist.find({ student: request.auth.sub })
      .populate('tutor', tutorFields).sort({ updatedAt: -1 }).lean();
    return response.json({ shortlist });
  } catch (error) { return next(error); }
});

router.post('/', async (request, response, next) => {
  try {
    const parsed = z.strictObject({ tutorId: z.string() }).safeParse(request.body);
    if (!parsed.success || !mongoose.isValidObjectId(parsed.data.tutorId)) return response.status(400).json({ message: 'Choose a valid tutor.' });
    const tutor = await User.findOne({ _id: parsed.data.tutorId, role: 'tutor', status: 'active', isVerified: true }).select(tutorFields);
    if (!tutor) return response.status(404).json({ message: 'Verified tutor not found.' });
    const existing = await TutorShortlist.exists({ student: request.auth.sub, tutor: tutor._id });
    if (existing) return response.status(409).json({ message: 'This tutor is already in your shortlist.' });
    const entry = await TutorShortlist.create({ student: request.auth.sub, tutor: tutor._id });
    await entry.populate('tutor', tutorFields);
    return response.status(201).json({ entry });
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: 'This tutor is already in your shortlist.' });
    return next(error);
  }
});

router.put('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Shortlist item not found.' });
    const parsed = editSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Enter a note up to 300 characters and choose a priority.' });
    const entry = await TutorShortlist.findOneAndUpdate(
      { _id: request.params.id, student: request.auth.sub },
      { $set: parsed.data },
      { returnDocument: 'after', runValidators: true },
    ).populate('tutor', tutorFields);
    if (!entry) return response.status(404).json({ message: 'Shortlist item not found.' });
    return response.json({ entry });
  } catch (error) { return next(error); }
});

router.delete('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Shortlist item not found.' });
    const entry = await TutorShortlist.findOneAndDelete({ _id: request.params.id, student: request.auth.sub });
    if (!entry) return response.status(404).json({ message: 'Shortlist item not found.' });
    return response.json({ message: 'Tutor removed from shortlist.' });
  } catch (error) { return next(error); }
});

module.exports = router;
