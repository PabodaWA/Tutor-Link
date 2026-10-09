import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type Booking = {
  _id: string;
  tutor: { _id: string; name: string };
  subject: string;
  sessionType?: "online" | "in_person";
  startsAt: string;
  durationMinutes: number;
};

const reasons = ["Schedule conflict", "Exam rescheduled", "Other"] as const;
const purple = "#5D58F7";
const lavender = "#EFEDFF";

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CancelBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [reason, setReason] = useState<(typeof reasons)[number]>(reasons[0]);
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const load = useCallback(async () => {
    if (!token || !bookingId) {
      setError("Booking information is missing.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await apiRequest<{ bookings: Booking[] }>("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const current = data.bookings.find((item) => item._id === bookingId);
      if (!current) throw new Error("Booking could not be found.");
      setBooking(current);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load this booking.",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  useEffect(() => {
    const request = setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => clearTimeout(request);
  }, []);

  function keepBooking() {
    if (router.canGoBack()) router.back();
    else router.replace("/booking/my-bookings");
  }
  /**
 * Handles booking cancellation by validating the selected reason,
 * checking cancellation restrictions, and submitting the request
 * to the booking API.
 */
  async function cancelBooking() {
    if (!token || !bookingId) return;
    if (cancellationBlockMessage) {
      setError(cancellationBlockMessage);
      return;
    }
    const selectedReason = reason === "Other" ? customReason.trim() : reason;
    if (!selectedReason) {
      setError("Enter a reason for cancellation.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiRequest(`/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "cancel", reason: selectedReason }),
      });
      router.replace("/booking/my-bookings");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not cancel this booking.",
      );
    } finally {
      setBusy(false);
    }
  }

  const endsAt = booking
    ? new Date(
        new Date(booking.startsAt).getTime() + booking.durationMinutes * 60 * 1000,
      )
    : null;
  const millisecondsUntilStart = booking
    ? new Date(booking.startsAt).getTime() - currentTime
    : null;
  const cancellationBlockMessage =
    currentTime > 0 && millisecondsUntilStart !== null && millisecondsUntilStart <= 0
      ? "This session has already started and can no longer be cancelled."
      : currentTime > 0 && millisecondsUntilStart !== null &&
          millisecondsUntilStart < 2 * 60 * 60 * 1000
        ? "Bookings cannot be cancelled within 2 hours of the session."
        : "";
  const displayedError = error || cancellationBlockMessage;
  const cancellationDisabled =
    busy ||
    Boolean(cancellationBlockMessage) ||
    (reason === "Other" && !customReason.trim());

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? colors.background : lavender },
      ]}
      edges={["top"]}
    >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={keepBooking}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Cancel Booking</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningIcon}>
          <Ionicons name="alert-circle-outline" size={31} color="#ED9419" />
        </View>
        <Text style={[styles.question, { color: colors.text }]}>Are you sure you want to cancel this session?</Text>
        <Text style={[styles.warningCopy, { color: colors.textMuted }]}>This action cannot be undone.</Text>

        {loading && <ActivityIndicator style={styles.loader} color={purple} />}

        {!!displayedError && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#BD4E64" />
            <Text style={styles.errorText}>{displayedError}</Text>
            {!!error && !booking && (
              <Pressable onPress={() => void load()}>
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        {booking && endsAt && (
          <>
            <View style={[styles.summary, { backgroundColor: colors.surface }]}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.subjectLabel}>SUBJECT</Text>
                  <Text style={[styles.subject, { color: colors.text }]}>{booking.subject}</Text>
                </View>
                <View style={styles.modeBadge}>
                  <View style={styles.modeDot} />
                  <Text style={styles.modeText}>{booking.sessionType === "in_person" ? "In-person" : "Online"}</Text>
                </View>
              </View>
              <InfoRow label="Tutor" value={booking.tutor.name} />
              <InfoRow label="Date" value={new Date(booking.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
              <InfoRow label="Time" value={`${formatTime(booking.startsAt)} – ${formatTime(endsAt)}`} />
              <InfoRow label="Duration" value={`${booking.durationMinutes} mins`} />
            </View>

            <Text style={[styles.reasonTitle, { color: colors.textMuted }]}>Reason for cancellation (optional)</Text>
            <View style={styles.reasonList}>
              {reasons.map((item) => {
                const active = reason === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setReason(item)}
                    style={[
                      styles.reason,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      active && styles.reasonActive,
                    ]}
                  >
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioCenter} />}
                    </View>
                    <Text style={[styles.reasonText, { color: colors.text }]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>

            {reason === "Other" && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                maxLength={240}
                multiline
                placeholder="Tell us why you need to cancel..."
                placeholderTextColor="#9B9EAF"
                style={[
                  styles.customReason,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
              />
            )}

            <Pressable
              disabled={cancellationDisabled}
              onPress={() => void cancelBooking()}
              style={[
                styles.cancelButton,
                cancellationDisabled && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.cancelText}>Yes, Cancel</Text>
              )}
            </Pressable>
            <Pressable disabled={busy} onPress={keepBooking} style={[styles.keepButton, { backgroundColor: colors.surface }]}>
              <Text style={[styles.keepText, { color: colors.text }]}>Keep Booking</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <AppBottomNav active="bookings" />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { width: "100%", maxWidth: 560, minHeight: 60, alignSelf: "center", paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: "Manrope_800ExtraBold", fontSize: 17 },
  headerSpace: { width: 38 },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20, paddingTop: 19, paddingBottom: 20 },
  warningIcon: { width: 54, height: 54, alignSelf: "center", borderRadius: 15, backgroundColor: "#FFF7DF", borderWidth: 1, borderColor: "#FFD58A", alignItems: "center", justifyContent: "center" },
  question: { maxWidth: 300, alignSelf: "center", textAlign: "center", fontFamily: "Manrope_800ExtraBold", fontSize: 17, lineHeight: 22, marginTop: 16 },
  warningCopy: { textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 6, marginBottom: 17 },
  loader: { marginVertical: 30 },
  errorCard: { backgroundColor: "#FFF0F3", borderRadius: 13, padding: 11, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  errorText: { flex: 1, color: "#A84259", fontFamily: "Inter_500Medium", fontSize: 10 },
  retry: { color: purple, fontFamily: "Inter_700Bold", fontSize: 10 },
  summary: { borderRadius: 17, padding: 15, marginBottom: 17, shadowColor: "#342E62", shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 },
  summaryTop: { minHeight: 48, paddingBottom: 9, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: "#EFEDF7", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  subjectLabel: { color: "#8B8FA5", fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.6 },
  subject: { fontFamily: "Manrope_800ExtraBold", fontSize: 12, marginTop: 4 },
  modeBadge: { backgroundColor: "#E8FAF3", borderWidth: 1, borderColor: "#B9F0DA", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 5 },
  modeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1DC98A" },
  modeText: { color: "#159269", fontFamily: "Inter_700Bold", fontSize: 8 },
  infoRow: { minHeight: 31, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { color: "#85899E", fontFamily: "Inter_500Medium", fontSize: 10 },
  infoValue: { maxWidth: "68%", color: "#303247", textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  reasonTitle: { fontFamily: "Inter_500Medium", fontSize: 10, marginBottom: 9 },
  reasonList: { gap: 8 },
  reason: { minHeight: 43, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  reasonActive: { borderColor: "#A99CFF", backgroundColor: "#F9F8FF" },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: "#CBD0DE", alignItems: "center", justifyContent: "center" },
  radioActive: { backgroundColor: purple, borderColor: purple },
  radioCenter: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#FFFFFF" },
  reasonText: { marginLeft: 10, fontFamily: "Inter_500Medium", fontSize: 10 },
  customReason: { minHeight: 75, borderRadius: 12, borderWidth: 1, padding: 11, marginTop: 9, textAlignVertical: "top", fontFamily: "Inter_400Regular", fontSize: 10 },
  cancelButton: { minHeight: 48, borderRadius: 11, backgroundColor: "#F3454E", alignItems: "center", justifyContent: "center", marginTop: 19, shadowColor: "#F3454E", shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  cancelText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 12 },
  keepButton: { minHeight: 45, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 9 },
  keepText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  disabled: { opacity: 0.45 },
});
