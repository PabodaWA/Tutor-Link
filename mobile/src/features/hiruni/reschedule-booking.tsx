import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type Slot = {
  _id: string;
  startsAt: string;
  endsAt: string;
};

type Booking = {
  _id: string;
  tutor: { _id: string; name: string };
  subject: string;
  startsAt: string;
  durationMinutes: number;
};

const purple = "#5D58F7";
const lavender = "#EFEDFF";

function dateKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RescheduleBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !bookingId) {
      setError("Booking information is missing.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const bookingData = await apiRequest<{ bookings: Booking[] }>(
        "/bookings",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const current = bookingData.bookings.find(
        (item) => item._id === bookingId,
      );
      if (!current) throw new Error("Booking could not be found.");
      const availability = await apiRequest<{ slots: Slot[] }>(
        `/availability/tutor/${current.tutor._id}`,
      );
      setBooking(current);
      setSlots(availability.slots);
      setSelectedDay(
        availability.slots[0]
          ? dateKey(availability.slots[0].startsAt)
          : dateKey(new Date()),
      );
      setSelectedSlot("");
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load reschedule options.",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, []);
  const visibleSlots = slots.filter(
    (slot) => dateKey(slot.startsAt) === selectedDay,
  );
/**
 * Confirms a booking reschedule using the selected time slot.
 * Sends the updated slot to the booking API and redirects
 * to My Bookings after a successful response.
 * Handles request errors and loading state.
 */
  async function confirmReschedule() {
    if (!token || !bookingId || !selectedSlot) return;
    try {
      setBusy(true);
      setError("");
      await apiRequest(`/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ slotId: selectedSlot }),
      });
      router.replace("/booking/my-bookings");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reschedule this booking.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? colors.background : lavender },
      ]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/booking/my-bookings")
          }
          style={[styles.back, { backgroundColor: colors.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Reschedule Booking</Text>
        <View style={styles.headerSpace} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && <ActivityIndicator style={styles.loader} color={purple} />}

        {!!error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color="#BE4C65" />
            <Text style={styles.errorText}>{error}</Text>
            {!booking && (
              <Pressable onPress={() => void load()}>
                <Text style={styles.retry}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}

        {booking && (
          <>
            <View style={[styles.bookingCard, { backgroundColor: colors.surface }]}> 
              <View style={styles.cardHeading}>
                <Text style={styles.eyebrow}>CURRENT BOOKING DETAILS</Text>
                <Text style={styles.upcoming}>Upcoming</Text>
              </View>
              <InfoRow label="Tutor" value={booking.tutor.name} />
              <InfoRow label="Subject" value={booking.subject} />
              <InfoRow
                label="Scheduled Time"
                value={new Date(booking.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              />
              <Text style={styles.oldTime}>
                {formatTime(booking.startsAt)} –{" "}
                {formatTime(
                  new Date(
                    new Date(booking.startsAt).getTime() +
                      booking.durationMinutes * 60000,
                  ),
                )}
              </Text>
            </View>

            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Select New Date</Text>
              <Text style={styles.month}>
                {new Date(`${selectedDay}T12:00:00`).toLocaleDateString(
                  undefined,
                  { month: "long", year: "numeric" },
                )}
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.days}
              snapToInterval={72}
              decelerationRate="fast"
            >
              {days.map((day) => {
                const key = dateKey(day);
                const active = selectedDay === key;
                const available = slots.some(
                  (slot) => dateKey(slot.startsAt) === key,
                );
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelectedDay(key);
                      setSelectedSlot("");
                    }}
                    style={[
                      styles.day,
                      { backgroundColor: colors.surface },
                      active && styles.dayActive,
                    ]}
                  >
                    <Text style={[styles.weekday, active && styles.dayTextActive]}>
                      {day
                        .toLocaleDateString(undefined, { weekday: "short" })
                        .toUpperCase()}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        { color: colors.text },
                        active && styles.dayTextActive,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                    <Text style={[styles.dayMonth, active && styles.dayTextActive]}>
                      {day.toLocaleDateString(undefined, { month: "short" })}
                    </Text>
                    {available && !active && <View style={styles.availableDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Available New Time Slots</Text>
              <Text style={[styles.timezone, { color: colors.textMuted }]}>Sri Lanka (GMT+5:30)</Text>
            </View>

            <View style={styles.slots}>
              {visibleSlots.map((slot) => {
                const active = selectedSlot === slot._id;
                return (
                  <Pressable
                    key={slot._id}
                    onPress={() => setSelectedSlot(slot._id)}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                      active && styles.slotActive,
                    ]}
                  >
                    <View style={[styles.clock, active && styles.clockActive]}>
                      <Ionicons
                        name="time-outline"
                        size={15}
                        color={active ? purple : "#8C98B1"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.slotText,
                        { color: active ? purple : colors.text },
                      ]}
                    >
                      {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                    </Text>
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && (
                        <Ionicons name="checkmark" size={11} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                );
              })}

              {!visibleSlots.length && (
                <View style={[styles.empty, { backgroundColor: colors.surface }]}> 
                  <Ionicons name="calendar-outline" size={26} color="#8E87F5" />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No available times on this date</Text>
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>Choose another highlighted date.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          disabled={busy || !selectedSlot}
          onPress={() => void confirmReschedule()}
          style={[
            styles.confirm,
            (busy || !selectedSlot) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmText}>Confirm Reschedule</Text>
          )}
        </Pressable>
      </View>
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
  header: { width: "100%", maxWidth: 560, minHeight: 62, alignSelf: "center", paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#2E2858", shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  title: { flex: 1, textAlign: "center", fontFamily: "Manrope_800ExtraBold", fontSize: 18 },
  headerSpace: { width: 38 },
  scroll: { flex: 1 },
  content: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  loader: { marginVertical: 40 },
  errorCard: { backgroundColor: "#FFF0F3", borderRadius: 13, padding: 11, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 7 },
  errorText: { flex: 1, color: "#A84259", fontFamily: "Inter_500Medium", fontSize: 10 },
  retry: { color: purple, fontFamily: "Inter_700Bold", fontSize: 10 },
  bookingCard: { borderRadius: 18, padding: 16, marginBottom: 20, shadowColor: "#342E62", shadowOpacity: 0.07, shadowRadius: 11, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardHeading: { height: 31, borderBottomWidth: 1, borderBottomColor: "#EEEAF7", marginBottom: 5, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrow: { color: purple, fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.55 },
  upcoming: { color: purple, backgroundColor: "#E9E6FF", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, fontFamily: "Inter_700Bold", fontSize: 8 },
  infoRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoLabel: { color: "#8A8EA4", fontFamily: "Inter_500Medium", fontSize: 10 },
  infoValue: { maxWidth: "68%", color: "#2B2D42", textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 10 },
  oldTime: { color: purple, textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 10, marginTop: -7 },
  sectionTitleRow: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  month: { color: purple, fontFamily: "Inter_700Bold", fontSize: 9 },
  days: { gap: 10, paddingTop: 5, paddingBottom: 21 },
  day: { width: 62, height: 80, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#312B5E", shadowOpacity: 0.05, shadowRadius: 7, elevation: 1 },
  dayActive: { backgroundColor: purple, shadowColor: purple, shadowOpacity: 0.3, elevation: 5 },
  weekday: { color: "#9396A9", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  dayNumber: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginVertical: 3 },
  dayMonth: { color: "#9A9CAD", fontFamily: "Inter_500Medium", fontSize: 8 },
  dayTextActive: { color: "#FFFFFF" },
  availableDot: { position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: purple },
  timezone: { fontFamily: "Inter_400Regular", fontSize: 9 },
  slots: { gap: 10, paddingTop: 5 },
  slot: { minHeight: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  slotActive: { borderWidth: 2, borderColor: purple, backgroundColor: "#F7F5FF" },
  clock: { width: 27, height: 27, borderRadius: 9, backgroundColor: "#F3F5F9", alignItems: "center", justifyContent: "center" },
  clockActive: { backgroundColor: "#ECE9FF" },
  slotText: { flex: 1, marginLeft: 10, fontFamily: "Inter_700Bold", fontSize: 10 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#C9CDDC", alignItems: "center", justifyContent: "center" },
  radioActive: { backgroundColor: purple, borderColor: purple },
  empty: { borderRadius: 16, padding: 21, alignItems: "center" },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 11, marginTop: 7 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 4 },
  footer: { width: "100%", maxWidth: 560, alignSelf: "center", borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  confirm: { minHeight: 50, borderRadius: 12, backgroundColor: purple, alignItems: "center", justifyContent: "center", shadowColor: purple, shadowOpacity: 0.27, shadowRadius: 10, elevation: 5 },
  confirmText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  disabled: { opacity: 0.45 },
});
