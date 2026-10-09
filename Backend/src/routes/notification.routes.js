const express = require('express');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const studentBookingCopy = {
  pending: {
    title: 'Booking request sent',
    message: (subject) => `${subject} is waiting for your tutor to confirm it.`,
  },
  confirmed: {
    title: 'Booking confirmed',
    message: (subject) => `${subject} has been confirmed by your tutor.`,
  },
  scheduled: {
    title: 'Session scheduled',
    message: (subject) => `${subject} is scheduled and ready for your lesson.`,
  },
  reschedule_requested: {
    title: 'Reschedule requested',
    message: (subject) => `Your new time for ${subject} is waiting for tutor confirmation.`,
  },
  cancelled: {
    title: 'Booking cancelled',
    message: (subject) => `${subject} was cancelled.`,
  },
  refund_pending: {
    title: 'Refund requested',
    message: (subject) => `The refund for ${subject} is being reviewed.`,
  },
  refunded: {
    title: 'Refund complete',
    message: (subject) => `The refund for ${subject} has been completed.`,
  },
};

async function generateStudentBookingUpdates(userId) {
  const bookings = await Booking.find({ student: userId })
    .select('subject status updatedAt')
    .sort({ updatedAt: -1 })
    .limit(30)
    .lean();
  await Promise.all(bookings.map((booking) => {
    const copy = studentBookingCopy[booking.status];
    if (!copy) return null;
    const uniqueKey = `booking-status:${userId}:${booking._id}:${booking.status}`;
    return Notification.findOneAndUpdate(
      { uniqueKey },
      {
        $setOnInsert: {
          recipient: userId,
          type: booking.status.includes('refund') ? 'payment' : 'booking',
          title: copy.title,
          message: copy.message(booking.subject),
          booking: booking._id,
          actionRoute: '/booking/my-bookings',
          uniqueKey,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
  }));
}

async function generateReminders(userId, role) {
  if (!['student', 'tutor'].includes(role)) return;
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const participant = role === 'student' ? { student: userId, reminderEnabled: true } : { tutor: userId };
  const bookings = await Booking.find({ ...participant, status: { $in: ['confirmed', 'scheduled'] }, startsAt: { $gt: now, $lte: tomorrow } }).select('subject startsAt').lean();
  await Promise.all(bookings.map((booking) => Notification.findOneAndUpdate(
    { uniqueKey: `reminder:${userId}:${booking._id}` },
    { $setOnInsert: { recipient: userId, type: 'reminder', title: 'Lesson coming up', message: `${booking.subject} starts ${new Date(booking.startsAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`, booking: booking._id, actionRoute: `/session/${booking._id}`, uniqueKey: `reminder:${userId}:${booking._id}` } },
    { upsert: true, returnDocument: 'after' },
  )));
}

router.get('/', async (request, response, next) => {
  try {
    await Promise.all([
      generateReminders(request.auth.sub, request.auth.role),
      request.auth.role === 'student'
        ? generateStudentBookingUpdates(request.auth.sub)
        : Promise.resolve(),
    ]);
    const limit = Math.min(Number(request.query.limit) || 50, 100);
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: request.auth.sub })
        .populate({
          path: 'booking',
          select: 'tutor subject startsAt durationMinutes sessionType status',
          populate: { path: 'tutor', select: 'name' },
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipient: request.auth.sub, readAt: null }),
    ]);
    return response.json({ notifications, unreadCount });
  } catch (error) { return next(error); }
});

router.patch('/read-all', async (request, response, next) => {
  try {
    const result = await Notification.updateMany({ recipient: request.auth.sub, readAt: null }, { readAt: new Date() });
    return response.json({ updated: result.modifiedCount, unreadCount: 0 });
  } catch (error) { return next(error); }
});

router.patch('/:id/read', async (request, response, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: request.params.id, recipient: request.auth.sub }, { readAt: new Date() }, { returnDocument: 'after' });
    if (!notification) return response.status(404).json({ message: 'Notification not found.' });
    return response.json({ notification });
  } catch (error) { return next(error); }
});

router.delete('/:id', async (request, response, next) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: request.params.id, recipient: request.auth.sub });
    if (!notification) return response.status(404).json({ message: 'Notification not found.' });
    return response.json({ message: 'Notification removed.' });
  } catch (error) { return next(error); }
});

module.exports = router;
