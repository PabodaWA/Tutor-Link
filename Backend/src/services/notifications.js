const Notification = require('../models/Notification');
const User = require('../models/User');

async function notify(recipient, payload) {
  if (!recipient) return null;
  return Notification.create({ ...payload, recipient });
}

async function notifyAdmins(payload) {
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  if (!admins.length) return [];
  return Notification.insertMany(admins.map((admin) => ({ recipient: admin._id, ...payload })));
}

module.exports = { notify, notifyAdmins };
