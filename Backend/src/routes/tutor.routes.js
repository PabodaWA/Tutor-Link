const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const User = require('../models/User');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { requireAuth, allowRoles } = require('../middleware/auth');

const router = express.Router();
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reviewPayloadSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(''),
});

function tutorPipeline(match, sort = { averageRating: -1, reviewCount: -1 }, computedMatch = {}) {
  return [
    { $match: match },
    { $lookup: { from: 'reviews', localField: '_id', foreignField: 'tutor', as: 'ratingData' } },
    { $lookup: { from: 'bookings', let: { tutorId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$tutor', '$$tutorId'] }, { $eq: ['$status', 'completed'] }] } } }, { $project: { student: 1 } }], as: 'completedBookingData' } },
    { $lookup: {
      from: 'availabilities',
      let: { tutorId: '$_id' },
      pipeline: [
        { $match: { $expr: { $and: [{ $eq: ['$tutor', '$$tutorId'] }, { $eq: ['$isBooked', false] }, { $gte: ['$startsAt', new Date()] }] } } },
        { $sort: { startsAt: 1 } },
        { $limit: 1 },
        { $project: { startsAt: 1 } },
      ],
      as: 'nextAvailability',
    } },
    { $addFields: {
      averageRating: { $ifNull: [{ $avg: '$ratingData.rating' }, 0] },
      reviewCount: { $size: '$ratingData' },
      ratingBreakdown: { $map: { input: [5, 4, 3, 2, 1], as: 'score', in: { rating: '$$score', count: { $size: { $filter: { input: '$ratingData', as: 'review', cond: { $eq: ['$$review.rating', '$$score'] } } } } } } },
      completedSessions: { $size: '$completedBookingData' },
      studentsTaught: { $size: { $setUnion: ['$completedBookingData.student', []] } },
      nextAvailableAt: { $arrayElemAt: ['$nextAvailability.startsAt', 0] },
    } },
    ...(Object.keys(computedMatch).length ? [{ $match: computedMatch }] : []),
    { $project: { name: 1, role: 1, isVerified: 1, verificationStatus: 1, verificationReviewedAt: 1, 'profile.bio': 1, 'profile.subjects': 1, 'profile.experience': 1, 'profile.hourlyRate': 1, 'profile.qualifications': 1, averageRating: 1, reviewCount: 1, ratingBreakdown: 1, completedSessions: 1, studentsTaught: 1, nextAvailableAt: 1, createdAt: 1 } },
    { $sort: sort },
  ];
}

router.get('/', async (request, response, next) => {
  try {
    const parsed = z.object({ q: z.string().max(80).optional(), subject: z.string().max(50).optional(), minRate: z.coerce.number().min(0).optional(), maxRate: z.coerce.number().max(100000).optional(), minRating: z.coerce.number().min(0).max(5).optional(), experience: z.enum(['New tutor', '1-2 years', '3+ years']).optional(), available: z.enum(['today', 'week']).optional(), sort: z.enum(['rating', 'rate_low', 'rate_high', 'newest']).default('rating'), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(20) }).safeParse(request.query);
    if (!parsed.success) return response.status(400).json({ message: 'Invalid tutor filters.' });
    const { q, subject, minRate, maxRate, minRating, experience, available, sort, page, limit } = parsed.data;
    const match = { role: 'tutor', status: 'active', isVerified: true };
    if (q) { const pattern = new RegExp(escapeRegex(q), 'i'); match.$or = [{ name: pattern }, { 'profile.subjects': pattern }, { 'profile.bio': pattern }]; }
    if (subject && subject !== 'All') match['profile.subjects'] = new RegExp(`^${escapeRegex(subject)}$`, 'i');
    if (minRate !== undefined || maxRate !== undefined) match['profile.hourlyRate'] = { ...(minRate !== undefined && { $gte: minRate }), ...(maxRate !== undefined && { $lte: maxRate }) };
    if (experience) match['profile.experience'] = experience;
    const computedMatch = {};
    if (minRating !== undefined) computedMatch.averageRating = { $gte: minRating };
    if (available) {
      const end = new Date();
      if (available === 'today') end.setHours(23, 59, 59, 999);
      else end.setDate(end.getDate() + 7);
      computedMatch.nextAvailableAt = { $ne: null, $lte: end };
    }
    const sorting = sort === 'rate_low' ? { 'profile.hourlyRate': 1 } : sort === 'rate_high' ? { 'profile.hourlyRate': -1 } : sort === 'newest' ? { createdAt: -1 } : { averageRating: -1, reviewCount: -1 };
    const [result] = await User.aggregate([...tutorPipeline(match, sorting, computedMatch), { $facet: { tutors: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'count' }] } }]);
    const total = result.total[0]?.count || 0;
    return response.json({ tutors: result.tutors, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});

router.get('/subjects', async (_request, response, next) => {
  try { const subjects = await User.distinct('profile.subjects', { role: 'tutor', status: 'active', isVerified: true }); return response.json({ subjects: subjects.filter(Boolean).sort() }); } catch (error) { return next(error); }
});

router.get('/compare', async (request, response, next) => {
  try {
    const ids = String(request.query.ids || '').split(',').filter((id) => mongoose.isValidObjectId(id)).slice(0, 3).map((id) => new mongoose.Types.ObjectId(id));
    if (ids.length < 2) return response.status(400).json({ message: 'Select at least two tutors to compare.' });
    const tutors = await User.aggregate(tutorPipeline({ _id: { $in: ids }, role: 'tutor', status: 'active', isVerified: true }));
    return response.json({ tutors });
  } catch (error) { return next(error); }
});

router.get('/recommended', requireAuth, allowRoles('student'), async (request, response, next) => {
  try {
    const learner = request.user.profile || {};
    const preferredSubject = String(learner.preferredSubject || learner.interests?.[0] || '').trim();
    const proficiency = learner.currentProficiency || 'Intermediate';
    const tutors = await User.aggregate([
      ...tutorPipeline({ role: 'tutor', status: 'active', isVerified: true }),
      { $limit: 50 },
    ]);

    const normalizedSubject = preferredSubject.toLowerCase();
    const recommendations = tutors.map((tutor) => {
      const tutorSubjects = tutor.profile?.subjects || [];
      const subjectMatched = Boolean(normalizedSubject) && tutorSubjects.some((subject) => {
        const normalizedTutorSubject = subject.toLowerCase();
        return normalizedTutorSubject === normalizedSubject
          || normalizedTutorSubject.includes(normalizedSubject)
          || normalizedSubject.includes(normalizedTutorSubject);
      });
      const experience = tutor.profile?.experience || 'New tutor';
      const experienceFit = proficiency === 'Advanced'
        ? (experience === '3+ years' ? 10 : experience === '1-2 years' ? 7 : 4)
        : proficiency === 'Beginner'
          ? (experience === 'New tutor' ? 7 : 10)
          : (experience === '1-2 years' ? 10 : 8);
      const ratingScore = Math.round((Number(tutor.averageRating || 0) / 5) * 20);
      const availabilityScore = tutor.nextAvailableAt ? 15 : 5;
      const score = Math.min(100, (subjectMatched ? 45 : preferredSubject ? 8 : 25) + ratingScore + availabilityScore + experienceFit + 10);
      const reasons = [
        subjectMatched ? `Teaches ${preferredSubject}` : (tutorSubjects[0] ? `Experienced in ${tutorSubjects[0]}` : 'Verified university tutor'),
        `${experience} experience`,
        tutor.nextAvailableAt ? 'Upcoming availability' : 'Profile matches your level',
      ];
      return { ...tutor, matchScore: score, matchReasons: reasons };
    }).sort((left, right) => right.matchScore - left.matchScore || right.averageRating - left.averageRating);

    return response.json({
      tutors: recommendations.slice(0, 12),
      preferences: {
        preferredSubject,
        currentProficiency: proficiency,
        learningStyles: learner.learningStyles || [],
        tutorMatchGoal: learner.tutorMatchGoal || learner.learningGoal || '',
      },
    });
  } catch (error) { return next(error); }
});

router.get('/:id/match', requireAuth, allowRoles('student'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor not found.' });
    const tutors = await User.aggregate(tutorPipeline({ _id: new mongoose.Types.ObjectId(request.params.id), role: 'tutor', status: 'active', isVerified: true }));
    const tutor = tutors[0];
    if (!tutor) return response.status(404).json({ message: 'Tutor not found.' });

    const learner = request.user.profile || {};
    const interests = (learner.interests || []).map((value) => value.toLowerCase());
    const subjects = (tutor.profile?.subjects || []).map((value) => value.toLowerCase());
    const matchedSubjects = tutor.profile?.subjects?.filter((subject) => interests.some((interest) => interest === subject.toLowerCase() || interest.includes(subject.toLowerCase()) || subject.toLowerCase().includes(interest))) || [];
    const subjectMatched = matchedSubjects.length > 0;
    const hasGoal = Boolean(learner.learningGoal);
    const hasAvailability = Boolean(tutor.nextAvailableAt);
    const experience = tutor.profile?.experience || 'New tutor';
    const experienceScore = experience === '3+ years' ? 15 : experience === '1-2 years' ? 11 : 7;
    const score = Math.min(100, (subjectMatched ? 40 : subjects.length && interests.length ? 12 : 20) + (hasGoal ? 15 : 8) + experienceScore + (hasAvailability ? 20 : 0) + 10);
    const availableData = [interests.length > 0, hasGoal, Boolean(experience), hasAvailability].filter(Boolean).length;

    return response.json({
      tutor,
      match: {
        score,
        confidence: Math.round((availableData / 4) * 100),
        summary: subjectMatched
          ? `Strong subject alignment for ${matchedSubjects.join(', ')} with verified availability.`
          : `A verified tutor with ${experience.toLowerCase()} of experience. Add more learning interests to improve matching.`,
        parameters: [
          { label: 'Subject match', value: subjectMatched ? matchedSubjects.join(', ') : (tutor.profile?.subjects?.join(', ') || 'General tutoring'), met: subjectMatched },
          { label: 'Learning goal', value: learner.learningGoal || 'Not specified', met: hasGoal },
          { label: 'Experience fit', value: experience, met: true },
          { label: 'Availability', value: hasAvailability ? new Date(tutor.nextAvailableAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'No open slot', met: hasAvailability },
        ],
      },
    });
  } catch (error) { return next(error); }
});

router.get('/:id', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor not found.' });
    const [tutors, reviews] = await Promise.all([
      User.aggregate(tutorPipeline({ _id: new mongoose.Types.ObjectId(request.params.id), role: 'tutor', status: 'active', isVerified: true })),
      Review.find({ tutor: request.params.id }).populate('student', 'name').sort({ createdAt: -1 }).limit(30).lean(),
    ]);
    if (!tutors[0]) return response.status(404).json({ message: 'Tutor not found.' });
    return response.json({ tutor: tutors[0], reviews });
  } catch (error) { return next(error); }
});

router.get('/:id/review-eligibility', requireAuth, allowRoles('student'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor not found.' });
    const [completedBooking, review] = await Promise.all([
      Booking.exists({ tutor: request.params.id, student: request.auth.sub, status: 'completed' }),
      Review.findOne({ tutor: request.params.id, student: request.auth.sub }).select('rating comment').lean(),
    ]);
    return response.json({ canReview: Boolean(completedBooking), review });
  } catch (error) { return next(error); }
});

router.post('/:id/reviews', requireAuth, allowRoles('student'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor not found.' });
    const parsed = reviewPayloadSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Choose a rating from 1 to 5 stars. Reviews can be up to 500 characters.' });
    const completedBooking = await Booking.exists({ tutor: request.params.id, student: request.auth.sub, status: 'completed' });
    if (!completedBooking) return response.status(403).json({ message: 'Complete a lesson with this tutor before leaving a review.' });
    const review = await Review.findOneAndUpdate({ tutor: request.params.id, student: request.auth.sub }, parsed.data, { upsert: true, returnDocument: 'after', runValidators: true });
    return response.status(201).json({ review });
  } catch (error) { return next(error); }
});

module.exports = router;
module.exports.reviewPayloadSchema = reviewPayloadSchema;
