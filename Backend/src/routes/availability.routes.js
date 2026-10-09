const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Availability = require('../models/Availability');
const User = require('../models/User');
const { requireAuth, allowRoles } = require('../middleware/auth');

const router = express.Router();
const durationSchema = z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]);
const availabilitySchema = z.object({
  startsAt: z.coerce.date().refine((date) => date.getTime() > Date.now() + 5 * 60 * 1000, 'Availability must be at least 5 minutes in the future.'),
  durationMinutes: durationSchema.default(60),
  repeatWeeks: z.coerce.number().int().min(1).max(8).default(1),
});

router.get('/tutor/:tutorId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.tutorId)) return response.status(404).json({ message: 'Tutor not found.' });
    const from = request.query.from ? new Date(String(request.query.from)) : new Date();
    const until = request.query.until ? new Date(String(request.query.until)) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const slots = await Availability.find({ tutor: request.params.tutorId, startsAt: { $gte: from, $lte: until }, isBooked: false }).sort({ startsAt: 1 }).lean();
    return response.json({ slots });
  } catch (error) { return next(error); }
});

router.get('/mine', requireAuth, allowRoles('tutor'), async (request, response, next) => {
  try { const slots = await Availability.find({ tutor: request.auth.sub, startsAt: { $gte: new Date() } }).sort({ startsAt: 1 }).lean(); return response.json({ slots }); } catch (error) { return next(error); }
});

router.post('/', requireAuth, allowRoles('tutor'), async (request, response, next) => {
  try {
    const parsed = availabilitySchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid availability.' });
    const tutor = await User.findById(request.auth.sub);
    if (!tutor?.isVerified) return response.status(403).json({ message: 'Tutor verification is required before publishing availability.' });
    const slots = Array.from({ length: parsed.data.repeatWeeks }, (_, index) => {
      const startsAt = new Date(parsed.data.startsAt.getTime() + index * 7 * 24 * 60 * 60 * 1000);
      return { tutor: request.auth.sub, startsAt, endsAt: new Date(startsAt.getTime() + parsed.data.durationMinutes * 60000) };
    });
    const overlap = await Availability.exists({ tutor: request.auth.sub, $or: slots.map((slot) => ({ startsAt: { $lt: slot.endsAt }, endsAt: { $gt: slot.startsAt } })) });
    if (overlap) return response.status(409).json({ message: 'This time overlaps with another availability slot.' });
    const created = await Availability.insertMany(slots);
    return response.status(201).json({ slot: created[0], slots: created });
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: 'This availability already exists.' });
    return next(error);
  }
});

router.patch('/:id', requireAuth, allowRoles('tutor'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ message: 'Invalid availability slot.' });
    const parsed = availabilitySchema.omit({ repeatWeeks: true }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid availability.' });
    const slot = await Availability.findOne({ _id: request.params.id, tutor: request.auth.sub, isBooked: false });
    if (!slot) return response.status(404).json({ message: 'Available slot not found or already booked.' });
    const endsAt = new Date(parsed.data.startsAt.getTime() + parsed.data.durationMinutes * 60000);
    const overlap = await Availability.exists({ _id: { $ne: slot._id }, tutor: request.auth.sub, startsAt: { $lt: endsAt }, endsAt: { $gt: parsed.data.startsAt } });
    if (overlap) return response.status(409).json({ message: 'This time overlaps with another availability slot.' });
    slot.startsAt = parsed.data.startsAt; slot.endsAt = endsAt;
    await slot.save();
    return response.json({ slot });
  } catch (error) { return next(error); }
});

router.delete('/:id', requireAuth, allowRoles('tutor'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ message: 'Invalid availability slot.' });
    const slot = await Availability.findOneAndDelete({ _id: request.params.id, tutor: request.auth.sub, isBooked: false });
    if (!slot) return response.status(404).json({ message: 'Available slot not found or already booked.' });
    return response.json({ message: 'Availability removed.' });
  } catch (error) { return next(error); }
});

module.exports = router;
