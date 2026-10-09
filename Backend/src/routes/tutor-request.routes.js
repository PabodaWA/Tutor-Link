const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { z } = require('zod');
const TutorRequest = require('../models/TutorRequest');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { notify } = require('../services/notifications');
const { userRoom } = require('../services/booking-chat');

const router = express.Router();
router.use(requireAuth);

const createRequestSchema = z.object({
  tutorId: z.string().refine(mongoose.isValidObjectId, 'Invalid tutor.'),
});

function isParticipant(tutorRequest, userId) {
  const studentId = tutorRequest.student?._id || tutorRequest.student;
  const tutorId = tutorRequest.tutor?._id || tutorRequest.tutor;
  return [studentId.toString(), tutorId.toString()].includes(userId);
}

function publicSharedNote(note) {
  return {
    id: note._id.toString(),
    text: note.text,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function jitsiServerURL() {
  return (process.env.JITSI_SERVER_URL || 'https://meet.jit.si').replace(/\/+$/, '');
}

async function editableLiveRequest(id, auth) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error('Tutor request session not found.'), { statusCode: 404 });
  const tutorRequest = await TutorRequest.findOne({ _id: id, tutor: auth.sub, status: 'accepted' });
  if (!tutorRequest) throw Object.assign(new Error('Only the assigned tutor can edit these session notes.'), { statusCode: 403 });
  if (!['live', 'completed'].includes(tutorRequest.sessionStatus)) {
    throw Object.assign(new Error('Shared notes are available after the live session starts.'), { statusCode: 409 });
  }
  return tutorRequest;
}

router.get('/', async (request, response, next) => {
  try {
    if (!['student', 'tutor'].includes(request.auth.role)) {
      return response.status(403).json({ message: 'Tutor request access denied.' });
    }
    const query = request.auth.role === 'tutor'
      ? { tutor: request.auth.sub }
      : { student: request.auth.sub };
    if (request.auth.role === 'student' && request.query.tutorId) {
      if (!mongoose.isValidObjectId(request.query.tutorId)) {
        return response.status(400).json({ message: 'Invalid tutor.' });
      }
      query.tutor = request.query.tutorId;
    }
    const requests = await TutorRequest.find(query)
      .select('-roomCode -sharedNotes')
      .populate('student', 'name email isVerified profile.studyLevel profile.learningGoal profile.interests')
      .populate('tutor', 'name email isVerified profile.subjects')
      .sort({ createdAt: -1 })
      .lean();
    return response.json({ requests });
  } catch (error) {
    return next(error);
  }
});

