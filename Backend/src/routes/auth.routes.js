const bcrypt = require('bcryptjs');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const User = require('../models/User');

const router = express.Router();
const emailField = z.string().trim().email().max(160).transform((value) => value.toLowerCase());
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailField,
  password: z.string().min(8).max(72),
  role: z.enum(['student', 'tutor']),
});
const loginSchema = z.object({ email: emailField, password: z.string().min(1).max(72) });
const googleSchema = z.object({ idToken: z.string().trim().min(100).max(10000) });
const googleClient = new OAuth2Client();

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    onboardingCompleted: user.onboardingCompleted,
    isVerified: user.isVerified,
    verificationStatus: user.verificationStatus,
    verificationNote: user.verificationNote,
    verificationReviewedAt: user.verificationReviewedAt,
    status: user.status,
    profile: user.profile || {},
  };
}

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function invalidBody(response, error) {
  const message = error.issues?.[0]?.message || 'Invalid request data.';
  return response.status(400).json({ message });
}

function googleAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_WEB_CLIENT_ID || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

router.post('/register', async (request, response, next) => {
  try {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return invalidBody(response, parsed.error);
    const existingUser = await User.exists({ email: parsed.data.email });
    if (existingUser) return response.status(409).json({ message: 'An account with this email already exists.' });

    const password = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({
      ...parsed.data,
      password,
      ...(parsed.data.role === 'tutor' && { verificationStatus: 'pending', isVerified: false }),
    });
    return response.status(201).json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: 'An account with this email already exists.' });
    return next(error);
  }
});

router.post('/login', async (request, response, next) => {
  try {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return invalidBody(response, parsed.error);
    const user = await User.findOne({ email: parsed.data.email }).select('+password');
    const validPassword = user?.password ? await bcrypt.compare(parsed.data.password, user.password) : false;
    if (!user || !validPassword) return response.status(401).json({ message: 'Email or password is incorrect.' });
    if (user.status === 'suspended') return response.status(403).json({ message: 'This account has been suspended. Contact support.' });
    return response.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

router.post('/google', async (request, response, next) => {
  try {
    const parsed = googleSchema.safeParse(request.body);
    if (!parsed.success) return invalidBody(response, parsed.error);

    const audiences = googleAudiences();
    if (audiences.length === 0) return response.status(503).json({ message: 'Google sign-in is not configured on the server yet.' });

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: parsed.data.idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch {
      return response.status(401).json({ message: 'Google sign-in could not be verified. Please try again.' });
    }

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return response.status(401).json({ message: 'Google did not provide a verified email address.' });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ googleId: payload.sub }).select('+googleId');
    if (!user) {
      user = await User.findOne({ email }).select('+googleId');
      if (user?.googleId && user.googleId !== payload.sub) {
        return response.status(409).json({ message: 'This email is already linked to another Google account.' });
      }
    }

    if (user?.status === 'suspended') return response.status(403).json({ message: 'This account has been suspended. Contact support.' });

    if (user) {
      if (!user.googleId) user.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
      await user.save();
    } else {
      user = await User.create({
        name: (payload.name || email.split('@')[0]).slice(0, 80),
        email,
        googleId: payload.sub,
        avatarUrl: payload.picture,
        role: 'student',
      });
    }

    return response.json({ token: issueToken(user), user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return response.status(409).json({ message: 'This Google account is already linked.' });
    return next(error);
  }
});

module.exports = router;
