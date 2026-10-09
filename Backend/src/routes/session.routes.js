const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { z } = require('zod');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notifications');

const router = express.Router();
router.use(requireAuth);

function participant(booking, userId, role) {
  return role === 'admin' || [booking.student._id.toString(), booking.tutor._id.toString()].includes(userId);
}

function joinWindow(booking) {
  const start = new Date(booking.startsAt).getTime();
  const now = Date.now();
  return now >= start - 10 * 60 * 1000 && now <= start + (booking.durationMinutes + 15) * 60 * 1000;
}

function jitsiServerURL() {
  return (process.env.JITSI_SERVER_URL || 'https://meet.jit.si').replace(/\/+$/, '');
}

router.get('/:bookingId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.bookingId)) return response.status(404).json({ message: 'Session not found.' });
    const session = await Session.findOne({ booking: request.params.bookingId }).populate({ path: 'booking', populate: [{ path: 'student', select: 'name' }, { path: 'tutor', select: 'name' }] }).lean();
    if (!session) return response.status(404).json({ message: 'Session not found.' });
    if (!participant(session.booking, request.auth.sub, request.auth.role)) return response.status(403).json({ message: 'You cannot access this session.' });
    const canJoin = (session.booking.sessionType || 'online') === 'online' && session.paymentStatus === 'paid' && ['scheduled', 'live'].includes(session.booking.status) && joinWindow(session.booking);
    delete session.roomCode;
    return response.json({ session, canJoin });
  } catch (error) { return next(error); }
});

router.put('/:bookingId/notes', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.bookingId)) return response.status(404).json({ message: 'Session not found.' });
    const parsed = z.strictObject({ notes: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Lesson notes must be 1,000 characters or less.' });
    const session = await Session.findOne({ booking: request.params.bookingId }).populate('booking');
    if (!session) return response.status(404).json({ message: 'Session not found.' });
    if (session.booking.tutor.toString() !== request.auth.sub) return response.status(403).json({ message: 'Only the tutor can edit lesson notes.' });
    if (!['live', 'completed'].includes(session.booking.status) || session.paymentStatus !== 'paid') return response.status(409).json({ message: 'Shared notes are available during or after a paid lesson.' });
    session.notes = parsed.data.notes;
    await session.save();
    return response.json({ notes: session.notes, message: 'Shared session notes saved.' });
  } catch (error) { return next(error); }
});

router.delete('/:bookingId/notes', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.bookingId)) return response.status(404).json({ message: 'Session not found.' });
    const session = await Session.findOne({ booking: request.params.bookingId }).populate('booking');
    if (!session) return response.status(404).json({ message: 'Session not found.' });
    if (session.booking.tutor.toString() !== request.auth.sub) return response.status(403).json({ message: 'Only the tutor can delete lesson notes.' });
    if (!['live', 'completed'].includes(session.booking.status) || session.paymentStatus !== 'paid') return response.status(409).json({ message: 'Shared notes are available during or after a paid lesson.' });
    session.notes = '';
    await session.save();
    return response.json({ notes: '', message: 'Shared session notes deleted.' });
  } catch (error) { return next(error); }
});

function publicSharedNote(note) {
  return {
    id: note._id.toString(),
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function editableSession(bookingId, auth) {
  if (!mongoose.isValidObjectId(bookingId)) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
  const session = await Session.findOne({ booking: bookingId }).populate('booking');
  if (!session) throw Object.assign(new Error('Session not found.'), { statusCode: 404 });
  if (session.booking.tutor.toString() !== auth.sub) throw Object.assign(new Error('Only the tutor can edit shared notes.'), { statusCode: 403 });
  if (!['live', 'completed'].includes(session.booking.status) || session.paymentStatus !== 'paid') {
    throw Object.assign(new Error('Shared notes are available during or after a paid lesson.'), { statusCode: 409 });
  }
  return session;
}

router.post('/:bookingId/shared-notes', async (request, response, next) => {
  try {
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(280) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A short note must be between 1 and 280 characters.' });
    const session = await editableSession(request.params.bookingId, request.auth);
    if (session.sharedNotes.length >= 20) return response.status(409).json({ message: 'A session can have up to 20 short notes.' });
    session.sharedNotes.push({ text: parsed.data.text });
    await session.save();
    return response.status(201).json({ note: publicSharedNote(session.sharedNotes.at(-1)), message: 'Short note added.' });
  } catch (error) { return next(error); }
});

router.patch('/:bookingId/shared-notes/:noteId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noteId)) return response.status(404).json({ message: 'Short note not found.' });
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(280) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A short note must be between 1 and 280 characters.' });
    const session = await editableSession(request.params.bookingId, request.auth);
    const note = session.sharedNotes.id(request.params.noteId);
    if (!note) return response.status(404).json({ message: 'Short note not found.' });
    note.text = parsed.data.text;
    note.updatedAt = new Date();
    await session.save();
    return response.json({ note: publicSharedNote(note), message: 'Short note updated.' });
  } catch (error) { return next(error); }
});

router.delete('/:bookingId/shared-notes/:noteId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noteId)) return response.status(404).json({ message: 'Short note not found.' });
    const session = await editableSession(request.params.bookingId, request.auth);
    const note = session.sharedNotes.id(request.params.noteId);
    if (!note) return response.status(404).json({ message: 'Short note not found.' });
    note.deleteOne();
    await session.save();
    return response.json({ message: 'Short note deleted.' });
  } catch (error) { return next(error); }
});

