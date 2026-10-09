const express = require('express');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { filePath } = require('../services/verification-files');

const router = express.Router();

router.get('/:token', async (request, response, next) => {
  try {
    const payload = jwt.verify(request.params.token, process.env.JWT_SECRET);
    if (payload.purpose !== 'verification-preview') return response.status(403).end();
    const [admin, tutor] = await Promise.all([
      User.findById(payload.adminId).select('role status'),
      User.findById(payload.tutorId).select('role profile.verificationFiles'),
    ]);
    if (admin?.role !== 'admin' || admin.status !== 'active' || tutor?.role !== 'tutor') return response.status(403).end();
    const file = tutor.profile?.verificationFiles?.find((item) => item.id === payload.fileId);
    const location = filePath(payload.fileId);
    if (!file || !location) return response.status(404).end();
    await fs.promises.access(location, fs.constants.R_OK);
    response.set({ 'Content-Type': file.mimeType, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
    fs.createReadStream(location).on('error', next).pipe(response);
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') return response.status(403).end();
    if (error?.code === 'ENOENT') return response.status(404).end();
    return next(error);
  }
});

module.exports = router;
