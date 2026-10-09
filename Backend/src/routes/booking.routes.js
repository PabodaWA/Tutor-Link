const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Availability = require('../models/Availability');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { requireAuth } = require('../middleware/auth');
const { notify, notifyAdmins } = require('../services/notifications');
const { isBookingRequest, shouldChargeCancellationFee } = require('../services/cancellation-policy');

const router = express.Router();
router.use(requireAuth);
const bookingSchema = z.object({
  tutorId: z.string().refine(mongoose.isValidObjectId, 'Invalid tutor.'),
  slotId: z.string().refine(mongoose.isValidObjectId, 'Invalid time slot.'),
  subject: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(300).optional().default(''),
  sessionType: z.enum(['online', 'in_person']).default('online'),
});

function creditsForPrice(price) {
  return Math.max(1, Math.ceil(price / 100));
}

async function settleCancellationCredits(booking, chargeStudentFee) {
  const creditCost = booking.creditCost || creditsForPrice(booking.price);
  const fee = chargeStudentFee ? Math.max(1, Math.ceil(creditCost * 0.2)) : 0;
  const transactionSession = await mongoose.startSession();
  try {
    await transactionSession.withTransaction(async () => {
      if (booking.creditsCharged) {
        const refund = creditCost - fee;
        const reference = `CANCEL-REFUND-${booking._id}`;
        const settled = await CreditTransaction.exists({ user: booking.student, reference }).session(transactionSession);
        if (refund > 0 && !settled) {
          const user = await User.findByIdAndUpdate(booking.student, { $inc: { creditBalance: refund } }, { returnDocument: 'after', session: transactionSession });
          await CreditTransaction.create([{ user: booking.student, booking: booking._id, type: 'cancellation_refund', amount: refund, balanceAfter: user.creditBalance, description: fee ? `Cancellation refund after ${fee}-credit fee` : 'Full refund after tutor cancellation', reference }], { session: transactionSession });
        }
        booking.creditRefundedAt = new Date();
      } else if (fee > 0) {
        const reference = `CANCEL-FEE-${booking._id}`;
        const settled = await CreditTransaction.exists({ user: booking.student, reference }).session(transactionSession);
        if (!settled) {
          const user = await User.findOneAndUpdate({ _id: booking.student, creditBalance: { $gte: fee } }, { $inc: { creditBalance: -fee } }, { returnDocument: 'after', session: transactionSession });
          if (!user) throw Object.assign(new Error(`At least ${fee} credits are required for the cancellation fee.`), { statusCode: 409 });
          await CreditTransaction.create([{ user: booking.student, booking: booking._id, type: 'cancellation_fee', amount: -fee, balanceAfter: user.creditBalance, description: `Booking cancellation fee: ${fee} credits`, reference }], { session: transactionSession });
        }
      }
    });
  } finally {
    await transactionSession.endSession();
  }
  booking.cancellationFeeCredits = fee;
}

router.get('/', async (request, response, next) => {
  try {
    const key = request.auth.role === 'tutor' ? 'tutor' : 'student';
    if (!['student', 'tutor', 'admin'].includes(request.auth.role)) return response.status(403).json({ message: 'Booking access denied.' });
    const query = request.auth.role === 'admin' ? {} : { [key]: request.auth.sub };
    const bookings = await Booking.find(query)
      .populate('student', 'name email isVerified profile.studyLevel profile.learningGoal profile.interests')
      .populate('tutor', 'name email isVerified profile.subjects')
      .populate('availabilitySlot')
      .sort({ startsAt: 1 })
      .lean();
    return response.json({ bookings });
  } catch (error) { return next(error); }
});

