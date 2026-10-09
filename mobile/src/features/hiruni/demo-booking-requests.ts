export type DemoStudent = {
  _id: string;
  name: string;
  email: string;
  isVerified: boolean;
  profile: {
    studyLevel: string;
    learningGoal: string;
    interests: string[];
  };
};

export type DemoSessionNote = {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type DemoBookingRequest = {
  _id: string;
  student: DemoStudent;
  subject: string;
  topic: string;
  notes: string;
  sessionNotes?: DemoSessionNote[];
  sessionType: "online" | "in_person";
  dateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  durationMinutes: number;
  status: "pending" | "confirmed" | "live" | "completed" | "declined";
  price: number;
  receivedLabel: string;
};

const initialRequests: DemoBookingRequest[] = [
  {
    _id: "demo-dilini-fernando",
    student: {
      _id: "demo-student-dilini",
      name: "Dilini Fernando",
      email: "dilini.fernando@student.lk",
      isVerified: true,
      profile: {
        studyLevel: "Grade 11",
        learningGoal:
          "I want to understand quadratic equations clearly and improve my confidence before the term test.",
        interests: ["Algebra", "Exam revision", "Problem solving"],
      },
    },
    subject: "Mathematics",
    topic: "Quadratic Equations",
    notes:
      "I need help with factorising quadratic equations and solving a few past-paper questions.",
    sessionNotes: [
      { id: "demo-note-dilini-1", text: "Review the quadratic formula and identify a, b, and c.", createdAt: "10:31 AM", updatedAt: "10:31 AM" },
      { id: "demo-note-dilini-2", text: "Practise factorising when the leading coefficient is greater than one.", createdAt: "10:33 AM", updatedAt: "10:33 AM" },
      { id: "demo-note-dilini-3", text: "Complete past-paper questions 3-7 before the next lesson.", createdAt: "10:35 AM", updatedAt: "10:35 AM" },
    ],
    sessionType: "online",
    dateLabel: "Tomorrow",
    fullDateLabel: "Tomorrow, 07 Oct 2026",
    timeLabel: "4:00 PM",
    durationMinutes: 60,
    status: "pending",
    price: 2500,
    receivedLabel: "12m ago",
  },
  {
    _id: "demo-nethmi-silva",
    student: {
      _id: "demo-student-nethmi",
      name: "Nethmi Silva",
      email: "nethmi.silva@student.lk",
      isVerified: true,
      profile: {
        studyLevel: "Grade 12",
        learningGoal:
          "I am preparing for my A/L examination and want to strengthen the fundamentals of mechanics.",
        interests: ["Mechanics", "A/L revision", "Calculations"],
      },
    },
    subject: "Physics",
    topic: "Mechanics",
    notes:
      "Could we focus on forces, motion graphs, and structured essay questions?",
    sessionNotes: [
      { id: "demo-note-nethmi-1", text: "Draw a free-body diagram before resolving each force.", createdAt: "10:31 AM", updatedAt: "10:31 AM" },
      { id: "demo-note-nethmi-2", text: "Remember: the gradient of a velocity-time graph gives acceleration.", createdAt: "10:33 AM", updatedAt: "10:33 AM" },
      { id: "demo-note-nethmi-3", text: "Finish the two structured mechanics questions for homework.", createdAt: "10:35 AM", updatedAt: "10:35 AM" },
    ],
    sessionType: "online",
    dateLabel: "Thursday",
    fullDateLabel: "Thursday, 08 Oct 2026",
    timeLabel: "6:00 PM",
    durationMinutes: 90,
    status: "pending",
    price: 3600,
    receivedLabel: "35m ago",
  },
  {
    _id: "demo-kavindu-jayasena",
    student: {
      _id: "demo-student-kavindu",
      name: "Kavindu Jayasena",
      email: "kavindu.j@student.lk",
      isVerified: true,
      profile: {
        studyLevel: "University",
        learningGoal:
          "I want to design a normalized database schema for my first-year software project.",
        interests: ["SQL", "ER diagrams", "Database design"],
      },
    },
    subject: "Information Technology",
    topic: "Database Design",
    notes:
      "Please review my ER diagram and explain normalization up to third normal form.",
    sessionNotes: [
      { id: "demo-note-kavindu-1", text: "Split repeating customer details into a separate table.", createdAt: "10:31 AM", updatedAt: "10:31 AM" },
      { id: "demo-note-kavindu-2", text: "Add primary and foreign keys before checking normalization.", createdAt: "10:33 AM", updatedAt: "10:33 AM" },
      { id: "demo-note-kavindu-3", text: "Update the ER diagram and review third normal form next time.", createdAt: "10:35 AM", updatedAt: "10:35 AM" },
    ],
    sessionType: "in_person",
    dateLabel: "Friday",
    fullDateLabel: "Friday, 09 Oct 2026",
    timeLabel: "2:00 PM",
    durationMinutes: 60,
    status: "pending",
    price: 3000,
    receivedLabel: "1h ago",
  },
];

let demoRequests = initialRequests.map(cloneRequest);

function cloneRequest(request: DemoBookingRequest): DemoBookingRequest {
  return {
    ...request,
    student: {
      ...request.student,
      profile: {
        ...request.student.profile,
        interests: [...request.student.profile.interests],
      },
    },
    sessionNotes: request.sessionNotes?.map((note) => ({ ...note })),
  };
}

export function getDemoBookingRequests() {
  return demoRequests.map(cloneRequest);
}

export function getDemoBookingRequest(id?: string) {
  const request = demoRequests.find((item) => item._id === id);
  return request ? cloneRequest(request) : null;
}

export function updateDemoBookingRequest(
  id: string,
  status: DemoBookingRequest["status"],
) {
  demoRequests = demoRequests.map((item) =>
    item._id === id ? { ...item, status } : item,
  );
  return getDemoBookingRequest(id);
}

export function createDemoSessionNote(requestId: string, text: string) {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const note: DemoSessionNote = {
    id: `demo-note-${Date.now()}`,
    text: text.trim(),
    createdAt: now,
    updatedAt: now,
  };
  demoRequests = demoRequests.map((item) => item._id === requestId
    ? { ...item, sessionNotes: [...(item.sessionNotes || []), note] }
    : item);
  return { ...note };
}

export function updateDemoSessionNote(requestId: string, noteId: string, text: string) {
  const updatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  let updated: DemoSessionNote | null = null;
  demoRequests = demoRequests.map((item) => item._id === requestId
    ? {
        ...item,
        sessionNotes: (item.sessionNotes || []).map((note) => {
          if (note.id !== noteId) return note;
          updated = { ...note, text: text.trim(), updatedAt };
          return updated;
        }),
      }
    : item);
  return updated;
}

export function deleteDemoSessionNote(requestId: string, noteId: string) {
  demoRequests = demoRequests.map((item) => item._id === requestId
    ? { ...item, sessionNotes: (item.sessionNotes || []).filter((note) => note.id !== noteId) }
    : item);
}
