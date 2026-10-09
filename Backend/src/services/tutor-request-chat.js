const mongoose = require('mongoose');
const TutorRequest = require('../models/TutorRequest');
const TutorRequestMessage = require('../models/TutorRequestMessage');

function tutorRequestRoom(tutorRequestId) {
  return `tutor-request:${tutorRequestId}`;
}

function isTutorRequestParticipant(tutorRequest, userId) {
  return [tutorRequest.student.toString(), tutorRequest.tutor.toString()].includes(userId);
}

async function getChatTutorRequest(tutorRequestId, userId) {
  if (!mongoose.isValidObjectId(tutorRequestId)) {
    throw Object.assign(new Error('Tutor request conversation not found.'), { statusCode: 404 });
  }
  const tutorRequest = await TutorRequest.findById(tutorRequestId)
    .select('student tutor status sessionStatus')
    .lean();
  if (!tutorRequest) throw Object.assign(new Error('Tutor request conversation not found.'), { statusCode: 404 });
  if (!isTutorRequestParticipant(tutorRequest, userId)) {
    throw Object.assign(new Error('You cannot access this tutor request conversation.'), { statusCode: 403 });
  }
  if (tutorRequest.status !== 'accepted' || !['live', 'completed'].includes(tutorRequest.sessionStatus)) {
    throw Object.assign(new Error('Chat becomes available when the tutor starts the live session.'), { statusCode: 409 });
  }
  return tutorRequest;
}

function publicTutorRequestMessage(message) {
  const sender = message.sender;
  return {
    id: message._id.toString(),
    bookingId: message.tutorRequest.toString(),
    text: message.text,
    sender: {
      id: sender._id.toString(),
      name: sender.name,
      role: sender.role,
      avatarUrl: sender.avatarUrl,
    },
    createdAt: message.createdAt,
  };
}

async function createTutorRequestMessage(tutorRequestId, userId, text) {
  const tutorRequest = await getChatTutorRequest(tutorRequestId, userId);
  const message = await TutorRequestMessage.create({ tutorRequest: tutorRequest._id, sender: userId, text });
  await message.populate('sender', 'name role avatarUrl');
  return { tutorRequest, message: publicTutorRequestMessage(message) };
}

module.exports = {
  createTutorRequestMessage,
  getChatTutorRequest,
  publicTutorRequestMessage,
  tutorRequestRoom,
};
