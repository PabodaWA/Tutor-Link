const cors = require('cors');
const express = require('express');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const tutorRoutes = require('./routes/tutor.routes');
const bookingRoutes = require('./routes/booking.routes');
const sessionRoutes = require('./routes/session.routes');
const adminRoutes = require('./routes/admin.routes');
const availabilityRoutes = require('./routes/availability.routes');
const paymentRouter = require('./routes/payment.routes');
const notificationRoutes = require('./routes/notification.routes');
const verificationPreviewRoutes = require('./routes/verification-preview.routes');
const tutorShortlistRoutes = require('./routes/tutor-shortlist.routes');
const savedSearchRoutes = require('./routes/saved-search.routes');
const creditRoutes = require('./routes/credit.routes');
const messageRoutes = require('./routes/message.routes');
const tutorRequestRoutes = require('./routes/tutor-request.routes');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || '*' }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tutors', tutorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/payments', paymentRouter);
app.use('/api/notifications', notificationRoutes);
app.use('/api/verification-preview', verificationPreviewRoutes);
app.use('/api/tutor-shortlist', tutorShortlistRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/credits', creditRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tutor-requests', tutorRequestRoutes);
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use((_request, response) => response.status(404).json({ message: 'Route not found.' }));
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Something went wrong on the server.' });
});

module.exports = app;
