import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { LiveTeachingSession, SharedSessionNote } from "@/features/medhani/live-teaching-session";
import { apiRequest } from "@/services/api";

type DirectSessionRequest = {
  _id: string;
  student: { _id: string; name: string };
  tutor: { _id: string; name: string };
  status: "accepted";
  sessionStatus: "not_started" | "live" | "completed";
  sessionStartedAt?: string;
  sharedNotes?: SharedSessionNote[];
};

export function DirectSessionScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const [request, setRequest] = useState<DirectSessionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !requestId) return;
    try {
      const data = await apiRequest<{ tutorRequest: DirectSessionRequest }>(
        `/tutor-requests/${requestId}/session`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRequest(data.tutorRequest);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the live session.");
    } finally {
      setLoading(false);
    }
  }, [requestId, token]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function complete() {
    if (!token || !requestId) return;
    try {
      setBusy(true);
      setError("");
      await apiRequest(`/tutor-requests/${requestId}/complete-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete this session.");
    } finally {
      setBusy(false);
    }
  }

  async function createNote(text: string) {
    if (!token || !requestId) throw new Error("Session information is missing.");
    const result = await apiRequest<{ note: SharedSessionNote }>(`/tutor-requests/${requestId}/shared-notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    return result.note;
  }

  async function updateNote(noteId: string, text: string) {
    if (!token || !requestId) throw new Error("Session information is missing.");
    const result = await apiRequest<{ note: SharedSessionNote }>(`/tutor-requests/${requestId}/shared-notes/${noteId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    return result.note;
  }

  async function deleteNote(noteId: string) {
    if (!token || !requestId) throw new Error("Session information is missing.");
    await apiRequest(`/tutor-requests/${requestId}/shared-notes/${noteId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  if (!loading && request && ["live", "completed"].includes(request.sessionStatus)) {
    return (
      <LiveTeachingSession
        booking={{
          student: request.student,
          tutor: request.tutor,
          subject: "Direct tutoring session",
          startsAt: request.sessionStartedAt || new Date().toISOString(),
          durationMinutes: 60,
        }}
        bookingId={request._id}
        conversationType="tutor-request"
        authToken={token}
        currentUserId={user?.id}
        tutorRole={user?.role === "tutor"}
        initialNotes={request.sharedNotes || []}
        busy={busy}
        canComplete={request.sessionStatus === "live"}
        onJoinMeeting={() => router.push({ pathname: "/meeting/tutor-request/[requestId]", params: { requestId: request._id } })}
        onComplete={() => void complete()}
        onCreateNote={createNote}
        onUpdateNote={updateNote}
        onDeleteNote={deleteNote}
      />
    );
  }

  return (
    <FeatureShell activeTab="discover" showBack fallbackHref="/tutor-requests" title="Direct Session" subtitle="Private live classroom for an accepted tutor request.">
      {loading && <ActivityIndicator style={styles.loader} size="large" color="#655CF2" />}
      {!!error && <View style={styles.error}><Ionicons name="alert-circle" size={22} color="#B84963" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable></View>}
      {!loading && request?.sessionStatus === "not_started" && <View style={[styles.waiting, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="time-outline" size={31} color="#655CF2" /><Text style={[styles.waitingTitle, { color: colors.text }]}>Waiting for the tutor</Text><Text style={[styles.waitingText, { color: colors.textMuted }]}>The chat, Jitsi meeting and shared notes become available when the tutor starts this session.</Text></View>}
    </FeatureShell>
  );
}

const styles = StyleSheet.create({
  loader: { marginVertical: 50 },
  error: { borderRadius: 18, backgroundColor: "#FFF0F3", padding: 16, alignItems: "center" },
  errorText: { color: "#A9435A", fontFamily: "Inter_400Regular", fontSize: 11, textAlign: "center", marginTop: 8 },
  retry: { minHeight: 38, paddingHorizontal: 18, borderRadius: 11, backgroundColor: "#655CF2", justifyContent: "center", marginTop: 13 },
  retryText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  waiting: { minHeight: 240, borderRadius: 21, borderWidth: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  waitingTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 17, marginTop: 12 },
  waitingText: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 7 },
});
