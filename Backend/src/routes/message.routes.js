const express = require('express');
const { z } = require('zod');
const Message = require('../models/Message');
const TutorRequestMessage = require('../models/TutorRequestMessage');
const { requireAuth } = require('../middleware/auth');
const { chatRoom, createChatMessage, getChatBooking, publicMessage, userRoom } = require('../services/booking-chat');
const { notify } = require('../services/notifications');
const { createTutorRequestMessage, getChatTutorRequest, publicTutorRequestMessage, tutorRequestRoom } = require('../services/tutor-request-chat');

const router = express.Router();
router.use(requireAuth);

router.get('/booking/:bookingId', async (request, response, next) => {
  try {
    await getChatBooking(request.params.bookingId, request.auth.sub);
    const messages = await Message.find({ booking: request.params.bookingId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name role avatarUrl')
      .lean();
    return response.json({ messages: messages.reverse().map(publicMessage) });
  } catch (error) {
    return next(error);
  }
});

router.post('/booking/:bookingId', async (request, response, next) => {
  try {
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A message must be between 1 and 1,000 characters.' });

    const result = await createChatMessage(request.params.bookingId, request.auth.sub, parsed.data.text);
    const recipient = result.booking.student.toString() === request.auth.sub
      ? result.booking.tutor
      : result.booking.student;
    const io = request.app.get('io');
    io?.to(chatRoom(request.params.bookingId)).emit('message:new', result.message);
    io?.to(userRoom(recipient.toString())).emit('message:notification', {
      title: `${request.user.name} sent a message`,
      text: parsed.data.text,
      bookingId: result.booking._id.toString(),
      actionRoute: `/session/${result.booking._id}?mode=workspace`,
    });
    await notify(recipient, {
      type: 'session',
      title: `${request.user.name} sent a message`,
      message: parsed.data.text.slice(0, 280),
      booking: result.booking._id,
      actionRoute: `/session/${result.booking._id}?mode=workspace`,
    }).catch(() => null);

    return response.status(201).json({ message: result.message });
  } catch (error) {
    return next(error);
  }
});

router.get('/tutor-request/:tutorRequestId', async (request, response, next) => {
  try {
    await getChatTutorRequest(request.params.tutorRequestId, request.auth.sub);
    const messages = await TutorRequestMessage.find({ tutorRequest: request.params.tutorRequestId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('sender', 'name role avatarUrl')
      .lean();
    return response.json({ messages: messages.reverse().map(publicTutorRequestMessage) });
  } catch (error) {
    return next(error);
  }
});

router.post('/tutor-request/:tutorRequestId', async (request, response, next) => {
  try {
    const parsed = z.strictObject({ text: z.string().trim().min(1).max(1000) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'A message must be between 1 and 1,000 characters.' });

    const result = await createTutorRequestMessage(request.params.tutorRequestId, request.auth.sub, parsed.data.text);
    const recipient = result.tutorRequest.student.toString() === request.auth.sub
      ? result.tutorRequest.tutor
      : result.tutorRequest.student;
    const actionRoute = `/direct-session/${result.tutorRequest._id}`;
    const io = request.app.get('io');
    io?.to(tutorRequestRoom(request.params.tutorRequestId)).emit('message:new', result.message);
    io?.to(userRoom(recipient.toString())).emit('message:notification', {
      title: `${request.user.name} sent a message`,
      text: parsed.data.text,
      bookingId: result.tutorRequest._id.toString(),
      actionRoute,
    });
    await notify(recipient, {
      type: 'session',
      title: `${request.user.name} sent a message`,
      message: parsed.data.text.slice(0, 280),
      actionRoute,
    }).catch(() => null);

    return response.status(201).json({ message: result.message });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
