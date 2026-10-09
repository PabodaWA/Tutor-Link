const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const { allowRoles, requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notifications');

const router = express.Router();
router.use(requireAuth);

const checkoutSchema = z.object({
  bookingId: z.string().refine(mongoose.isValidObjectId, 'Invalid booking.'),
  method: z.enum(['demo_card', 'demo_wallet']),
  last4: z.string().regex(/^\d{4}$/).optional(),
}).superRefine((value, context) => {
  if (value.method === 'demo_card' && !value.last4) {
    context.addIssue({ code: 'custom', path: ['last4'], message: 'Enter a valid demo card number.' });
  }
});

function serializePayment(payment) {
  if (!payment) return null;
  const value = payment.toObject ? payment.toObject() : payment;
  return {
    _id: value._id,
    booking: value.booking,
    student: value.student,
    tutor: value.tutor,
    amount: value.amount,
    currency: value.currency,
    status: value.status,
    provider: value.provider,
    method: value.method,
    last4: value.last4,
    transactionReference: value.providerPaymentIntentId,
    paidAt: value.paidAt,
    refundedAt: value.refundedAt,
    createdAt: value.createdAt,
  };
}

router.post('/demo-checkout', allowRoles('student'), async (request, response, next) => {
  try {
    const parsed = checkoutSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid demo payment.' });

    const booking = await Booking.findOne({ _id: parsed.data.bookingId, student: request.auth.sub });
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    if (booking.creditCost) return response.status(409).json({ message: 'This booking uses Tutor Link credits. Unlock it from the lesson details screen.' });

    const existing = await Payment.findOne({ booking: booking._id });
    if (existing?.status === 'succeeded') {
      return response.json({ payment: serializePayment(existing), message: 'This demo booking is already paid.' });
    }
    if (booking.status !== 'confirmed') return response.status(409).json({ message: 'Your tutor must confirm this booking before payment.' });

    const transactionReference = `DEMO-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const payment = await Payment.findOneAndUpdate(
      { booking: booking._id },
      {
        booking: booking._id,
        student: booking.student,
        tutor: booking.tutor,
        amount: booking.price,
        currency: 'lkr',
        status: 'succeeded',
        provider: 'demo',
        method: parsed.data.method,
        last4: parsed.data.method === 'demo_card' ? parsed.data.last4 : undefined,
        providerPaymentIntentId: transactionReference,
        paidAt: new Date(),
        refundedAt: null,
      },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );

    await Promise.all([
      Booking.findByIdAndUpdate(booking._id, { status: 'scheduled' }),
      Session.findOneAndUpdate({ booking: booking._id }, { paymentStatus: 'paid', paymentReference: transactionReference }),
    ]);
    await notify(booking.tutor, { type: 'payment', title: 'Demo payment received', message: `Payment for ${booking.subject} was approved. The lesson is now scheduled.`, booking: booking._id, actionRoute: `/session/${booking._id}` }).catch(() => null);

    return response.status(201).json({ payment: serializePayment(payment), message: 'Demo payment approved. No real charge was made.' });
  } catch (error) { return next(error); }
});

router.get('/booking/:bookingId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.bookingId)) return response.status(400).json({ message: 'Invalid booking.' });
    const booking = await Booking.findById(request.params.bookingId).lean();
    if (!booking) return response.status(404).json({ message: 'Booking not found.' });
    const participant = request.auth.role === 'admin' || [booking.student.toString(), booking.tutor.toString()].includes(request.auth.sub);
    if (!participant) return response.status(403).json({ message: 'You cannot access this payment.' });
    const payment = await Payment.findOne({ booking: booking._id }).lean();
    return response.json({ payment: serializePayment(payment) });
  } catch (error) { return next(error); }
});

router.get('/mine', allowRoles('student', 'tutor'), async (request, response, next) => {
  try {
    const ownerKey = request.auth.role === 'tutor' ? 'tutor' : 'student';
    const payments = await Payment.find({ [ownerKey]: request.auth.sub })
      .populate('booking', 'subject startsAt durationMinutes status')
      .populate('student tutor', 'name')
      .sort({ createdAt: -1 })
      .lean();
    const summary = payments.reduce((totals, payment) => {
      if (['succeeded', 'refund_pending'].includes(payment.status)) totals.paidAmount += payment.amount;
      if (payment.status === 'refunded') totals.refundedAmount += payment.amount;
      return totals;
    }, { paidAmount: 0, refundedAmount: 0, currency: 'lkr', transactions: payments.length });
    return response.json({ payments: payments.map(serializePayment), summary });
  } catch (error) { return next(error); }
});

router.get('/earnings', allowRoles('tutor'), async (request, response, next) => {
  try {
    const payments = await Payment.find({ tutor: request.auth.sub, status: 'succeeded' }).populate('booking', 'status').lean();
    const weekStart = new Date();
    const day = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
    weekStart.setHours(0, 0, 0, 0);
    const weekly = Array(7).fill(0);
    const totals = payments.reduce((result, payment) => {
      if (payment.booking?.status === 'completed') result.available += payment.amount;
      else result.pending += payment.amount;
      result.total += payment.amount;
      const paidAt = new Date(payment.paidAt || payment.createdAt);
      const dayIndex = Math.floor((paidAt.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000));
      if (dayIndex >= 0 && dayIndex < 7) weekly[dayIndex] += payment.amount;
      return result;
    }, { total: 0, available: 0, pending: 0 });
    return response.json({ earnings: { ...totals, weekly, weeklyTotal: weekly.reduce((sum, amount) => sum + amount, 0), currency: 'lkr', paidSessions: payments.length } });
  } catch (error) { return next(error); }
});

router.get('/', allowRoles('admin'), async (_request, response, next) => {
  try {
    const payments = await Payment.find().populate('student tutor', 'name email').populate('booking', 'subject startsAt status').sort({ createdAt: -1 }).lean();
    return response.json({ payments: payments.map(serializePayment) });
  } catch (error) { return next(error); }
});

router.post('/:bookingId/refund', allowRoles('admin'), async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.bookingId)) return response.status(400).json({ message: 'Invalid booking.' });
    const payment = await Payment.findOneAndUpdate(
      { booking: request.params.bookingId, status: { $in: ['succeeded', 'refund_pending'] } },
      { status: 'refunded', refundedAt: new Date() },
      { returnDocument: 'after' },
    );
    if (!payment) return response.status(404).json({ message: 'A refundable demo payment was not found.' });
    await Promise.all([
      Booking.findByIdAndUpdate(request.params.bookingId, { status: 'refunded' }),
      Session.findOneAndUpdate({ booking: request.params.bookingId }, { paymentStatus: 'refunded' }),
    ]);
    await Promise.all([
      notify(payment.student, { type: 'payment', title: 'Demo refund complete', message: 'Your demo payment was refunded successfully.', booking: request.params.bookingId, actionRoute: '/bookings' }),
      notify(payment.tutor, { type: 'payment', title: 'Lesson payment refunded', message: 'A cancelled lesson demo payment was refunded.', booking: request.params.bookingId, actionRoute: '/bookings' }),
    ]).catch(() => null);
    return response.json({ payment: serializePayment(payment), message: 'Demo refund completed.' });
  } catch (error) { return next(error); }
});

module.exports = router;
