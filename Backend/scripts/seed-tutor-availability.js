require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../src/models/User');
const { connectDatabase } = require('../src/config/database');
const { ensureDefaultAvailabilityForTutor } = require('../src/services/default-availability');

async function seedTutorAvailability() {
  await connectDatabase();
  const tutors = await User.find({
    role: 'tutor',
    status: 'active',
    isVerified: true,
  }).select('name').lean();

  let createdTotal = 0;
  for (const tutor of tutors) {
    const result = await ensureDefaultAvailabilityForTutor(tutor._id);
    createdTotal += result.createdCount;
    console.log(`${tutor.name}: ${result.openCount} open slots (${result.createdCount} added)`);
  }
  console.log(`Availability ready for ${tutors.length} verified tutors. ${createdTotal} slots added.`);
}

seedTutorAvailability()
  .catch((error) => {
    console.error(`Could not seed tutor availability: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