router.post('/', async (request, response, next) => {
  let reservedSlot = null;
  try {
    if (request.auth.role !== 'student') return response.status(403).json({ message: 'Only learners can create bookings.' });
    const parsed = bookingSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid booking.' });
    const tutor = await User.findOne({ _id: parsed.data.tutorId, role: 'tutor', status: 'active', isVerified: true });
    if (!tutor) return response.status(404).json({ message: 'Verified tutor not found.' });
    const availableSlot = await Availability.findOne({ _id: parsed.data.slotId, tutor: tutor._id, isBooked: false, startsAt: { $gt: new Date() } }).lean();
    if (!availableSlot) return response.status(409).json({ message: 'This time is no longer available. Choose another slot.' });
    const previewDuration = Math.round((availableSlot.endsAt - availableSlot.startsAt) / 60000);
    const previewPrice = Math.round((tutor.profile?.hourlyRate || 1500) * previewDuration / 60);
    const creditCost = creditsForPrice(previewPrice);
    const student = await User.findById(request.auth.sub).select('creditBalance').lean();
    if ((student?.creditBalance || 0) < creditCost) return response.status(402).json({ message: `This booking requires ${creditCost} credits. Buy or redeem credits first.`, requiredCredits: creditCost, balance: student?.creditBalance || 0 });
    reservedSlot = await Availability.findOneAndUpdate({ _id: parsed.data.slotId, tutor: tutor._id, isBooked: false, startsAt: { $gt: new Date() } }, { isBooked: true }, { returnDocument: 'after' });
    if (!reservedSlot) return response.status(409).json({ message: 'This time is no longer available. Choose another slot.' });
    const durationMinutes = Math.round((reservedSlot.endsAt - reservedSlot.startsAt) / 60000);
    const price = Math.round((tutor.profile?.hourlyRate || 1500) * durationMinutes / 60);
    const booking = await Booking.create({ student: request.auth.sub, tutor: tutor._id, availabilitySlot: reservedSlot._id, subject: parsed.data.subject, notes: parsed.data.notes, sessionType: parsed.data.sessionType, startsAt: reservedSlot.startsAt, durationMinutes, price, creditCost: creditsForPrice(price) });
    await Session.create({ booking: booking._id, roomCode: crypto.randomBytes(12).toString('hex') });
    await Promise.all([
      notify(booking.tutor, { type: 'booking', title: 'New lesson request', message: `${request.user.name} requested ${booking.subject}.`, booking: booking._id, actionRoute: '/bookings' }),
      notify(booking.student, { type: 'booking', title: 'Booking request sent', message: `${booking.subject} is waiting for your tutor to confirm it.`, booking: booking._id, actionRoute: '/booking/my-bookings', uniqueKey: `booking-status:${booking.student}:${booking._id}:pending` }),
    ]).catch(() => null);
    return response.status(201).json({ booking });
  } catch (error) {
    if (reservedSlot) await Availability.findByIdAndUpdate(reservedSlot._id, { isBooked: false }).catch(() => undefined);
    return next(error);
  }
});

