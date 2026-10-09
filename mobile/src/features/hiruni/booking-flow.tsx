import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Tutor } from "@/features/lasiru/types";
import { apiRequest } from "@/services/api";

type Slot = {
  _id: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
};

type SessionType = "online" | "in_person";

type Booking = {
  _id: string;
  tutor: { _id: string; name: string; profile?: { subjects?: string[] } };
  subject: string;
  sessionType?: SessionType;
  startsAt: string;
  durationMinutes: number;
  status: string;
};

const purple = "#5D58F7";
const lavender = "#EFEDFF";

function dateKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationOf(slot: Slot) {
  return Math.round(
    (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) /
      60000,
  );
}

function ScreenHeader({ title }: { title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.screenHeader}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/discover"))}
        style={[styles.backButton, { backgroundColor: colors.surface }]}
      >
        <Ionicons name="chevron-back" size={21} color={colors.text} />
      </Pressable>
      <Text style={[styles.screenTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function TutorCard({ tutor }: { tutor: Tutor }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.tutorCard, { backgroundColor: colors.surface }]}> 
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(tutor.name)}</Text>
        <View style={styles.onlineDot}>
          <Ionicons name="checkmark" size={9} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.tutorCopy}>
        <View style={styles.nameRow}>
          <Text style={[styles.tutorName, { color: colors.text }]}>{tutor.name}</Text>
          {tutor.isVerified && <Text style={styles.peerBadge}>Peer Tutor</Text>}
        </View>
        <Text style={styles.tutorSubject} numberOfLines={1}>
          {tutor.profile?.subjects?.join(" • ") || "University Tutor"}
        </Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#F4A52C" />
          <Text style={styles.ratingText}>
            {tutor.averageRating ? tutor.averageRating.toFixed(1) : "New"}
            {tutor.reviewCount ? ` (${tutor.reviewCount} reviews)` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ErrorCard({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <View style={styles.errorCard}>
      <Ionicons name="alert-circle-outline" size={20} color="#C04F68" />
      <Text style={styles.errorText}>{message}</Text>
      {retry && (
        <Pressable onPress={retry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export function TutorAvailabilityScreen() {
  const { tutorId, rescheduleId } = useLocalSearchParams<{
    tutorId?: string;
    rescheduleId?: string;
  }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!tutorId) {
      setError("Tutor information is missing.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [tutorData, availability, bookingData] = await Promise.all([
        apiRequest<{ tutor: Tutor }>(`/tutors/${tutorId}`),
        apiRequest<{ slots: Slot[] }>(`/availability/tutor/${tutorId}`),
        rescheduleId && token
          ? apiRequest<{ bookings: Booking[] }>("/bookings", {
              headers: { Authorization: `Bearer ${token}` },
            })
          : Promise.resolve({ bookings: [] }),
      ]);
      setTutor(tutorData.tutor);
      setSlots(availability.slots);
      const currentBooking = bookingData.bookings.find(
        (item) => item._id === rescheduleId,
      );
      setSubject(
        currentBooking?.subject ||
          tutorData.tutor.profile?.subjects?.[0] ||
          "Tutoring session",
      );
      if (availability.slots[0]) setSelectedDay(dateKey(availability.slots[0].startsAt));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load availability.");
    } finally {
      setLoading(false);
    }
  }, [rescheduleId, token, tutorId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const days = useMemo(() => {
    const first = new Date();
    first.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, []);
  const visibleSlots = slots.filter(
    (slot) => !slot.isBooked && dateKey(slot.startsAt) === selectedDay,
  );
  const chosen = slots.find((slot) => slot._id === selectedSlot);

  function next() {
    if (!tutorId || !chosen) return;
    router.push({
      pathname: "/booking/details",
      params: {
        tutorId,
        slotId: chosen._id,
        subject,
        sessionType: "online",
        ...(rescheduleId ? { rescheduleId } : {}),
      },
    });
  }

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? colors.background : lavender },
      ]}
      edges={["top"]}
    >
      <ScreenHeader title={rescheduleId ? "Choose a New Time" : "Tutor Availability"} />
      <ScrollView
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Select a suitable date and time slot</Text>
        {loading && <ActivityIndicator style={styles.loader} color={purple} />}
        {!!error && <ErrorCard message={error} retry={() => void load()} />}
        {tutor && (
          <>
            <TutorCard tutor={tutor} />
            <View style={[styles.sectionHeading, styles.sectionRule]}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>SELECT DATE</Text>
              <Text style={styles.monthLabel}>
                {(selectedDay ? new Date(`${selectedDay}T12:00:00`) : new Date()).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
              snapToInterval={68}
              decelerationRate="fast"
            >
              {days.map((day) => {
                const key = dateKey(day);
                const active = key === selectedDay;
                const hasSlots = slots.some(
                  (slot) => !slot.isBooked && dateKey(slot.startsAt) === key,
                );
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelectedDay(key);
                      setSelectedSlot("");
                    }}
                    style={[
                      styles.dayCard,
                      { backgroundColor: colors.surface },
                      active && styles.dayCardActive,
                    ]}
                  >
                    <Text style={[styles.dayName, active && styles.dayActiveText]}>{day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.dayNumber, { color: colors.text }, active && styles.dayActiveText]}>{day.getDate()}</Text>
                    <Text style={[styles.dayMonth, active && styles.dayActiveText]}>{day.toLocaleDateString(undefined, { month: "short" })}</Text>
                    {hasSlots && !active && <View style={styles.slotDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={[styles.sectionHeading, styles.sectionRule]}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>AVAILABLE TIME SLOTS</Text>
              <Text style={[styles.countText, { color: colors.textMuted }]}>{visibleSlots.length} slots available</Text>
            </View>
            <View style={styles.slotList}>
              {visibleSlots.map((slot) => {
                const active = selectedSlot === slot._id;
                return (
                  <Pressable
                    key={slot._id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active, disabled: active }}
                    disabled={active}
                    onPress={() => setSelectedSlot(slot._id)}
                    style={[
                      styles.timeCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      active && styles.timeCardActive,
                    ]}
                  >
                    <View style={[styles.clockIcon, active && styles.clockIconActive]}>
                      <Ionicons name="time-outline" size={17} color={active ? "#FFFFFF" : "#7C82A0"} />
                    </View>
                    <View style={styles.timeCopy}>
                      <View style={styles.timeTitleRow}>
                        <Text style={[styles.timeTitle, { color: active ? purple : colors.text }]}>{formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}</Text>
                        {active && <Text style={styles.selectedBadge}>Selected</Text>}
                      </View>
                      <Text style={[styles.timeMeta, { color: colors.textMuted }]}>{durationOf(slot)} mins • Online via Tutor Link</Text>
                    </View>
                    <View style={[styles.radio, active && styles.radioActive]}>{active && <View style={styles.radioCenter} />}</View>
                  </Pressable>
                );
              })}
              {!visibleSlots.length && !loading && (
                <View style={[styles.emptySlots, { backgroundColor: colors.surface }]}> 
                  <Ionicons name="calendar-outline" size={25} color="#9A96D7" />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No times available on this date</Text>
                  <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>Try another highlighted date or check again later.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <View style={[styles.stickyFooter, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.selectedSummary}>
          <Text style={[styles.selectedLabel, { color: colors.textMuted }]}>Selected Slot:</Text>
          <Text style={[styles.selectedValue, { color: colors.text }]} numberOfLines={1}>
            {chosen ? `${new Date(chosen.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} • ${formatTime(chosen.startsAt)}` : "Choose a time above"}
          </Text>
        </View>
        <Pressable disabled={!chosen} onPress={next} style={[styles.primaryButton, !chosen && styles.disabled]}>
          <Text style={styles.primaryButtonText}>Next</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function BookingDetailsScreen() {
  const { tutorId, slotId, subject: initialSubject, sessionType: initialType, rescheduleId } = useLocalSearchParams<{
    tutorId?: string;
    slotId?: string;
    subject?: string;
    sessionType?: SessionType;
    rescheduleId?: string;
  }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [subject, setSubject] = useState(initialSubject || "Tutoring session");
  const [sessionType, setSessionType] = useState<SessionType>(initialType || "online");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!tutorId || !slotId) {
      setError("Booking details are incomplete.");
      setLoading(false);
      return;
    }
    try {
      const [tutorData, availability] = await Promise.all([
        apiRequest<{ tutor: Tutor }>(`/tutors/${tutorId}`),
        apiRequest<{ slots: Slot[] }>(`/availability/tutor/${tutorId}`),
      ]);
      const selected = availability.slots.find((item) => item._id === slotId);
      if (!selected) throw new Error("This time is no longer available. Please choose another slot.");
      setTutor(tutorData.tutor);
      setSlot(selected);
      setSubject((current) => current || tutorData.tutor.profile?.subjects?.[0] || "Tutoring session");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load booking details.");
    } finally {
      setLoading(false);
    }
  }, [slotId, tutorId]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  async function book() {
    if (!token || !tutorId || !slotId || !subject.trim()) return;
    try {
      setBusy(true);
      setError("");
      const result = rescheduleId
        ? await apiRequest<{ booking: Booking }>(`/bookings/${rescheduleId}/reschedule`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ slotId }),
          })
        : await apiRequest<{ booking: Booking }>("/bookings", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tutorId, slotId, subject: subject.trim(), notes: notes.trim(), sessionType }),
          });
      router.replace({ pathname: "/booking/confirmation", params: { bookingId: result.booking._id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book this session.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={["top"]}>
      <ScreenHeader title={rescheduleId ? "Review New Time" : "Booking Details"} />
      <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator style={styles.loader} color={purple} />}
        {!!error && <ErrorCard message={error} retry={!tutor ? () => void load() : undefined} />}
        {tutor && slot && (
          <>
            <TutorCard tutor={tutor} />
            <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}> 
              <View style={styles.detailsHeadingRow}>
                <Text style={styles.detailsLabel}>SESSION DETAILS</Text>
                <View style={styles.confirmedBadge}><Text style={styles.confirmedBadgeText}>Confirmed Slot</Text></View>
              </View>
              <DetailRow icon="calendar-outline" label="Date" value={new Date(slot.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
              <DetailRow icon="time-outline" label="Time" value={`${formatTime(slot.startsAt)} – ${formatTime(slot.endsAt)}`} />
              <DetailRow icon="timer-outline" label="Duration" value={`${durationOf(slot)} mins`} />
              <View style={styles.detailRow}>
                <View style={styles.detailKey}><Ionicons name="videocam-outline" size={16} color="#9298B4" /><Text style={styles.detailKeyText}>Session Type</Text></View>
                <View style={styles.typeChoices}>
                  {(["online", "in_person"] as SessionType[]).map((value) => (
                    <Pressable key={value} onPress={() => setSessionType(value)} style={[styles.typePill, sessionType === value && styles.typePillActive]}>
                      <View style={[styles.typeDot, sessionType === value && styles.typeDotActive]} />
                      <Text style={[styles.typeText, sessionType === value && styles.typeTextActive]}>{value === "online" ? "Online" : "In-person"}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
            {!rescheduleId && (
              <>
                <Text style={[styles.formLabel, { color: colors.text }]}>Subject</Text>
                <TextInput value={subject} onChangeText={setSubject} maxLength={80} style={[styles.subjectField, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} />
                <Text style={[styles.formLabel, { color: colors.text }]}>Additional Information</Text>
                <TextInput
                  multiline
                  value={notes}
                  onChangeText={setNotes}
                  maxLength={300}
                  placeholder="Notes for tutor (optional)..."
                  placeholderTextColor="#A4A7B8"
                  style={[styles.notesField, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                />
                <Text style={[styles.helperText, { color: colors.textMuted }]}>e.g., specific topics, assignment help, or anything your tutor should know.</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
      <View style={[styles.detailsFooter, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Pressable disabled={busy || !slot || !subject.trim()} onPress={() => void book()} style={[styles.primaryButton, (busy || !slot || !subject.trim()) && styles.disabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{rescheduleId ? "Request New Time" : "Book Session"}</Text>}
        </Pressable>
      </View>
      <AppBottomNav active="bookings" />
    </SafeAreaView>
  );
}

export function BookingConfirmationScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token || !bookingId) return setError("Booking information is missing.");
    try {
      const data = await apiRequest<{ bookings: Booking[] }>("/bookings", { headers: { Authorization: `Bearer ${token}` } });
      const saved = data.bookings.find((item) => item._id === bookingId);
      if (!saved) throw new Error("Booking could not be found.");
      setBooking(saved);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load confirmation.");
    }
  }, [bookingId, token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  return (
    <SafeAreaView style={[styles.confirmSafe, { backgroundColor: lavender }]} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.confirmContent} showsVerticalScrollIndicator={false}>
        <View style={styles.successHalo}>
          <View style={styles.successCircle}><Ionicons name="checkmark" size={46} color="#FFFFFF" /></View>
          <View style={[styles.spark, { top: 0, left: 26, backgroundColor: "#FFC52F" }]} />
          <View style={[styles.spark, { top: 12, right: 20, backgroundColor: "#8B86FF" }]} />
          <View style={[styles.spark, { bottom: 4, left: 8, backgroundColor: purple }]} />
        </View>
        <Text style={styles.confirmTitle}>Booking Confirmed!</Text>
        <Text style={styles.confirmSubtitle}>Your tutoring session request has been successfully scheduled and sent.</Text>
        {!!error && <ErrorCard message={error} retry={() => void load()} />}
        {!booking && !error && <ActivityIndicator style={styles.loader} color={purple} />}
        {booking && (
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}> 
            <View style={styles.summaryHeading}>
              <Text style={styles.detailsLabel}>SESSION SUMMARY</Text>
              <Text style={styles.bookingCode}>#TL-{booking._id.slice(-4).toUpperCase()}</Text>
            </View>
            <SummaryRow label="Tutor" value={booking.tutor.name} avatar={initials(booking.tutor.name)} />
            <SummaryRow label="Subject" value={booking.subject} />
            <SummaryRow label="Date" value={new Date(booking.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
            <SummaryRow label="Time" value={formatTime(booking.startsAt)} />
            <SummaryRow label="Duration" value={`${booking.durationMinutes} mins`} />
            <SummaryRow label="Session Type" value={booking.sessionType === "in_person" ? "In-person" : "Online"} status />
          </View>
        )}
      </ScrollView>
      <View style={styles.confirmActions}>
        <Pressable onPress={() => router.replace("/booking/my-bookings")} style={styles.primaryButton}><Text style={styles.primaryButtonText}>View My Bookings</Text></Pressable>
        <Pressable onPress={() => router.replace("/home")} style={styles.homeButton}><Text style={[styles.homeButtonText, { color: colors.text }]}>Back to Home</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

type BookingListTab = "upcoming" | "completed";

export function MyBookingsScreen() {
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<BookingListTab>("upcoming");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiRequest<{ bookings: Booking[] }>("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBookings(data.bookings);
      const tutorIds = [
        ...new Set(data.bookings.map((booking) => booking.tutor?._id).filter(Boolean)),
      ];
      const tutorResults = await Promise.allSettled(
        tutorIds.map((id) => apiRequest<{ tutor: Tutor }>(`/tutors/${id}`)),
      );
      const nextRatings: Record<string, number> = {};
      tutorResults.forEach((result, index) => {
        if (result.status === "fulfilled")
          nextRatings[tutorIds[index]] = result.value.tutor.averageRating || 0;
      });
      setRatings(nextRatings);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your bookings.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  const upcoming = bookings.filter((booking) =>
    ["pending", "confirmed", "paid", "scheduled", "live", "reschedule_requested"].includes(booking.status),
  );
  const completed = bookings.filter((booking) =>
    ["completed", "cancelled", "refund_pending", "refunded"].includes(booking.status),
  );
  const visible = tab === "upcoming" ? upcoming : completed;

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? colors.background : lavender },
      ]}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={styles.myBookingsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.myBookingsHeader}>
          <View style={styles.myBookingsHeaderCopy}>
            <Text style={[styles.myBookingsTitle, { color: colors.text }]}>My Bookings</Text>
            <Text style={[styles.myBookingsSubtitle, { color: colors.textMuted }]}>Manage your upcoming and past learning sessions</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open learning schedule"
            onPress={() => router.replace("/bookings")}
            style={[styles.scheduleButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="calendar-outline" size={15} color={purple} />
            <Text style={styles.scheduleButtonText}>Schedule</Text>
          </Pressable>
        </View>

        <View style={[styles.bookingTabs, { backgroundColor: colors.surface }]}> 
          {(["upcoming", "completed"] as BookingListTab[]).map((value) => {
            const active = tab === value;
            const count = value === "upcoming" ? upcoming.length : completed.length;
            return (
              <Pressable
                key={value}
                onPress={() => setTab(value)}
                style={[styles.bookingTab, active && styles.bookingTabActive]}
              >
                <Text style={[styles.bookingTabText, active && styles.bookingTabTextActive]}>
                  {value === "upcoming" ? "Upcoming" : "Completed"}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabCount, active && styles.tabCountActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {!!error && <ErrorCard message={error} retry={() => void load()} />}
        {loading && <ActivityIndicator style={styles.loader} color={purple} />}

        {!loading && !visible.length && (
          <View style={[styles.noBookingsCard, { backgroundColor: colors.surface }]}> 
            <Ionicons name="calendar-clear-outline" size={32} color="#8E87F5" />
            <Text style={[styles.noBookingsTitle, { color: colors.text }]}>No {tab} bookings</Text>
            <Text style={[styles.noBookingsCopy, { color: colors.textMuted }]}>
              {tab === "upcoming"
                ? "Book a tutor and your next sessions will appear here."
                : "Your completed sessions will appear here."}
            </Text>
            {tab === "upcoming" && (
              <Pressable onPress={() => router.push("/discover")} style={styles.findTutorButton}>
                <Text style={styles.findTutorText}>Find a Tutor</Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.myBookingList}>
          {visible.map((booking) => (
            <MyBookingCard
              key={booking._id}
              booking={booking}
              rating={ratings[booking.tutor?._id] || 0}
              completed={tab === "completed"}
              onCancel={() =>
                router.push({
                  pathname: "/booking/cancel",
                  params: { bookingId: booking._id },
                })
              }
              onReschedule={() =>
                router.push({
                  pathname: "/booking/reschedule",
                  params: { bookingId: booking._id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
      <AppBottomNav active="bookings" />
    </SafeAreaView>
  );
}

export function RescheduleBookingScreen() {
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
      const bookingData = await apiRequest<{ bookings: Booking[] }>("/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const current = bookingData.bookings.find((item) => item._id === bookingId);
      if (!current) throw new Error("Booking could not be found.");
      const availability = await apiRequest<{ slots: Slot[] }>(
        `/availability/tutor/${current.tutor._id}`,
      );
      setBooking(current);
      setSlots(availability.slots);
      if (availability.slots[0])
        setSelectedDay(dateKey(availability.slots[0].startsAt));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reschedule options.");
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
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, []);
  const visibleSlots = slots.filter((slot) => dateKey(slot.startsAt) === selectedDay);

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
      setError(err instanceof Error ? err.message : "Could not reschedule this booking.");
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
      <ScreenHeader title="Reschedule Booking" />
      <ScrollView
        contentContainerStyle={styles.rescheduleContent}
        showsVerticalScrollIndicator={false}
      >
        {loading && <ActivityIndicator style={styles.loader} color={purple} />}
        {!!error && <ErrorCard message={error} retry={!booking ? () => void load() : undefined} />}

        {booking && (
          <>
            <View style={[styles.currentBookingCard, { backgroundColor: colors.surface }]}> 
              <View style={styles.currentBookingHeading}>
                <Text style={styles.detailsLabel}>CURRENT BOOKING DETAILS</Text>
                <Text style={styles.upcomingBadge}>Upcoming</Text>
              </View>
              <SummaryRow label="Tutor" value={booking.tutor.name} />
              <SummaryRow label="Subject" value={booking.subject} />
              <SummaryRow
                label="Scheduled Time"
                value={new Date(booking.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              />
              <Text style={styles.currentTime}>
                {formatTime(booking.startsAt)} – {formatTime(new Date(new Date(booking.startsAt).getTime() + booking.durationMinutes * 60000).toISOString())}
              </Text>
            </View>

            <View style={styles.rescheduleSectionHeading}>
              <Text style={[styles.rescheduleLabel, { color: colors.text }]}>Select New Date</Text>
              <Text style={styles.monthLabel}>
                {(selectedDay ? new Date(`${selectedDay}T12:00:00`) : new Date()).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rescheduleDayRow}
              snapToInterval={72}
              decelerationRate="fast"
            >
              {days.map((day) => {
                const key = dateKey(day);
                const active = key === selectedDay;
                const hasSlots = slots.some((slot) => dateKey(slot.startsAt) === key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSelectedDay(key);
                      setSelectedSlot("");
                    }}
                    style={[
                      styles.rescheduleDay,
                      { backgroundColor: colors.surface },
                      active && styles.rescheduleDayActive,
                    ]}
                  >
                    <Text style={[styles.dayName, active && styles.dayActiveText]}>{day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.dayNumber, { color: colors.text }, active && styles.dayActiveText]}>{day.getDate()}</Text>
                    <Text style={[styles.dayMonth, active && styles.dayActiveText]}>{day.toLocaleDateString(undefined, { month: "short" })}</Text>
                    {hasSlots && !active && <View style={styles.slotDot} />}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.rescheduleSectionHeading}>
              <Text style={[styles.rescheduleLabel, { color: colors.text }]}>Available New Time Slots</Text>
              <Text style={[styles.timezoneText, { color: colors.textMuted }]}>Sri Lanka (GMT+5:30)</Text>
            </View>
            <View style={styles.rescheduleSlotList}>
              {visibleSlots.map((slot) => {
                const active = selectedSlot === slot._id;
                return (
                  <Pressable
                    key={slot._id}
                    onPress={() => setSelectedSlot(slot._id)}
                    style={[
                      styles.rescheduleTimeCard,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                      active && styles.rescheduleTimeActive,
                    ]}
                  >
                    <View style={[styles.smallClock, active && styles.smallClockActive]}>
                      <Ionicons name="time-outline" size={15} color={active ? purple : "#91A0B8"} />
                    </View>
                    <Text style={[styles.rescheduleTimeText, { color: active ? purple : colors.text }]}>
                      {formatTime(slot.startsAt)} – {formatTime(slot.endsAt)}
                    </Text>
                    <View style={[styles.radio, active && styles.rescheduleCheck]}>
                      {active && <Ionicons name="checkmark" size={11} color="#FFFFFF" />}
                    </View>
                  </Pressable>
                );
              })}
              {!visibleSlots.length && (
                <View style={[styles.emptyRescheduleSlots, { backgroundColor: colors.surface }]}> 
                  <Ionicons name="calendar-outline" size={24} color="#938DF5" />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No available times on this date</Text>
                  <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>Choose another highlighted date.</Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
      <View style={[styles.rescheduleFooter, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Pressable
          disabled={busy || !selectedSlot}
          onPress={() => void confirmReschedule()}
          style={[styles.primaryButton, (busy || !selectedSlot) && styles.disabled]}
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Confirm Reschedule</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function bookingStatus(status: string) {
  if (status === "pending") return "Pending";
  if (status === "reschedule_requested") return "Reschedule sent";
  if (["confirmed", "paid", "scheduled", "live"].includes(status)) return "Confirmed";
  if (status === "completed") return "Completed";
  if (["refund_pending", "refunded"].includes(status)) return "Refunded";
  return "Cancelled";
}

function MyBookingCard({
  booking,
  rating,
  completed,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  rating: number;
  completed: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const { colors } = useAppTheme();
  const [currentTime, setCurrentTime] = useState(0);
  const label = bookingStatus(booking.status);
  const positive = ["Confirmed", "Completed"].includes(label);
  const canManage =
    ["pending", "confirmed", "scheduled"].includes(booking.status) &&
    currentTime > 0 &&
    new Date(booking.startsAt).getTime() > currentTime;

  useEffect(() => {
    const request = setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => clearTimeout(request);
  }, []);
  return (
    <View style={[styles.myBookingCard, { backgroundColor: colors.surface }]}> 
      <View style={styles.bookingTutorRow}>
        <View style={styles.bookingAvatar}>
          <Text style={styles.bookingAvatarText}>{initials(booking.tutor.name)}</Text>
        </View>
        <View style={styles.bookingTutorCopy}>
          <Text style={[styles.bookingTutorName, { color: colors.text }]}>{booking.tutor.name}</Text>
          <Text style={styles.bookingSubject}>{booking.subject}</Text>
          <View style={styles.bookingMetaRow}>
            <Ionicons name="star" size={11} color="#F3A12B" />
            <Text style={styles.bookingRating}>{rating ? rating.toFixed(1) : "New"}</Text>
            <Text style={[styles.bookingMode, { color: colors.textMuted }]}>• {booking.sessionType === "in_person" ? "In-person" : "Online"}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, positive ? styles.statusPositive : styles.statusPending]}>
          <View style={[styles.statusDot, { backgroundColor: positive ? "#15B979" : "#E19A24" }]} />
          <Text style={[styles.statusText, { color: positive ? "#139367" : "#B87816" }]}>{label}</Text>
        </View>
      </View>
      <View style={[styles.bookingDateRow, { backgroundColor: colors.surfaceMuted }]}> 
        <Ionicons name="calendar-outline" size={15} color={purple} />
        <Text style={[styles.bookingDate, { color: colors.text }]}> 
          {new Date(booking.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
        </Text>
        <Text style={styles.bookingSeparator}>•</Text>
        <Text style={[styles.bookingTime, { color: colors.textMuted }]}>{formatTime(booking.startsAt)}</Text>
      </View>
      {!completed && canManage && (
        <View style={styles.bookingActions}>
          <Pressable onPress={onReschedule} style={[styles.rescheduleButton, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="repeat-outline" size={13} color={purple} />
            <Text style={styles.rescheduleText}>Reschedule</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={[styles.cancelBookingButton, { borderColor: colors.border }]}>
            <Text style={[styles.cancelBookingText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailKey}><Ionicons name={icon} size={16} color="#9298B4" /><Text style={styles.detailKeyText}>{label}</Text></View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function SummaryRow({ label, value, avatar, status }: { label: string; value: string; avatar?: string; status?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryKey}>{label}</Text>
      <View style={styles.summaryValueWrap}>
        {avatar && <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{avatar}</Text></View>}
        {status && <View style={styles.onlineStatusDot} />}
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  confirmSafe: { flex: 1 },
  screenHeader: { width: "100%", maxWidth: 620, alignSelf: "center", minHeight: 60, flexDirection: "row", alignItems: "center", paddingHorizontal: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", shadowColor: "#25204D", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  screenTitle: { flex: 1, textAlign: "center", fontFamily: "Manrope_800ExtraBold", fontSize: 18 },
  headerSpacer: { width: 40 },
  pageContent: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 24 },
  detailsContent: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 20, paddingBottom: 25 },
  subtitle: { textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: -3, marginBottom: 18 },
  loader: { marginVertical: 35 },
  tutorCard: { minHeight: 98, borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", shadowColor: "#332C63", shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 3, marginBottom: 22 },
  avatar: { width: 62, height: 62, borderRadius: 18, backgroundColor: "#29245D", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 18 },
  onlineDot: { position: "absolute", right: -4, bottom: 2, width: 17, height: 17, borderRadius: 9, backgroundColor: "#1FC98A", borderWidth: 2, borderColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  tutorCopy: { flex: 1, marginLeft: 13 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  tutorName: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  peerBadge: { color: "#625CF1", backgroundColor: "#E9E7FF", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, fontFamily: "Inter_700Bold", fontSize: 8 },
  tutorSubject: { color: "#625CF1", fontFamily: "Inter_600SemiBold", fontSize: 10, marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 7 },
  ratingText: { color: "#8B8EA1", fontFamily: "Inter_500Medium", fontSize: 9 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5, marginBottom: 11 },
  sectionRule: { marginHorizontal: -20, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#AD9BFF", borderStyle: "dashed" },
  sectionLabel: { fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.65 },
  monthLabel: { color: purple, fontFamily: "Inter_700Bold", fontSize: 10 },
  countText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  dayRow: { gap: 10, paddingBottom: 24 },
  dayCard: { width: 58, height: 78, borderRadius: 15, alignItems: "center", justifyContent: "center", shadowColor: "#2A2552", shadowOpacity: 0.04, shadowRadius: 7, elevation: 1 },
  dayCardActive: { backgroundColor: purple, shadowColor: purple, shadowOpacity: 0.25, elevation: 5 },
  dayName: { color: "#9598AA", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  dayNumber: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginVertical: 3 },
  dayMonth: { color: "#9A9CAD", fontFamily: "Inter_500Medium", fontSize: 8 },
  dayActiveText: { color: "#FFFFFF" },
  slotDot: { position: "absolute", bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: purple },
  slotList: { gap: 10 },
  timeCard: { minHeight: 70, borderRadius: 16, borderWidth: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 13 },
  timeCardActive: { borderColor: purple, borderWidth: 2, backgroundColor: "#F4F2FF" },
  clockIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#F5F6FA", alignItems: "center", justifyContent: "center" },
  clockIconActive: { backgroundColor: purple },
  timeCopy: { flex: 1, marginLeft: 11 },
  timeTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  timeTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  timeMeta: { fontFamily: "Inter_400Regular", fontSize: 8, marginTop: 5 },
  selectedBadge: { color: purple, backgroundColor: "#DED9FF", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, fontFamily: "Inter_700Bold", fontSize: 6 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "#CDD0DF", alignItems: "center", justifyContent: "center" },
  radioActive: { borderColor: purple, backgroundColor: purple },
  radioCenter: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  emptySlots: { padding: 22, borderRadius: 17, alignItems: "center" },
  emptyTitle: { fontFamily: "Inter_700Bold", fontSize: 12, marginTop: 8 },
  emptyCopy: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 4, textAlign: "center" },
  stickyFooter: { width: "100%", maxWidth: 620, alignSelf: "center", borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 14 },
  selectedSummary: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  selectedLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
  selectedValue: { flex: 1, textAlign: "right", marginLeft: 12, fontFamily: "Inter_700Bold", fontSize: 10 },
  primaryButton: { minHeight: 50, borderRadius: 12, backgroundColor: purple, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: purple, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  primaryButtonText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  disabled: { opacity: 0.45 },
  detailsCard: { borderRadius: 20, padding: 18, marginBottom: 17 },
  detailsHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#ECEAF6", paddingBottom: 15, marginBottom: 7 },
  detailsLabel: { color: "#8A8EA8", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.65 },
  confirmedBadge: { backgroundColor: "#E8E5FF", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  confirmedBadgeText: { color: purple, fontFamily: "Inter_700Bold", fontSize: 8 },
  detailRow: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailKey: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailKeyText: { color: "#8C90A5", fontFamily: "Inter_500Medium", fontSize: 10 },
  detailValue: { color: "#292B40", fontFamily: "Inter_700Bold", fontSize: 10 },
  typeChoices: { flexDirection: "row", gap: 5 },
  typePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 9, backgroundColor: "#F3F3F8" },
  typePillActive: { backgroundColor: "#E9E7FF" },
  typeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#A4A6B6" },
  typeDotActive: { backgroundColor: "#21C98B" },
  typeText: { color: "#7C8093", fontFamily: "Inter_700Bold", fontSize: 8 },
  typeTextActive: { color: purple },
  formLabel: { fontFamily: "Inter_700Bold", fontSize: 10, marginBottom: 8, marginTop: 3 },
  subjectField: { height: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, fontFamily: "Inter_600SemiBold", fontSize: 12, marginBottom: 15 },
  notesField: { minHeight: 108, borderRadius: 14, borderWidth: 1, padding: 13, textAlignVertical: "top", fontFamily: "Inter_400Regular", fontSize: 11 },
  helperText: { fontFamily: "Inter_400Regular", fontSize: 8, marginTop: 7 },
  detailsFooter: { borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 11 },
  errorCard: { backgroundColor: "#FFF0F3", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  errorText: { color: "#A64258", flex: 1, fontFamily: "Inter_500Medium", fontSize: 11 },
  retryText: { color: purple, fontFamily: "Inter_700Bold", fontSize: 10 },
  confirmContent: { width: "100%", maxWidth: 560, alignSelf: "center", alignItems: "center", paddingHorizontal: 22, paddingTop: 30, paddingBottom: 22 },
  successHalo: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center" },
  successCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: purple, alignItems: "center", justifyContent: "center", shadowColor: purple, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  spark: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  confirmTitle: { color: "#211D50", fontFamily: "Manrope_800ExtraBold", fontSize: 23, marginTop: 19 },
  confirmSubtitle: { maxWidth: 300, color: "#6F7186", textAlign: "center", fontFamily: "Inter_500Medium", fontSize: 10, lineHeight: 16, marginTop: 7, marginBottom: 25 },
  summaryCard: { width: "100%", borderRadius: 18, padding: 18 },
  summaryHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#ECEAF5", paddingBottom: 14, marginBottom: 8 },
  bookingCode: { color: purple, backgroundColor: "#ECE9FF", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontFamily: "Inter_700Bold", fontSize: 8 },
  summaryRow: { minHeight: 37, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryKey: { color: "#8B8EA1", fontFamily: "Inter_500Medium", fontSize: 10 },
  summaryValueWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
  summaryValue: { color: "#303147", fontFamily: "Inter_700Bold", fontSize: 10 },
  miniAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8E5FF", alignItems: "center", justifyContent: "center" },
  miniAvatarText: { color: purple, fontFamily: "Inter_700Bold", fontSize: 7 },
  onlineStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22CB8D" },
  confirmActions: { width: "100%", maxWidth: 560, alignSelf: "center", paddingHorizontal: 22, paddingBottom: 10, gap: 9 },
  homeButton: { minHeight: 46, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  homeButtonText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  myBookingsContent: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  myBookingsHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  myBookingsHeaderCopy: { flex: 1 },
  myBookingsTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 24, letterSpacing: -0.5 },
  myBookingsSubtitle: { fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 15, marginTop: 3 },
  scheduleButton: { minHeight: 38, borderRadius: 12, borderWidth: 1, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, shadowColor: "#332D61", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  scheduleButtonText: { color: purple, fontFamily: "Inter_700Bold", fontSize: 9.5 },
  bookingTabs: { height: 44, borderRadius: 12, padding: 4, flexDirection: "row", marginBottom: 14 },
  bookingTab: { flex: 1, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  bookingTabActive: { backgroundColor: purple },
  bookingTabText: { color: "#777A90", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  bookingTabTextActive: { color: "#FFFFFF" },
  tabCount: { minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: "#ECEAF8", alignItems: "center", justifyContent: "center" },
  tabCountActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  tabCountText: { color: "#777A90", fontFamily: "Inter_700Bold", fontSize: 8 },
  tabCountTextActive: { color: "#FFFFFF" },
  myBookingList: { gap: 12 },
  myBookingCard: { borderRadius: 17, padding: 13, shadowColor: "#332D61", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  bookingTutorRow: { flexDirection: "row", alignItems: "flex-start" },
  bookingAvatar: { width: 45, height: 45, borderRadius: 14, backgroundColor: "#2A255E", alignItems: "center", justifyContent: "center" },
  bookingAvatarText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  bookingTutorCopy: { flex: 1, marginLeft: 10 },
  bookingTutorName: { fontFamily: "Manrope_800ExtraBold", fontSize: 12 },
  bookingSubject: { color: purple, fontFamily: "Inter_600SemiBold", fontSize: 9, marginTop: 2 },
  bookingMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 5 },
  bookingRating: { color: "#D88B1C", fontFamily: "Inter_700Bold", fontSize: 8 },
  bookingMode: { fontFamily: "Inter_400Regular", fontSize: 8 },
  statusBadge: { maxWidth: 98, minHeight: 22, borderRadius: 11, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  statusPositive: { backgroundColor: "#E8FAF3" },
  statusPending: { backgroundColor: "#FFF5DF" },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontFamily: "Inter_700Bold", fontSize: 8 },
  bookingDateRow: { minHeight: 37, borderRadius: 11, marginTop: 11, paddingHorizontal: 11, flexDirection: "row", alignItems: "center" },
  bookingDate: { fontFamily: "Inter_500Medium", fontSize: 9, marginLeft: 5 },
  bookingSeparator: { color: "#B0B1BD", marginHorizontal: 7, fontSize: 9 },
  bookingTime: { fontFamily: "Inter_500Medium", fontSize: 9 },
  bookingActions: { flexDirection: "row", gap: 9, marginTop: 9 },
  rescheduleButton: { flex: 1, minHeight: 34, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  rescheduleText: { color: purple, fontFamily: "Inter_600SemiBold", fontSize: 9 },
  cancelBookingButton: { flex: 1, minHeight: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelBookingText: { fontFamily: "Inter_600SemiBold", fontSize: 9 },
  noBookingsCard: { borderRadius: 18, padding: 25, alignItems: "center" },
  noBookingsTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 14, marginTop: 9 },
  noBookingsCopy: { fontFamily: "Inter_400Regular", fontSize: 10, textAlign: "center", marginTop: 5 },
  findTutorButton: { marginTop: 13, backgroundColor: purple, paddingHorizontal: 17, paddingVertical: 9, borderRadius: 10 },
  findTutorText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 9 },
  rescheduleContent: { width: "100%", maxWidth: 620, alignSelf: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  currentBookingCard: { borderRadius: 17, padding: 15, marginBottom: 18, shadowColor: "#332D61", shadowOpacity: 0.05, shadowRadius: 9, elevation: 2 },
  currentBookingHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 9, marginBottom: 3, borderBottomWidth: 1, borderBottomColor: "#EFEDF7" },
  upcomingBadge: { color: purple, backgroundColor: "#EAE7FF", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, fontFamily: "Inter_700Bold", fontSize: 8 },
  currentTime: { color: purple, textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 10, marginTop: -7 },
  rescheduleSectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2, marginBottom: 10 },
  rescheduleLabel: { fontFamily: "Inter_700Bold", fontSize: 11 },
  timezoneText: { fontFamily: "Inter_400Regular", fontSize: 9 },
  rescheduleDayRow: { gap: 10, paddingBottom: 20 },
  rescheduleDay: { width: 62, height: 80, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#322D60", shadowOpacity: 0.04, shadowRadius: 7, elevation: 1 },
  rescheduleDayActive: { backgroundColor: purple, shadowColor: purple, shadowOpacity: 0.28, elevation: 5 },
  rescheduleSlotList: { gap: 10 },
  rescheduleTimeCard: { minHeight: 52, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  rescheduleTimeActive: { borderWidth: 2, borderColor: purple, backgroundColor: "#F6F4FF" },
  smallClock: { width: 25, height: 25, borderRadius: 9, backgroundColor: "#F4F6FA", alignItems: "center", justifyContent: "center" },
  smallClockActive: { backgroundColor: "#ECE9FF" },
  rescheduleTimeText: { flex: 1, marginLeft: 10, fontFamily: "Inter_700Bold", fontSize: 10 },
  rescheduleCheck: { backgroundColor: purple, borderColor: purple },
  emptyRescheduleSlots: { borderRadius: 14, padding: 20, alignItems: "center" },
  rescheduleFooter: { width: "100%", maxWidth: 620, alignSelf: "center", borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
});