router.post('/:bookingId/unlock', async (request, response, next) => {
  const dbSession = await mongoose.startSession();
  try {
    let result;
    await dbSession.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: request.params.bookingId, student: request.auth.sub }).session(dbSession);
      if (!booking) throw Object.assign(new Error('Booking not found.'), { statusCode: 404 });
      if ((booking.sessionType || 'online') !== 'online') throw Object.assign(new Error('Only online lessons have a meeting link.'), { statusCode: 409 });
      if (!['confirmed', 'scheduled'].includes(booking.status)) throw Object.assign(new Error('The tutor must confirm this booking before the meeting can be unlocked.'), { statusCode: 409 });
      const creditCost = booking.creditCost || Math.max(1, Math.ceil(booking.price / 100));
      if (booking.creditsCharged) {
        const user = await User.findById(request.auth.sub).select('creditBalance').session(dbSession);
        result = { balance: user?.creditBalance || 0, creditCost, alreadyUnlocked: true };
        return;
      }
      const user = await User.findOneAndUpdate(
        { _id: request.auth.sub, creditBalance: { $gte: creditCost } },
        { $inc: { creditBalance: -creditCost } },
        { returnDocument: 'after', session: dbSession },
      );
      if (!user) throw Object.assign(new Error(`You need ${creditCost} credits to unlock this meeting.`), { statusCode: 402 });
      booking.creditCost = creditCost;
      booking.creditsCharged = true;
      booking.creditsChargedAt = new Date();
      booking.status = 'scheduled';
      await booking.save({ session: dbSession });
      await Session.findOneAndUpdate({ booking: booking._id }, { paymentStatus: 'paid', paymentReference: `CREDITS-${booking._id}` }, { session: dbSession });
      await CreditTransaction.create([{
        user: booking.student,
        booking: booking._id,
        type: 'meeting_unlock',
        amount: -creditCost,
        balanceAfter: user.creditBalance,
        description: `Unlocked ${booking.subject} meeting`,
      }], { session: dbSession });
      result = { balance: user.creditBalance, creditCost, alreadyUnlocked: false };
    });
    await notify(request.auth.sub, { type: 'session', title: 'Meeting unlocked', message: `${result.creditCost} credits were used. Your meeting link will open at lesson time.`, booking: request.params.bookingId, actionRoute: `/session/${request.params.bookingId}` }).catch(() => null);
    return response.json({ ...result, message: result.alreadyUnlocked ? 'This meeting is already unlocked.' : 'Meeting unlocked successfully.' });
  } catch (error) { return next(error); }
  finally { await dbSession.endSession(); }
});

router.post('/:bookingId/join', async (request, response, next) => {
  try {
    const session = await Session.findOne({ booking: request.params.bookingId }).populate({ path: 'booking', populate: [{ path: 'student', select: 'name' }, { path: 'tutor', select: 'name' }] });
    if (!session) return response.status(404).json({ message: 'Session not found.' });
    if (!participant(session.booking, request.auth.sub, request.auth.role)) return response.status(403).json({ message: 'You cannot join this session.' });
    if ((session.booking.sessionType || 'online') !== 'online') return response.status(409).json({ message: 'This is an in-person lesson and has no online classroom.' });
    if (session.paymentStatus !== 'paid') return response.status(402).json({ message: 'Complete payment before joining the session.' });
    if (!['scheduled', 'live'].includes(session.booking.status)) return response.status(409).json({ message: 'This booking is not ready to join.' });
    if (!joinWindow(session.booking)) return response.status(409).json({ message: 'The room opens 10 minutes before the scheduled start.' });
    session.status = 'live'; await session.save();
    await Booking.findByIdAndUpdate(session.booking._id, { status: 'live' });
    const roomToken = jwt.sign({ sub: request.auth.sub, room: session.roomCode, booking: session.booking._id.toString() }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const serverURL = jitsiServerURL();
    return response.json({
      roomToken,
      roomCode: session.roomCode,
      serverURL,
      meeting: { room: session.roomCode, serverURL },
      expiresIn: 7200,
    });
  } catch (error) { return next(error); }
});

router.post('/:bookingId/complete', async (request, response, next) => {
  try {
    const session = await Session.findOne({ booking: request.params.bookingId }).populate('booking');
    if (!session) return response.status(404).json({ message: 'Session not found.' });
    if (session.booking.tutor.toString() !== request.auth.sub) return response.status(403).json({ message: 'Only the tutor can complete this session.' });
    if (session.paymentStatus !== 'paid' || new Date(session.booking.startsAt) > new Date()) return response.status(409).json({ message: 'This paid session cannot be completed yet.' });
    session.status = 'completed'; await session.save();
    await Booking.findByIdAndUpdate(session.booking._id, { status: 'completed' });
    await notify(session.booking.student, { type: 'session', title: 'Lesson completed', message: 'Your tutoring session was marked complete. You can now leave a review.', booking: session.booking._id, actionRoute: `/tutor/${session.booking.tutor}` }).catch(() => null);
    return response.json({ message: 'Session completed. Earnings are now available.' });
  } catch (error) { return next(error); }
});

module.exports = router;