router.get('/:id/session', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor request session not found.' });
    const tutorRequest = await TutorRequest.findById(request.params.id)
      .populate('student', 'name email role')
      .populate('tutor', 'name email role')
      .lean();
    if (!tutorRequest) return response.status(404).json({ message: 'Tutor request session not found.' });
    if (!isParticipant(tutorRequest, request.auth.sub)) return response.status(403).json({ message: 'You cannot access this live session.' });
    if (tutorRequest.status !== 'accepted') return response.status(409).json({ message: 'The tutor request must be accepted first.' });
    delete tutorRequest.roomCode;
    tutorRequest.sharedNotes = (tutorRequest.sharedNotes || []).map(publicSharedNote);
    return response.json({ tutorRequest });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/start-session', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor request not found.' });
    const tutorRequest = await TutorRequest.findOne({
      _id: request.params.id,
      tutor: request.auth.sub,
      status: 'accepted',
      sessionStatus: { $ne: 'completed' },
    });
    if (!tutorRequest) return response.status(409).json({ message: 'This tutor request cannot start a live session.' });
    if (tutorRequest.sessionStatus !== 'live') {
      tutorRequest.sessionStatus = 'live';
      tutorRequest.sessionStartedAt = new Date();
      tutorRequest.roomCode = tutorRequest.roomCode || crypto.randomBytes(12).toString('hex');
      await tutorRequest.save();
      request.app.get('io')?.to(userRoom(tutorRequest.student.toString())).emit('message:notification', {
        title: 'Your tutor started a live session',
        text: `${request.user.name} is ready. Open the classroom to join.`,
        bookingId: tutorRequest._id.toString(),
        actionRoute: `/direct-session/${tutorRequest._id}`,
      });
      await notify(tutorRequest.student, {
        type: 'session',
        title: 'Your tutor started a live session',
        message: `${request.user.name} is ready. Open the classroom to join.`,
        actionRoute: `/direct-session/${tutorRequest._id}`,
      }).catch(() => null);
    }
    return response.json({ tutorRequestId: tutorRequest._id, sessionStatus: tutorRequest.sessionStatus });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/join', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor request session not found.' });
    const tutorRequest = await TutorRequest.findById(request.params.id).lean();
    if (!tutorRequest) return response.status(404).json({ message: 'Tutor request session not found.' });
    if (!isParticipant(tutorRequest, request.auth.sub)) return response.status(403).json({ message: 'You cannot join this live session.' });
    if (tutorRequest.status !== 'accepted' || tutorRequest.sessionStatus !== 'live' || !tutorRequest.roomCode) {
      return response.status(409).json({ message: 'The tutor has not started this live session.' });
    }
    const roomToken = jwt.sign(
      { sub: request.auth.sub, room: tutorRequest.roomCode, tutorRequest: tutorRequest._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '2h' },
    );
    const serverURL = jitsiServerURL();
    return response.json({
      roomToken,
      roomCode: tutorRequest.roomCode,
      serverURL,
      meeting: { room: tutorRequest.roomCode, serverURL },
      expiresIn: 7200,
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/complete-session', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.id)) return response.status(404).json({ message: 'Tutor request session not found.' });
    const tutorRequest = await TutorRequest.findOne({
      _id: request.params.id,
      tutor: request.auth.sub,
      status: 'accepted',
      sessionStatus: 'live',
    });
    if (!tutorRequest) return response.status(409).json({ message: 'This live session cannot be completed.' });
    tutorRequest.sessionStatus = 'completed';
    tutorRequest.sessionCompletedAt = new Date();
    await tutorRequest.save();
    await notify(tutorRequest.student, {
      type: 'session',
      title: 'Live session completed',
      message: `${request.user.name} marked your direct tutoring session complete.`,
      actionRoute: `/direct-session/${tutorRequest._id}`,
    }).catch(() => null);
    return response.json({ message: 'Live session completed.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/:id/shared-notes', async (request, response, next) => {
  try {
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(280) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A short note must be between 1 and 280 characters.' });
    const tutorRequest = await editableLiveRequest(request.params.id, request.auth);
    if (tutorRequest.sharedNotes.length >= 20) return response.status(409).json({ message: 'A session can have up to 20 short notes.' });
    tutorRequest.sharedNotes.push({ text: parsed.data.text });
    await tutorRequest.save();
    return response.status(201).json({ note: publicSharedNote(tutorRequest.sharedNotes.at(-1)), message: 'Short note added.' });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/shared-notes/:noteId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noteId)) return response.status(404).json({ message: 'Short note not found.' });
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(280) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A short note must be between 1 and 280 characters.' });
    const tutorRequest = await editableLiveRequest(request.params.id, request.auth);
    const note = tutorRequest.sharedNotes.id(request.params.noteId);
    if (!note) return response.status(404).json({ message: 'Short note not found.' });
    note.text = parsed.data.text;
    note.updatedAt = new Date();
    await tutorRequest.save();
    return response.json({ note: publicSharedNote(note), message: 'Short note updated.' });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/shared-notes/:noteId', async (request, response, next) => {
  try {
    if (!mongoose.isValidObjectId(request.params.noteId)) return response.status(404).json({ message: 'Short note not found.' });
    const tutorRequest = await editableLiveRequest(request.params.id, request.auth);
    const note = tutorRequest.sharedNotes.id(request.params.noteId);
    if (!note) return response.status(404).json({ message: 'Short note not found.' });
    note.deleteOne();
    await tutorRequest.save();
    return response.json({ message: 'Short note deleted.' });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (request, response, next) => {
  try {
    if (request.auth.role !== 'student') {
      return response.status(403).json({ message: 'Only learners can send tutor requests.' });
    }
    const parsed = createRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return response.status(400).json({ message: parsed.error.issues?.[0]?.message || 'Invalid tutor request.' });
    }
    const tutor = await User.findOne({
      _id: parsed.data.tutorId,
      role: 'tutor',
      status: 'active',
      isVerified: true,
    }).select('name').lean();
    if (!tutor) return response.status(404).json({ message: 'Verified tutor not found.' });

    const existing = await TutorRequest.findOne({
      student: request.auth.sub,
      tutor: tutor._id,
      status: 'pending',
    }).lean();
    if (existing) {
      return response.status(409).json({ message: 'You already have a pending request with this tutor.' });
    }

    const tutorRequest = await TutorRequest.create({
      student: request.auth.sub,
      tutor: tutor._id,
    });
    await notify(tutor._id, {
      type: 'account',
      title: 'New tutor request',
      message: `${request.user.name} sent you a tutor request.`,
      actionRoute: '/tutor-requests',
    }).catch(() => null);
    return response.status(201).json({ tutorRequest });
  } catch (error) {
    if (error?.code === 11000) {
      return response.status(409).json({ message: 'You already have a pending request with this tutor.' });
    }
    return next(error);
  }
});

router.patch('/:id', async (request, response, next) => {
  try {
    if (request.auth.role !== 'tutor') {
      return response.status(403).json({ message: 'Only tutors can respond to tutor requests.' });
    }
    const parsed = z.object({ action: z.enum(['accept', 'reject']) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Invalid tutor request action.' });
    const tutorRequest = await TutorRequest.findOne({
      _id: request.params.id,
      tutor: request.auth.sub,
      status: 'pending',
    });
    if (!tutorRequest) {
      return response.status(404).json({ message: 'Pending tutor request not found.' });
    }
    tutorRequest.status = parsed.data.action === 'accept' ? 'accepted' : 'rejected';
    await tutorRequest.save();
    await notify(tutorRequest.student, {
      type: 'account',
      title: parsed.data.action === 'accept' ? 'Tutor request accepted' : 'Tutor request declined',
      message: parsed.data.action === 'accept'
        ? `${request.user.name} accepted your tutor request.`
        : `${request.user.name} declined your tutor request.`,
      actionRoute: '/discover',
    }).catch(() => null);
    return response.json({ tutorRequest });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
