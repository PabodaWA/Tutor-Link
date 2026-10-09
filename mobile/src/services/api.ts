import { Platform } from "react-native";
import type { DocumentPickerAsset } from "expo-document-picker";

const fallbackUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:5000/api"
    : "http://localhost:5000/api";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? fallbackUrl;

export type UserProfile = {
  bio?: string;
  interests?: string[];
  studyLevel?: string;
  learningGoal?: string;
  preferredSubject?: string;
  currentProficiency?: "Beginner" | "Intermediate" | "Advanced";
  learningStyles?: string[];
  tutorMatchGoal?: string;
  subjects?: string[];
  experience?: string;
  hourlyRate?: number;
  qualifications?: string[];
  verificationDocuments?: string[];
  verificationFiles?: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
  }[];
};
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: "student" | "tutor" | "admin";
  onboardingCompleted: boolean;
  isVerified?: boolean;
  verificationStatus?: "not_requested" | "pending" | "verified" | "rejected";
  verificationNote?: string;
  verificationReviewedAt?: string;
  status?: "active" | "suspended";
  profile?: UserProfile;
};
export type AuthResponse = { token: string; user: AuthUser };
export type OnboardingPayload =
  | {
      role: "student";
      interests: string[];
      studyLevel: string;
      learningGoal: string;
    }
  | {
      role: "tutor";
      subjects: string[];
      experience: string;
      hourlyRate: number;
    };

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Check your API URL and connection.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message ?? "Something went wrong. Please try again.");
  return data as T;
}

export function apiUrl(path: string) {
  return `${API_URL}${path.replace(/^\/api/, "")}`;
}

export function apiOrigin() {
  return API_URL.replace(/\/api\/?$/, "");
}

export async function uploadVerification(
  qualifications: string[],
  documents: DocumentPickerAsset[],
  token: string,
): Promise<{ user: AuthUser; message: string }> {
  const form = new FormData();
  form.append("qualifications", JSON.stringify(qualifications));
  for (const document of documents) {
    if (Platform.OS === "web") {
      if (!document.file)
        throw new Error(
          `Please select ${document.name} again before submitting.`,
        );
      form.append("documents", document.file, document.name);
    } else {
      form.append("documents", {
        uri: document.uri,
        name: document.name,
        type: document.mimeType || "application/octet-stream",
      } as unknown as Blob);
    }
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}/users/verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error(
      "Cannot reach the server. Check your API URL and connection.",
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message ?? "Could not upload verification documents.");
  return data as { user: AuthUser; message: string };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  google: (idToken: string) =>
    apiRequest<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),
  register: (payload: {
    name: string;
    email: string;
    password: string;
    role: "student" | "tutor";
  }) =>
    apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  completeOnboarding: (payload: OnboardingPayload, token: string) =>
    apiRequest<{ user: AuthUser }>("/users/onboarding", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
  me: (token: string) =>
    apiRequest<{ user: AuthUser }>("/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  profile: (token: string) =>
    apiRequest<{ user: AuthUser }>("/users/profile", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  updateProfile: (payload: Record<string, unknown>, token: string) =>
    apiRequest<{ user: AuthUser }>("/users/profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
  requestVerification: (
    payload: { qualifications: string[]; documents: DocumentPickerAsset[] },
    token: string,
  ) => uploadVerification(payload.qualifications, payload.documents, token),
};
