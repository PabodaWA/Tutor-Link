const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return response.status(401).json({ message: 'Authentication is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('name email role status isVerified verificationStatus verificationNote verificationReviewedAt onboardingCompleted profile');
    if (!user) return response.status(401).json({ message: 'This account no longer exists.' });
    if (user.status === 'suspended') return response.status(403).json({ message: 'This account has been suspended. Contact support.' });
    request.auth = { sub: user._id.toString(), role: user.role };
    request.user = user;
    return next();
  } catch (error) {
    if (error?.name !== 'JsonWebTokenError' && error?.name !== 'TokenExpiredError') return next(error);
    return response.status(401).json({ message: 'Your session has expired. Please sign in again.' });
  }
}

module.exports = { requireAuth };

function allowRoles(...roles) {
  return (request, response, next) => roles.includes(request.auth?.role)
    ? next()
    : response.status(403).json({ message: 'You do not have permission for this action.' });
}

module.exports = { requireAuth, allowRoles };
