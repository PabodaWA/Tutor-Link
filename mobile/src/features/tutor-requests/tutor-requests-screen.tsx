import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";
import { TutorRequest } from "./types";

type Filter = "pending" | "all";

export function TutorRequestsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [requests, setRequests] = useState<TutorRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ requests: TutorRequest[] }>("/tutor-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(data.requests);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tutor requests.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const visible = useMemo(
    () => filter === "pending" ? requests.filter((item) => item.status === "pending") : requests,
    [filter, requests],
  );
  const pendingCount = requests.filter((item) => item.status === "pending").length;

  async function respond(item: TutorRequest, action: "accept" | "reject") {
    if (!token || busyId) return;
    try {
      setBusyId(item._id);
      setError("");
      setMessage("");
      await apiRequest(`/tutor-requests/${item._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      setMessage(
        action === "accept"
          ? `${item.student.name}'s tutor request was accepted.`
          : `${item.student.name}'s tutor request was declined.`,
      );
      if (action === "accept") setFilter("all");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the tutor request.");
    } finally {
      setBusyId("");
    }
  }

  async function openSession(item: TutorRequest) {
    if (!token || busyId) return;
    try {
      setBusyId(item._id);
      setError("");
      if (!item.sessionStatus || item.sessionStatus === "not_started") {
        await apiRequest(`/tutor-requests/${item._id}/start-session`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      router.push({ pathname: "/direct-session/[requestId]", params: { requestId: item._id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the live session.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <FeatureShell
      activeTab="discover"
      showBack
      fallbackHref="/home"
      title="Tutor Requests"
      subtitle="Accept or decline students who want to connect with you as their tutor."
    >
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => setFilter("pending")} style={[styles.tab, filter === "pending" && styles.activeTab]}><Text style={[styles.tabText, filter === "pending" && styles.activeTabText]}>Pending ({pendingCount})</Text></Pressable>
        <Pressable onPress={() => setFilter("all")} style={[styles.tab, filter === "all" && styles.activeTab]}><Text style={[styles.tabText, filter === "all" && styles.activeTabText]}>All ({requests.length})</Text></Pressable>
      </View>

      {loading && <ActivityIndicator style={styles.loader} color="#655CF2" />}
      {!!error && <View style={styles.error}><Ionicons name="alert-circle" size={18} color="#B84963" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable></View>}
      {!!message && <View style={styles.success}><Ionicons name="checkmark-circle" size={18} color="#148A67" /><Text style={styles.successText}>{message}</Text></View>}

      {visible.map((item) => {
        const busy = busyId === item._id;
        return (
          <View key={item._id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.personRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(item.student.name)}</Text></View>
              <View style={styles.personCopy}>
                <Text style={[styles.name, { color: colors.text }]}>{item.student.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted }]}>{item.student.profile?.studyLevel || "Student"}{item.student.email ? ` • ${item.student.email}` : ""}</Text>
              </View>
              <View style={[styles.badge, item.status === "accepted" ? styles.acceptedBadge : item.status === "rejected" ? styles.rejectedBadge : styles.pendingBadge]}><Text style={[styles.badgeText, item.status === "accepted" ? styles.acceptedText : item.status === "rejected" ? styles.rejectedText : styles.pendingText]}>{item.status.toUpperCase()}</Text></View>
            </View>
            <View style={[styles.detail, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="person-add-outline" size={17} color="#655CF2" />
              <View style={styles.detailCopy}><Text style={[styles.detailTitle, { color: colors.text }]}>Wants to connect with you</Text><Text style={[styles.detailText, { color: colors.textMuted }]}>Sent {new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text></View>
            </View>
            {!!item.student.profile?.learningGoal && <Text style={[styles.goal, { color: colors.textMuted }]} numberOfLines={3}>“{item.student.profile.learningGoal}”</Text>}
            {item.status === "pending" && <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => void respond(item, "reject")} style={[styles.reject, busy && styles.disabled]}><Ionicons name="close" size={16} color="#B84963" /><Text style={styles.rejectText}>Reject</Text></Pressable>
              <Pressable disabled={busy} onPress={() => void respond(item, "accept")} style={[styles.accept, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="checkmark" size={16} color="#FFFFFF" /><Text style={styles.acceptText}>Accept</Text></>}</Pressable>
            </View>}
            {item.status === "accepted" && <Pressable disabled={busy} onPress={() => void openSession(item)} style={[styles.startSession, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name={item.sessionStatus === "completed" ? "document-text-outline" : "videocam"} size={16} color="#FFFFFF" /><Text style={styles.startSessionText}>{item.sessionStatus === "live" ? "Continue Live Session" : item.sessionStatus === "completed" ? "View Session & Notes" : "Start Live Session"}</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" /></>}</Pressable>}
          </View>
        );
      })}

      {!loading && !visible.length && <View style={[styles.empty, { backgroundColor: colors.surface }]}><Ionicons name="people-outline" size={30} color="#655CF2" /><Text style={[styles.emptyTitle, { color: colors.text }]}>No {filter === "pending" ? "pending " : ""}tutor requests</Text><Text style={[styles.emptyText, { color: colors.textMuted }]}>New student requests will appear here.</Text></View>}
    </FeatureShell>
  );
}

function initials(value: string) {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  tabs: { height: 48, borderRadius: 16, borderWidth: 1, padding: 4, flexDirection: "row", marginBottom: 13 },
  tab: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  activeTab: { backgroundColor: "#655CF2" },
  tabText: { color: "#858698", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  activeTabText: { color: "#FFFFFF" },
  loader: { marginVertical: 30 },
  error: { minHeight: 48, borderRadius: 14, backgroundColor: "#FFF0F3", padding: 11, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  errorText: { flex: 1, color: "#A9435A", fontFamily: "Inter_400Regular", fontSize: 10 },
  retry: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 10 },
  success: { minHeight: 48, borderRadius: 14, backgroundColor: "#E5F8F0", padding: 11, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 },
  successText: { flex: 1, color: "#176B54", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  card: { borderRadius: 20, borderWidth: 1, padding: 13, marginBottom: 12, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  personRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 45, height: 45, borderRadius: 15, backgroundColor: "#E7E3FF", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#5B51DF", fontFamily: "Manrope_800ExtraBold", fontSize: 12 },
  personCopy: { flex: 1, marginLeft: 10 },
  name: { fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 3 },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 },
  badgeText: { fontFamily: "Inter_700Bold", fontSize: 7 },
  pendingBadge: { backgroundColor: "#EEE9FF" }, pendingText: { color: "#655CF2" },
  acceptedBadge: { backgroundColor: "#E3F8EF" }, acceptedText: { color: "#158560" },
  rejectedBadge: { backgroundColor: "#FFF0F3" }, rejectedText: { color: "#B84963" },
  detail: { borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", marginTop: 11 },
  detailCopy: { flex: 1, marginLeft: 8 },
  detailTitle: { fontFamily: "Inter_700Bold", fontSize: 10 },
  detailText: { fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 3 },
  goal: { fontFamily: "Inter_400Regular", fontSize: 9.5, fontStyle: "italic", lineHeight: 14, marginTop: 10 },
  actions: { flexDirection: "row", gap: 8, marginTop: 11 },
  reject: { flex: 1, height: 42, borderRadius: 11, backgroundColor: "#FFF0F3", borderWidth: 1, borderColor: "#F6D6DE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  rejectText: { color: "#B84963", fontFamily: "Inter_700Bold", fontSize: 10 },
  accept: { flex: 1, height: 42, borderRadius: 11, backgroundColor: "#5D55F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  acceptText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  startSession: { height: 43, borderRadius: 11, backgroundColor: "#16A779", marginTop: 11, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  startSessionText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  disabled: { opacity: 0.55 },
  empty: { minHeight: 230, borderRadius: 20, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 15, marginTop: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 5 },
});
