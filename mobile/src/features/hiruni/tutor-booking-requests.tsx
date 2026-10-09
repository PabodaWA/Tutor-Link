import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import {
  requestDateLabel,
  requestTimeLabel,
  TutorBookingRequest,
} from "@/features/hiruni/booking-request-types";
import { apiRequest } from "@/services/api";

type RequestFilter = "all" | "pending" | "accepted";

const filters: { key: RequestFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "accepted", label: "Accepted" },
];

export function TutorBookingRequestsScreen() {
  const { filter: requestedFilter } = useLocalSearchParams<{ filter?: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [bookings, setBookings] = useState<TutorBookingRequest[]>([]);
  const [filter, setFilter] = useState<RequestFilter>(() => isRequestFilter(requestedFilter) ? requestedFilter : "all");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ bookings: TutorBookingRequest[] }>("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(data.bookings);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load booking requests.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    if (isRequestFilter(requestedFilter)) setFilter(requestedFilter);
    void load();
  }, [load, requestedFilter]));

  const counts = useMemo(() => ({
    all: bookings.length,
    pending: bookings.filter((item) => ["pending", "reschedule_requested"].includes(item.status)).length,
    accepted: bookings.filter((item) => ["confirmed", "paid", "scheduled", "live", "completed"].includes(item.status)).length,
  }), [bookings]);

  const visible = useMemo(() => bookings.filter((item) => {
    if (filter === "pending") return ["pending", "reschedule_requested"].includes(item.status);
    if (filter === "accepted") return ["confirmed", "paid", "scheduled", "live", "completed"].includes(item.status);
    return true;
  }), [bookings, filter]);
 /**
 * Handles tutor responses to incoming booking requests.
 * Sends the selected accept or reject action to the booking API.
 * Displays feedback and refreshes the booking list after success.
 * Manages request errors and the loading state.
 */
  async function act(item: TutorBookingRequest, action: "confirm" | "reject") {
    if (!token || busyId) return;
    try {
      setBusyId(item._id);
      setError("");
      await apiRequest(`/bookings/${item._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      setNotice(
        action === "confirm"
          ? `${item.student.name}'s request was accepted. The learner has been notified.`
          : `${item.student.name}'s request was declined. The learner has been notified.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this request.");
    } finally {
      setBusyId("");
    }
  }

  function startLiveSession(item: TutorBookingRequest) {
    router.push({
      pathname: "/session/[id]",
      params: { id: item._id },
    });
  }

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: isDark ? colors.background : "#EFEDFF" }]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace("/home")} style={[styles.headerButton, { backgroundColor: colors.surface }]}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <View style={styles.headerCopy}><Text style={[styles.title, { color: colors.text }]}>Booking Requests</Text><Text style={[styles.subtitle, { color: colors.textMuted }]}>Manage incoming lesson requests</Text></View>
        <Pressable accessibilityLabel="Open teaching schedule" onPress={() => router.push("/bookings")} style={[styles.headerButton, { backgroundColor: colors.surface }]}><Ionicons name="options-outline" size={19} color="#655CF2" /></Pressable>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
        {filters.map((item) => {
          const active = filter === item.key;
          return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.tab, active && styles.tabActive]}><Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label} ({counts[item.key]})</Text></Pressable>;
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator style={{ marginVertical: 24 }} color="#655CF2" />}
        {!!error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color="#B84963" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable>
          </View>
        )}
        {!!notice && (
          <Pressable onPress={() => setNotice("")} style={styles.notice}>
            <Ionicons name="checkmark-circle" size={18} color="#148A67" />
            <Text style={styles.noticeText}>{notice}</Text>
            <Ionicons name="close" size={15} color="#148A67" />
          </Pressable>
        )}
        {filter === "pending" && !!counts.pending && (
          <View style={styles.prioritySummary}>
            <View style={styles.priorityIcon}><Ionicons name="flash" size={18} color="#139A72" /></View>
            <View style={styles.priorityCopy}><Text style={styles.priorityTitle}>{counts.pending} request{counts.pending === 1 ? "" : "s"} awaiting review</Text><Text style={styles.priorityText}>Respond quickly to keep learners updated.</Text></View>
            <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>
          </View>
        )}
        {visible.map((item, index) => (
          <RequestCard key={item._id} item={item} index={index} colors={colors} busy={busyId === item._id} onView={() => router.push({ pathname: "/booking/request/[id]", params: { id: item._id } })} onAccept={() => void act(item, "confirm")} onReject={() => void act(item, "reject")} onStart={() => startLiveSession(item)} />
        ))}
        {!loading && !visible.length && (
          <View style={[styles.empty, { backgroundColor: colors.surface }]}><View style={styles.emptyIcon}><Ionicons name="checkmark-done" size={25} color="#655CF2" /></View><Text style={[styles.emptyTitle, { color: colors.text }]}>No {filter === "all" ? "booking" : filter} requests</Text><Text style={[styles.emptyText, { color: colors.textMuted }]}>Requests in this category will appear here.</Text></View>
        )}
      </ScrollView>
      <AppBottomNav active="discover" />
    </SafeAreaView>
  );
}

function RequestCard({ item, index, colors, busy, onView, onAccept, onReject, onStart }: { item: TutorBookingRequest; index: number; colors: ReturnType<typeof useAppTheme>["colors"]; busy: boolean; onView: () => void; onAccept: () => void; onReject: () => void; onStart: () => void }) {
  const pending = ["pending", "reschedule_requested"].includes(item.status);
  const accepted = ["confirmed", "paid", "scheduled", "live", "completed"].includes(item.status);
  const accent = ["#655CF2", "#D68625", "#159A73"][index % 3];
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: `${accent}20` }]}><Text style={[styles.avatarText, { color: accent }]}>{initials(item.student.name)}</Text></View>
        <View style={styles.personCopy}><View style={styles.nameRow}><Text style={[styles.name, { color: colors.text }]}>{item.student.name}</Text>{item.student.isVerified && <Ionicons name="checkmark-circle" size={13} color="#159A73" />}</View><Text style={[styles.requestLabel, { color: colors.textMuted }]}>{item.student.profile?.studyLevel || "Student"} learner</Text></View>
        <View style={[styles.statusBadge, { backgroundColor: pending ? "#EEE9FF" : accepted ? "#E3F8EF" : "#FFF0F3" }]}><Text style={[styles.statusText, { color: pending ? "#655CF2" : accepted ? "#158560" : "#B84963" }]}>{item.status === "reschedule_requested" ? "RESCHEDULE" : pending ? "NEW" : item.status === "live" ? "LIVE" : item.status === "completed" ? "COMPLETED" : accepted ? "ACCEPTED" : "DECLINED"}</Text></View>
      </View>
      <View style={styles.chips}><View style={styles.subjectChip}><View style={styles.chipDot} /><Text style={styles.subjectChipText}>{item.subject}</Text></View><View style={styles.modeChip}><Ionicons name={item.sessionType === "in_person" ? "location-outline" : "videocam-outline"} size={10} color="#55708B" /><Text style={styles.modeChipText}>{item.sessionType === "in_person" ? "In-person" : "Online"}</Text></View></View>
      <View style={[styles.details, { backgroundColor: colors.surfaceMuted }]}>
        <View style={styles.detail}><Ionicons name="calendar-outline" size={13} color="#655CF2" /><Text style={[styles.detailText, { color: colors.text }]}>{requestDateLabel(item.startsAt)}</Text></View>
        <View style={styles.detail}><Ionicons name="time-outline" size={13} color="#655CF2" /><Text style={[styles.detailText, { color: colors.text }]}>{requestTimeLabel(item.startsAt)}</Text></View>
        <View style={styles.detail}><Ionicons name="hourglass-outline" size={13} color="#655CF2" /><Text style={[styles.detailText, { color: colors.text }]}>{item.durationMinutes} min</Text></View>
      </View>
      <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="chatbox-ellipses-outline" size={14} color="#655CF2" /><Text style={[styles.noteText, { color: colors.textMuted }]} numberOfLines={2}>{item.notes ? `“${item.notes}”` : "No additional note from the learner."}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.student.name} request details`} onPress={onView} style={styles.detailsButton}><Text style={styles.detailsButtonText}>View Request Details</Text><Ionicons name="arrow-forward" size={14} color="#655CF2" /></Pressable>
      {pending ? <View style={styles.actions}><Pressable disabled={busy} onPress={onReject} style={[styles.decline, { backgroundColor: colors.surfaceMuted }, busy && styles.disabled]}><Ionicons name="close" size={14} color={colors.textMuted} /><Text style={[styles.declineText, { color: colors.textMuted }]}>Decline</Text></Pressable><Pressable disabled={busy} onPress={onAccept} style={[styles.accept, busy && styles.disabled]}>{busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="checkmark" size={14} color="#FFFFFF" /><Text style={styles.acceptText}>Accept</Text></>}</Pressable></View> : null}
      {["confirmed", "paid", "scheduled", "live"].includes(item.status) && <Pressable onPress={onStart} style={styles.startLive}><Ionicons name="videocam" size={15} color="#FFFFFF" /><Text style={styles.startLiveText}>{item.status === "live" ? "Continue Live Session" : "Open Session"}</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></Pressable>}
    </View>
  );
}

