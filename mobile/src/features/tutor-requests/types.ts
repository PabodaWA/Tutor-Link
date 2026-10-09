export type TutorRequestPerson = {
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

export type TutorRequest = {
  _id: string;
  student: TutorRequestPerson;
  tutor?: TutorRequestPerson;
  status: "pending" | "accepted" | "rejected";
  sessionStatus?: "not_started" | "live" | "completed";
  sessionStartedAt?: string;
  createdAt: string;
  updatedAt: string;
};
