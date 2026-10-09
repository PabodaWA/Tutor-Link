const Availability = require('../models/Availability');

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_START_TIMES = [
  { hour: 16, minute: 30 },
  { hour: 17, minute: 30 },
  { hour: 18, minute: 30 },
];
const DEFAULT_BOOKABLE_DAYS = 7;

function overlaps(first, second) {
  return first.startsAt < second.endsAt && first.endsAt > second.startsAt;
}

function futureSlot(daysAhead, hour, minute) {
  const startsAt = new Date();
  startsAt.setHours(hour, minute, 0, 0);
  startsAt.setDate(startsAt.getDate() + daysAhead);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000),
  };
}

async function ensureDefaultAvailabilityForTutor(tutorId, bookableDays = DEFAULT_BOOKABLE_DAYS) {
  const now = new Date();
  const existing = await Availability.find({
    tutor: tutorId,
    startsAt: { $gt: now },
  }).select('startsAt endsAt isBooked').sort({ startsAt: 1 }).lean();
  const candidates = [];
  let daysAdded = 0;
  for (let day = 1; day <= 30 && daysAdded < bookableDays; day += 1) {
    const probe = new Date();
    probe.setDate(probe.getDate() + day);
    if (probe.getDay() === 0) continue;
    daysAdded += 1;
    for (const time of DEFAULT_START_TIMES) {
      const candidate = futureSlot(day, time.hour, time.minute);
      const occupied = [...existing, ...candidates].some((slot) => overlaps(candidate, slot));
      if (!occupied) candidates.push(candidate);
    }
  }

  const openCount = existing.filter((slot) => !slot.isBooked).length;
  if (!candidates.length) return { createdCount: 0, openCount };
  const created = await Availability.insertMany(
    candidates.map((slot) => ({ tutor: tutorId, ...slot })),
  );
  return { createdCount: created.length, openCount: openCount + created.length };
}

module.exports = { ensureDefaultAvailabilityForTutor };