function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }

function isRequestFilter(value?: string): value is RequestFilter {
  return value === "all" || value === "pending" || value === "accepted";
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, flexDirection: "row", alignItems: "center" },
  headerButton: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, marginLeft: 10 }, title: { fontFamily: "Manrope_800ExtraBold", fontSize: 22 }, subtitle: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 2 },
  tabs: { width: "100%", maxWidth: 584, alignSelf: "center", minHeight: 46, borderRadius: 16, padding: 4, flexDirection: "row", shadowColor: "#312A65", shadowOpacity: 0.06, shadowRadius: 9, elevation: 2 }, tab: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center" }, tabActive: { backgroundColor: "#655CF2" }, tabText: { color: "#8A8B9B", fontFamily: "Inter_600SemiBold", fontSize: 9 }, tabTextActive: { color: "#FFFFFF" },
  scroll: { flex: 1 }, content: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 18, paddingTop: 13, paddingBottom: 24 },
  notice: { minHeight: 48, borderRadius: 14, paddingHorizontal: 11, backgroundColor: "#E5F8F0", borderWidth: 1, borderColor: "#C6EDDE", flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 11 }, noticeText: { flex: 1, color: "#176B54", fontFamily: "Inter_600SemiBold", fontSize: 9, lineHeight: 13 },
  prioritySummary: { minHeight: 66, borderRadius: 17, padding: 11, backgroundColor: "#EAFBF5", borderWidth: 1, borderColor: "#C8F0E1", flexDirection: "row", alignItems: "center", marginBottom: 11 }, priorityIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#72E8BD", alignItems: "center", justifyContent: "center" }, priorityCopy: { flex: 1, marginLeft: 10 }, priorityTitle: { color: "#173C32", fontFamily: "Inter_700Bold", fontSize: 11 }, priorityText: { color: "#568276", fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 3 }, activeBadge: { borderRadius: 8, backgroundColor: "#CFF5E7", paddingHorizontal: 7, paddingVertical: 5 }, activeBadgeText: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 7 },
  card: { borderRadius: 20, borderWidth: 1, padding: 13, marginBottom: 12, shadowColor: "#302B59", shadowOpacity: 0.07, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 }, cardTop: { flexDirection: "row", alignItems: "center" }, avatar: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" }, avatarText: { fontFamily: "Manrope_800ExtraBold", fontSize: 12 }, personCopy: { flex: 1, marginLeft: 10 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 4 }, name: { fontFamily: "Manrope_800ExtraBold", fontSize: 12 }, requestLabel: { fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 2 }, statusBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5 }, statusText: { fontFamily: "Inter_700Bold", fontSize: 7 },
  chips: { flexDirection: "row", gap: 6, marginTop: 11 }, subjectChip: { flex: 1, borderRadius: 9, backgroundColor: "#EEE9FF", paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 }, chipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#655CF2" }, subjectChipText: { flexShrink: 1, color: "#554CD0", fontFamily: "Inter_600SemiBold", fontSize: 8 }, modeChip: { borderRadius: 9, backgroundColor: "#EDF3F7", paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 }, modeChipText: { color: "#55708B", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  details: { minHeight: 42, borderRadius: 12, marginTop: 9, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, detail: { flexDirection: "row", alignItems: "center", gap: 4 }, detailText: { fontFamily: "Inter_600SemiBold", fontSize: 8 }, note: { borderRadius: 12, padding: 10, marginTop: 8, flexDirection: "row", alignItems: "flex-start", gap: 7 }, noteText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 9, fontStyle: "italic", lineHeight: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 }, decline: { flex: 1, height: 42, borderRadius: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, declineText: { fontFamily: "Inter_700Bold", fontSize: 10 }, accept: { flex: 1, height: 42, borderRadius: 11, backgroundColor: "#5D55F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }, acceptText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 }, disabled: { opacity: 0.55 },
  startLive: { height: 43, borderRadius: 11, backgroundColor: "#16A779", marginTop: 10, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, shadowColor: "#16A779", shadowOpacity: 0.22, shadowRadius: 8, elevation: 3 }, startLiveText: { flex: 1, color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10, textAlign: "center" },
  detailsButton: { height: 41, borderRadius: 11, backgroundColor: "#EFEDFF", marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, detailsButtonText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 10 },
  error: { minHeight: 45, borderRadius: 13, backgroundColor: "#FFF0F3", paddingHorizontal: 11, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 7 }, errorText: { flex: 1, color: "#A9435A", fontFamily: "Inter_400Regular", fontSize: 9 }, retry: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 9 }, empty: { minHeight: 260, borderRadius: 21, alignItems: "center", justifyContent: "center", padding: 24 }, emptyIcon: { width: 55, height: 55, borderRadius: 18, backgroundColor: "#E8E4FF", alignItems: "center", justifyContent: "center" }, emptyTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 15, marginTop: 12 }, emptyText: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 5, textAlign: "center" },
});
