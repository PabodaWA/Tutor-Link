export type BookingStudent = {
  _id: string;
  name: string;
  email?: string;
  isVerified?: boolean;
  profile?: {
    studyLevel?: string;
    learningGoal?: string;
    interests?: string[];
  };
};

export type TutorBookingRequest = {
  _id: string;
  student: BookingStudent;
  subject: string;
  notes?: string;
  sessionType?: "online" | "in_person";
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  createdAt?: string;
};

export function requestDateLabel(startsAt: string) {
  return new Date(startsAt).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function requestFullDateLabel(startsAt: string) {
  return new Date(startsAt).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function requestTimeLabel(startsAt: string) {
  return new Date(startsAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
/**
 * Formats the received time of a booking request
 * into a readable relative time label.
 *
 * Examples: "just now", "30m ago", "2h ago", "3d ago".
 * Returns "recently" when the timestamp is unavailable.
 */
export function requestReceivedLabel(createdAt?: string) {
  if (!createdAt) return "recently";
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000),
  );
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ago`;
}
