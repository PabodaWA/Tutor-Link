require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function run() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password || password.length < 8) throw new Error('Usage: npm run create-admin -- email password (minimum 8 characters)');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing in Backend/.env');
  await mongoose.connect(process.env.MONGODB_URI);
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { name: 'Platform Admin', email: email.toLowerCase(), password: hashedPassword, role: 'admin', status: 'active', isVerified: true, verificationStatus: 'verified', onboardingCompleted: true }, { upsert: true, returnDocument: 'after', runValidators: true });
  console.log(`Admin account ready: ${user.email}`);
  await mongoose.disconnect();
}

run().catch(async (error) => { console.error(`Admin setup failed: ${error.message}`); await mongoose.disconnect(); process.exitCode = 1; });
