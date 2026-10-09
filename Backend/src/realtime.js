const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const User = require('./models/User');
const { chatRoom, getChatBooking, userRoom } = require('./services/booking-chat');
const { getChatTutorRequest, tutorRequestRoom } = require('./services/tutor-request-chat');

function configureRealtime(httpServer, app) {
  const configuredOrigins = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
  const io = new Server(httpServer, {
    cors: { origin: configuredOrigins?.length ? configuredOrigins : '*' },
  });
  app.set('io', io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error('Authentication is required.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select('name role status').lean();
      if (!user || user.status === 'suspended') return next(new Error('This account cannot connect.'));
      socket.data.user = { id: user._id.toString(), name: user.name, role: user.role };
      return next();
    } catch {
      return next(new Error('Your session has expired.'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(userRoom(socket.data.user.id));
    socket.on('booking:join', async (payload, acknowledgement) => {
      const reply = typeof acknowledgement === 'function' ? acknowledgement : () => undefined;
      try {
        const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : '';
        await getChatBooking(bookingId, socket.data.user.id);
        await socket.join(chatRoom(bookingId));
        return reply({ ok: true });
      } catch (error) {
        return reply({ ok: false, error: error.message || 'Could not join this conversation.' });
      }
    });
    socket.on('tutor-request:join', async (payload, acknowledgement) => {
      const reply = typeof acknowledgement === 'function' ? acknowledgement : () => undefined;
      try {
        const tutorRequestId = typeof payload?.tutorRequestId === 'string' ? payload.tutorRequestId : '';
        await getChatTutorRequest(tutorRequestId, socket.data.user.id);
        await socket.join(tutorRequestRoom(tutorRequestId));
        return reply({ ok: true });
      } catch (error) {
        return reply({ ok: false, error: error.message || 'Could not join this conversation.' });
      }
    });
  });

  return io;
}

module.exports = { configureRealtime };
