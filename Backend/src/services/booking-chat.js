const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Message = require('../models/Message');

const chatStatuses = ['confirmed', 'paid', 'scheduled', 'live', 'completed'];

function chatRoom(bookingId) {
  return `booking:${bookingId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function isParticipant(booking, userId) {
  return [booking.student.toString(), booking.tutor.toString()].includes(userId);
}

async function getChatBooking(bookingId, userId) {
  if (!mongoose.isValidObjectId(bookingId)) {
    throw Object.assign(new Error('Booking conversation not found.'), { statusCode: 404 });
  }
  const booking = await Booking.findById(bookingId).select('student tutor subject status sessionType').lean();
  if (!booking) throw Object.assign(new Error('Booking conversation not found.'), { statusCode: 404 });
  if (!isParticipant(booking, userId)) {
    throw Object.assign(new Error('You cannot access this booking conversation.'), { statusCode: 403 });
  }
  if (!chatStatuses.includes(booking.status)) {
    throw Object.assign(new Error('Chat becomes available after the booking is confirmed.'), { statusCode: 409 });
  }
  return booking;
}

function publicMessage(message) {
  const sender = message.sender;
  return {
    id: message._id.toString(),
    bookingId: message.booking.toString(),
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

async function createChatMessage(bookingId, userId, text) {
  const booking = await getChatBooking(bookingId, userId);
  const message = await Message.create({ booking: booking._id, sender: userId, text });
  await message.populate('sender', 'name role avatarUrl');
  return { booking, message: publicMessage(message) };
}

module.exports = { chatRoom, createChatMessage, getChatBooking, publicMessage, userRoom };
