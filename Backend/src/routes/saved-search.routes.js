const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const { requireAuth, allowRoles } = require('../middleware/auth');
const SavedSearch = require('../models/SavedSearch');

const router = express.Router();
router.use(requireAuth, allowRoles('student'));

const filtersSchema = z.strictObject({
  minRate: z.number().min(0).max(100000),
  maxRate: z.number().min(0).max(100000),
  minRating: z.union([z.literal(0), z.literal(3), z.literal(4), z.literal(4.5)]),
  availability: z.enum(['any', 'today', 'week']),
  experience: z.enum(['any', 'New tutor', '1-2 years', '3+ years']),
}).refine(({ minRate, maxRate }) => !minRate || !maxRate || minRate <= maxRate, {
  message: 'Minimum rate must not exceed maximum rate.',
  path: ['maxRate'],
});

const savedSearchPayloadSchema = z.strictObject({
  name: z.string().trim().min(1).max(60),
  query: z.string().trim().max(80),
  subject: z.string().trim().min(1).max(80),
  sort: z.enum(['rating', 'rate_low', 'rate_high', 'newest']),
  filters: filtersSchema,
});

router.get('/', async (request, response, next) => {
  try {
    const savedSearches = await SavedSearch.find({ student: request.auth.sub }).sort({ updatedAt: -1 }).lean();
    return response.json({ savedSearches });
  } catch (error) { return next(error); }
});

router.post('/', async (request, response, next) => {
  try {
    const parsed = savedSearchPayloadSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter a valid saved search.' });
    const count = await SavedSearch.countDocuments({ student: request.auth.sub });
    if (count >= 20) return response.status(409).json({ message: 'You can save up to 20 searches. Remove one before adding another.' });
    const savedSearch = await SavedSearch.create({ student: request.auth.sub, ...parsed.data });
    return response.status(201).json({ savedSearch });
  } catch (error) { return next(error); }
});

router.put('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Saved search not found.' });
    const parsed = savedSearchPayloadSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Enter a valid saved search.' });
    const savedSearch = await SavedSearch.findOneAndUpdate(
      { _id: request.params.id, student: request.auth.sub },
      { $set: parsed.data },
      { returnDocument: 'after', runValidators: true },
    );
    if (!savedSearch) return response.status(404).json({ message: 'Saved search not found.' });
    return response.json({ savedSearch });
  } catch (error) { return next(error); }
});

router.delete('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Saved search not found.' });
    const savedSearch = await SavedSearch.findOneAndDelete({ _id: request.params.id, student: request.auth.sub });
    if (!savedSearch) return response.status(404).json({ message: 'Saved search not found.' });
    return response.json({ message: 'Saved search removed.' });
  } catch (error) { return next(error); }
});

module.exports = router;
module.exports.savedSearchPayloadSchema = savedSearchPayloadSchema;
