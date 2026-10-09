const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const CreditTransaction = require('../models/CreditTransaction');
const User = require('../models/User');
const { allowRoles, requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, allowRoles('student'));

const packages = Object.freeze({ starter: 25, study: 50, semester: 100 });
const redeemCodes = Object.freeze({ TUTORLINK25: 25, STUDY50: 50 });
const legacyRedeemCodes = Object.freeze({ TUTORLY25: 'TUTORLINK25' });

router.get('/', async (request, response, next) => {
  try {
    const [user, transactions] = await Promise.all([
      User.findById(request.auth.sub).select('creditBalance').lean(),
      CreditTransaction.find({ user: request.auth.sub }).populate('booking', 'subject startsAt').sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    return response.json({
      balance: user?.creditBalance || 0,
      packages: Object.entries(packages).map(([id, credits]) => ({ id, credits })),
      transactions,
    });
  } catch (error) { return next(error); }
});

router.post('/buy', async (request, response, next) => {
  try {
    const parsed = z.object({ packageId: z.enum(['starter', 'study', 'semester']) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Choose a valid credit package.' });
    const credits = packages[parsed.data.packageId];
    const user = await User.findOneAndUpdate(
      { _id: request.auth.sub, role: 'student', status: 'active' },
      { $inc: { creditBalance: credits } },
      { returnDocument: 'after' },
    );
    if (!user) return response.status(404).json({ message: 'Student account not found.' });
    const transaction = await CreditTransaction.create({
      user: user._id,
      type: 'buy',
      amount: credits,
      balanceAfter: user.creditBalance,
      description: `Topped up ${credits} credits`,
      reference: `BUY:${Date.now()}:${crypto.randomBytes(3).toString('hex')}`,
    });
    return response.status(201).json({ balance: user.creditBalance, transaction, message: `${credits} credits added.` });
  } catch (error) { return next(error); }
});

router.post('/redeem', async (request, response, next) => {
  try {
    const parsed = z.object({ code: z.string().trim().min(3).max(40).transform((value) => value.toUpperCase()) }).safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ message: 'Enter a valid redeem code.' });
    const code = legacyRedeemCodes[parsed.data.code] || parsed.data.code;
    const credits = redeemCodes[code];
    if (!credits) return response.status(404).json({ message: 'Redeem code not found.' });
    const equivalentCodes = code === 'TUTORLINK25' ? ['TUTORLINK25', 'TUTORLY25'] : [code];
    const user = await User.findOneAndUpdate(
      { _id: request.auth.sub, role: 'student', status: 'active', redeemedCreditCodes: { $nin: equivalentCodes } },
      { $inc: { creditBalance: credits }, $addToSet: { redeemedCreditCodes: code } },
      { returnDocument: 'after' },
    );
    if (!user) return response.status(409).json({ message: 'This code was already redeemed.' });
    const transaction = await CreditTransaction.create({
      user: user._id,
      type: 'redeem',
      amount: credits,
      balanceAfter: user.creditBalance,
      description: `Redeemed ${credits} credits`,
      reference: `REDEEM:${code}`,
    });
    return response.status(201).json({ balance: user.creditBalance, transaction, message: `${credits} credits redeemed.` });
  } catch (error) { return next(error); }
});

module.exports = router;
