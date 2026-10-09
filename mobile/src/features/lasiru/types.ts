export type Tutor = {
  _id: string;
  name: string;
  isVerified: boolean;
  averageRating: number;
  reviewCount: number;
  ratingBreakdown?: { rating: number; count: number }[];
  completedSessions?: number;
  studentsTaught?: number;
  verificationReviewedAt?: string;
  nextAvailableAt?: string;
  matchScore?: number;
  matchReasons?: string[];
  profile?: { bio?: string; subjects?: string[]; hourlyRate?: number; experience?: string; qualifications?: string[] };
};