router.post('/:id/reschedule', async (request, response, next) => {
  let newSlot = null;
  try {
    if (request.auth.role !== 'student') return response.status(403).json({ message: 'Only the learner can reschedule this booking.' });
    const parsed = z.object({ slotId: z.string().refine(mongoose.isValidObjectId) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Choose a valid new time.' });
    const booking = await Booking.findOne({ _id: request.params.id, student: request.auth.sub, status: { $in: ['pending', 'confirmed', 'scheduled'] } });
    if (!booking) return response.status(404).json({ message: 'Booking cannot be rescheduled.' });
    newSlot = await Availability.findOneAndUpdate({ _id: parsed.data.slotId, tutor: booking.tutor, isBooked: false, startsAt: { $gt: new Date() } }, { isBooked: true }, { returnDocument: 'after' });
    if (!newSlot) return response.status(409).json({ message: 'The new time is no longer available.' });
    booking.previousStartsAt = booking.startsAt;
    booking.previousAvailabilitySlot = booking.availabilitySlot;
    booking.previousDurationMinutes = booking.durationMinutes;
    booking.previousPrice = booking.price;
    booking.previousStatus = booking.status;
    booking.availabilitySlot = newSlot._id;
    booking.startsAt = newSlot.startsAt;
    booking.durationMinutes = Math.round((newSlot.endsAt - newSlot.startsAt) / 60000);
    const tutor = await User.findById(booking.tutor).select('profile.hourlyRate').lean();
    booking.price = Math.round((tutor?.profile?.hourlyRate || 1500) * booking.durationMinutes / 60);
    booking.status = 'reschedule_requested';
    await booking.save();
    await notify(booking.tutor, { type: 'booking', title: 'Reschedule requested', message: `${request.user.name} requested a new time for ${booking.subject}.`, booking: booking._id, actionRoute: '/bookings' }).catch(() => null);
    return response.json({ booking });
  } catch (error) {
    if (newSlot) await Availability.findByIdAndUpdate(newSlot._id, { isBooked: false }).catch(() => undefined);
    return next(error);
  }
});

router.patch('/:id', async (request, response, next) => {
  try {
    const parsed = z.object({ action: z.enum(['confirm', 'reject', 'cancel', 'complete', 'toggle_reminder']), reason: z.string().trim().max(240).optional(), reminderEnabled: z.boolean().optional() }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Invalid booking action.' });
    const booking = await Booking.findOne({ _id: request.params.id, $or: [{ student: request.auth.sub }, { tutor: request.auth.sub }] });
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    const isTutor = booking.tutor.toString() === request.auth.sub;
    const isStudent = booking.student.toString() === request.auth.sub;
    const { action } = parsed.data;
    let notification = null;

    if (action === 'toggle_reminder') {
      if (!isStudent) return response.status(403).json({ message: 'Only the learner can change reminders.' });
      booking.reminderEnabled = parsed.data.reminderEnabled ?? !booking.reminderEnabled;
    } else if (action === 'confirm') {
      if (!isTutor || !['pending', 'reschedule_requested'].includes(booking.status)) return response.status(409).json({ message: 'This booking cannot be confirmed.' });
      const wasReschedule = booking.status === 'reschedule_requested';
      const alreadyPaid = Boolean(await Payment.exists({ booking: booking._id, status: 'succeeded' }));
      booking.status = alreadyPaid ? 'scheduled' : 'confirmed';
      if (wasReschedule && booking.previousAvailabilitySlot) {
        await Availability.findByIdAndUpdate(booking.previousAvailabilitySlot, { isBooked: false });
        booking.previousAvailabilitySlot = undefined; booking.previousStartsAt = undefined; booking.previousDurationMinutes = undefined; booking.previousPrice = undefined; booking.previousStatus = undefined;
      }
      notification = { recipient: booking.student, type: 'booking', title: 'Booking confirmed', message: alreadyPaid ? `${booking.subject} was rescheduled and remains fully paid.` : `${booking.subject} was confirmed. Use your credits when you are ready to unlock the meeting.`, actionRoute: `/session/${booking._id}` };
    } else if (action === 'reject') {
      if (!isTutor || !['pending', 'reschedule_requested'].includes(booking.status)) return response.status(409).json({ message: 'This booking cannot be rejected.' });
      if (booking.status === 'reschedule_requested' && booking.previousAvailabilitySlot) {
        await Availability.findByIdAndUpdate(booking.availabilitySlot, { isBooked: false });
        booking.availabilitySlot = booking.previousAvailabilitySlot;
        booking.startsAt = booking.previousStartsAt;
        booking.durationMinutes = booking.previousDurationMinutes;
        booking.price = booking.previousPrice;
        booking.status = booking.previousStatus || 'confirmed';
        booking.previousAvailabilitySlot = undefined; booking.previousStartsAt = undefined; booking.previousDurationMinutes = undefined; booking.previousPrice = undefined; booking.previousStatus = undefined;
        notification = { recipient: booking.student, type: 'booking', title: 'Reschedule declined', message: `${booking.subject} remains at its original time.`, actionRoute: '/bookings' };
      } else {
      const paidReschedule = Boolean(await Payment.exists({ booking: booking._id, status: 'succeeded' }));
      booking.status = paidReschedule ? 'refund_pending' : 'cancelled'; booking.cancelledBy = 'tutor'; booking.cancellationReason = parsed.data.reason || 'Tutor declined the request.';
      notification = { recipient: booking.student, type: paidReschedule ? 'payment' : 'booking', title: paidReschedule ? 'Refund requested' : 'Booking declined', message: paidReschedule ? `${booking.subject} was declined and sent for a demo refund.` : `${booking.subject} was declined by the tutor. Choose another available time.`, actionRoute: '/bookings' };
      if (paidReschedule) await Promise.all([Payment.findOneAndUpdate({ booking: booking._id }, { status: 'refund_pending' }), Session.findOneAndUpdate({ booking: booking._id }, { paymentStatus: 'pending' }), notifyAdmins({ type: 'payment', title: 'Demo refund requires review', message: `${booking.subject} has a pending refund.`, booking: booking._id, actionRoute: '/admin' }).catch(() => null)]);
      await Availability.findByIdAndUpdate(booking.availabilitySlot, { isBooked: false });
      }
    } else if (action === 'cancel') {
      if (!['pending', 'confirmed', 'scheduled', 'reschedule_requested'].includes(booking.status)) return response.status(409).json({ message: 'This booking can no longer be cancelled.' });
      const requestCancellation = isBookingRequest(booking.status);
      const millisecondsUntilStart = booking.startsAt.getTime() - Date.now();
      if (millisecondsUntilStart <= 0) return response.status(409).json({ message: 'This session has already started and can no longer be cancelled.' });
      if (millisecondsUntilStart < 2 * 60 * 60 * 1000) return response.status(409).json({ message: 'Bookings cannot be cancelled within 2 hours of the session.' });
      const paid = Boolean(await Payment.exists({ booking: booking._id, status: 'succeeded' }));
      await settleCancellationCredits(booking, shouldChargeCancellationFee({ status: booking.status, isStudent }));
      booking.status = paid ? 'refund_pending' : 'cancelled'; booking.cancelledBy = isTutor ? 'tutor' : 'student'; booking.cancellationReason = parsed.data.reason || 'Cancelled by user.';
      notification = { recipient: isTutor ? booking.student : booking.tutor, type: paid ? 'payment' : 'booking', title: paid ? 'Refund requested' : requestCancellation ? 'Booking request cancelled' : 'Booking cancelled', message: requestCancellation ? `${booking.subject} request was cancelled before confirmation.` : `${booking.subject} was cancelled${paid ? ' and is awaiting an admin demo refund' : ''}.`, actionRoute: '/bookings' };
      if (paid) await Promise.all([Payment.findOneAndUpdate({ booking: booking._id, status: 'succeeded' }, { status: 'refund_pending' }), Session.findOneAndUpdate({ booking: booking._id }, { paymentStatus: 'pending' })]);
      else if (booking.creditsCharged) await Session.findOneAndUpdate({ booking: booking._id }, { paymentStatus: 'refunded' });
      if (paid) await notifyAdmins({ type: 'payment', title: 'Demo refund requires review', message: `${booking.subject} has a pending refund.`, booking: booking._id, actionRoute: '/admin' }).catch(() => null);
      await Availability.findByIdAndUpdate(booking.availabilitySlot, { isBooked: false });
      if (booking.previousAvailabilitySlot) await Availability.findByIdAndUpdate(booking.previousAvailabilitySlot, { isBooked: false });
    } else if (action === 'complete') {
      if (!isTutor || !['confirmed', 'scheduled', 'live'].includes(booking.status) || booking.startsAt > new Date()) return response.status(409).json({ message: 'This session cannot be completed yet.' });
      booking.status = 'completed';
    }
    await booking.save();
    if (notification) await notify(notification.recipient, { ...notification, recipient: undefined, booking: booking._id }).catch(() => null);
    return response.json({ booking });
  } catch (error) { return next(error); }
});

module.exports = router;
