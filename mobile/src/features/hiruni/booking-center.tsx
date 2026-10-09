import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { palette } from "@/constants/auth-theme";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { Tutor } from "@/features/lasiru/types";
import { apiRequest } from "@/services/api";
import {
  cancelLessonReminders,
  scheduleLessonReminders,
} from "@/services/lesson-reminders";

type Slot = {
  _id: string;
  startsAt: string;
  endsAt: string;
  isBooked: boolean;
};
type Person = { _id: string; name: string };
type SessionType = "online" | "in_person";
type Booking = {
  _id: string;
  student: Person;
  tutor: Person;
  subject: string;
  sessionType?: SessionType;
  startsAt: string;
  durationMinutes: number;
  status: string;
  price: number;
  creditCost?: number;
  creditsCharged?: boolean;
  reminderEnabled: boolean;
  cancellationReason?: string;
  cancelledBy?: "student" | "tutor" | "admin";
};
type BookingTab = "upcoming" | "requests" | "completed" | "history";
const requestStatuses = ["pending", "reschedule_requested"];
const timeOptions = ["09:00", "11:00", "14:00", "16:00", "18:00"];
const durationOptions = [30, 60, 90, 120] as const;
const cancellationReasons = [
  "Schedule conflict",
  "Personal emergency",
  "Tutor unavailable",
  "Other",
];

function isTodayOrLater(startsAt: string) {
  const start = new Date(startsAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return start.getTime() >= today.getTime();
}

function isOpenRequest(booking: Booking) {
  return requestStatuses.includes(booking.status);
}

export function BookingCenter() {
  const { tutorId, rescheduleId } = useLocalSearchParams<{
    tutorId?: string;
    rescheduleId?: string;
  }>();
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const tutorRole = user?.role === "tutor";
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [subject, setSubject] = useState("");
  const [sessionType, setSessionType] = useState<SessionType>("online");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] =
    useState<(typeof durationOptions)[number]>(60);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [editSlotId, setEditSlotId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [bookingTab, setBookingTab] = useState<BookingTab>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState(cancellationReasons[0]);
  const [customCancelReason, setCustomCancelReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewEligible, setReviewEligible] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);

  const days = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index + 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        return {
          key,
          day: date.toLocaleDateString(undefined, { weekday: "short" }),
          date: date.getDate(),
        };
      }),
    [],
  );
  const visibleBookings = useMemo(
    () =>
      bookings.filter((booking) => {
        if (bookingTab === "requests")
          return isOpenRequest(booking) && isTodayOrLater(booking.startsAt);
        if (bookingTab === "completed") return booking.status === "completed";
        if (bookingTab === "history")
          return (
            ["completed", "cancelled", "refund_pending", "refunded"].includes(
              booking.status,
            ) ||
            (isOpenRequest(booking) && !isTodayOrLater(booking.startsAt))
          );
        return ["confirmed", "paid", "scheduled", "live"].includes(
          booking.status,
        );
      }),
    [bookingTab, bookings],
  );
  const selectedSlotData = slots.find((slot) => slot._id === selectedSlot);
  const selectedDuration = selectedSlotData
    ? Math.round(
        (new Date(selectedSlotData.endsAt).getTime() -
          new Date(selectedSlotData.startsAt).getTime()) /
          60000,
      )
    : 0;
  const estimatedPrice = Math.round(
    ((selectedTutor?.profile?.hourlyRate || 1500) * selectedDuration) / 60,
  );
  const calendarDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() + index);
        const count = bookings.filter(
          (booking) =>
            new Date(booking.startsAt).toDateString() === date.toDateString() &&
            !["cancelled", "refunded"].includes(booking.status),
        ).length;
        return {
          key: date.toISOString(),
          weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
          day: date.getDate(),
          count,
        };
      }),
    [bookings],
  );

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const bookingData = await apiRequest<{ bookings: Booking[] }>(
        "/bookings",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setBookings(bookingData.bookings);
      if (rescheduleId) {
        const currentBooking = bookingData.bookings.find(
          (booking) => booking._id === rescheduleId,
        );
        if (currentBooking) setSubject(currentBooking.subject);
      }
      if (tutorRole) {
        const availability = await apiRequest<{ slots: Slot[] }>(
          "/availability/mine",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSlots(availability.slots);
      } else if (tutorId) {
        const [tutorData, availability] = await Promise.all([
          apiRequest<{ tutor: Tutor }>(`/tutors/${tutorId}`),
          apiRequest<{ slots: Slot[] }>(`/availability/tutor/${tutorId}`),
        ]);
        setSelectedTutor(tutorData.tutor);
        setSlots(availability.slots);
        setSubject(
          (current) =>
            current ||
            tutorData.tutor.profile?.subjects?.[0] ||
            "Tutoring session",
        );
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }, [rescheduleId, token, tutorId, tutorRole]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  useEffect(() => {
    if (tutorRole) return;
    bookings.forEach((booking) => {
      const shouldSchedule =
        booking.reminderEnabled &&
        ["confirmed", "scheduled"].includes(booking.status);
      if (shouldSchedule) void scheduleLessonReminders(booking);
      else void cancelLessonReminders(booking._id);
    });
  }, [bookings, tutorRole]);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      setBusy(true);
      setError("");
      setMessage("");
      await action();
      setMessage(success);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createAvailability() {
    if (!token || !selectedDate) return setError("Choose a date and time.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(selectedTime))
      return setError("Enter time in 24-hour HH:MM format.");
    const startsAt = new Date(
      `${selectedDate}T${selectedTime}:00`,
    ).toISOString();
    const saved = await run(
      () =>
        apiRequest(
          editSlotId ? `/availability/${editSlotId}` : "/availability",
          {
            method: editSlotId ? "PATCH" : "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ startsAt, durationMinutes, repeatWeeks }),
          },
        ),
      editSlotId
        ? "Availability updated."
        : repeatWeeks > 1
          ? `${repeatWeeks} weekly times published.`
          : "Availability published.",
    );
    if (saved) {
      setSelectedDate("");
      setEditSlotId("");
      setRepeatWeeks(1);
    }
  }

  function startEditAvailability(slot: Slot) {
    const startsAt = new Date(slot.startsAt);
    const localDate = `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, "0")}-${String(startsAt.getDate()).padStart(2, "0")}`;
    const localTime = `${String(startsAt.getHours()).padStart(2, "0")}:${String(startsAt.getMinutes()).padStart(2, "0")}`;
    const duration = Math.round(
      (new Date(slot.endsAt).getTime() - startsAt.getTime()) / 60000,
    ) as (typeof durationOptions)[number];
    setSelectedDate(localDate);
    setSelectedTime(localTime);
    setDurationMinutes(duration);
    setRepeatWeeks(1);
    setEditSlotId(slot._id);
  }

  async function submitBooking() {
    if (!token || !tutorId || !selectedSlot)
      return setError("Choose an available time.");
    if (rescheduleId) {
      const sent = await run(
        () =>
          apiRequest(`/bookings/${rescheduleId}/reschedule`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({ slotId: selectedSlot }),
          }),
        "Reschedule request sent.",
      );
      if (sent)
        router.setParams({ tutorId: undefined, rescheduleId: undefined });
    } else {
      const sent = await run(
        () =>
          apiRequest("/bookings", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              tutorId,
              slotId: selectedSlot,
              subject,
              sessionType,
            }),
          }),
        "Booking request sent to your tutor.",
      );
      if (!sent) return;
    }
    setSelectedSlot("");
    setConfirmOpen(false);
  }

  async function bookingAction(
    id: string,
    action: string,
    success: string,
    reminderEnabled?: boolean,
  ) {
    if (!token) return;
    const changed = await run(
      () =>
        apiRequest(`/bookings/${id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action, reminderEnabled }),
        }),
      success,
    );
    if (changed && action === "toggle_reminder") {
      const booking = bookings.find((item) => item._id === id);
      if (booking && reminderEnabled) {
        const scheduled = await scheduleLessonReminders(booking, true);
        if (!scheduled)
          setError(
            "Device notification permission was not granted. In-app reminders remain enabled.",
          );
      } else if (!reminderEnabled) await cancelLessonReminders(id);
    }
  }

  function confirmCancel(booking: Booking) {
    setCancelReason(cancellationReasons[0]);
    setCustomCancelReason("");
    setCancelTarget(booking);
  }

  async function submitCancellation() {
    if (!token || !cancelTarget) return;
    const reason =
      cancelReason === "Other"
        ? customCancelReason.trim() || "Other"
        : cancelReason;
    const cancelled = await run(
      () =>
        apiRequest(`/bookings/${cancelTarget._id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "cancel", reason }),
        }),
      "Booking cancelled.",
    );
    if (cancelled) {
      await cancelLessonReminders(cancelTarget._id);
      setCancelTarget(null);
    }
  }

  async function openReview(booking: Booking) {
    if (!token || !booking.tutor?._id) return;
    setReviewTarget(booking);
    setReviewRating(0);
    setReviewComment("");
    setReviewEligible(false);
    setHasExistingReview(false);
    setReviewError("");
    try {
      setReviewLoading(true);
      const data = await apiRequest<{
        canReview: boolean;
        review: { rating: number; comment?: string } | null;
      }>(`/tutors/${booking.tutor._id}/review-eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!data.canReview) {
        setReviewError("Complete a lesson with this tutor before rating them.");
        return;
      }
      setReviewEligible(true);
      if (data.review) {
        setReviewRating(data.review.rating);
        setReviewComment(data.review.comment || "");
        setHasExistingReview(true);
      }
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Could not load your review.",
      );
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReview() {
    if (!reviewSaving) setReviewTarget(null);
  }

  async function submitReview() {
    if (!token || !reviewTarget?.tutor?._id) return;
    if (!reviewRating) {
      setReviewError("Choose a star rating before submitting.");
      return;
    }
    try {
      setReviewSaving(true);
      setReviewError("");
      await apiRequest(`/tutors/${reviewTarget.tutor._id}/reviews`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment.trim(),
        }),
      });
      setReviewTarget(null);
      setMessage(
        hasExistingReview
          ? "Your rating and review were updated."
          : "Thanks! Your rating was submitted.",
      );
    } catch (err) {
      setReviewError(
        err instanceof Error ? err.message : "Could not submit your rating.",
      );
    } finally {
      setReviewSaving(false);
    }
  }

  function confirmRemoveAvailability(slot: Slot) {
    Alert.alert(
      "Remove availability?",
      "Learners will no longer be able to book this time.",
      [
        { text: "Keep time", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            token &&
            void run(
              () =>
                apiRequest(`/availability/${slot._id}`, {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                }),
              "Availability removed.",
            ),
        },
      ],
    );
  }

  const cancellingRequest = Boolean(
    cancelTarget &&
      ["pending", "reschedule_requested"].includes(cancelTarget.status),
  );

  return (
    <FeatureShell
      activeTab="bookings"
      title={tutorRole ? "Teaching schedule" : "My bookings"}
      subtitle={
        tutorRole
          ? "Publish availability and manage lesson requests."
          : "Request, reschedule and manage every tutoring session."
      }
    >
      <LinearGradient colors={["#201A50", "#5948D4"]} style={styles.summary}>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryLabel}>
            {tutorRole ? "UPCOMING TEACHING" : "LEARNING SCHEDULE"}
          </Text>
          <Text style={styles.summaryValue}>
            {
              bookings.filter((item) => {
                if (isOpenRequest(item) && !isTodayOrLater(item.startsAt))
                  return false;
                return [
                  "pending",
                  "confirmed",
                  "scheduled",
                  "live",
                  "reschedule_requested",
                ].includes(item.status);
              }).length
            }{" "}
            active sessions
          </Text>
          <Text style={styles.summarySub}>
            {
              bookings.filter(
                (item) => isOpenRequest(item) && isTodayOrLater(item.startsAt),
              ).length
            }{" "}
            requests waiting
          </Text>
          {!tutorRole && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open all bookings"
              onPress={() => router.push("/booking/my-bookings")}
              style={styles.allBookingsButton}
            >
              <Text style={styles.allBookingsButtonText}>All bookings</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
        <View style={styles.calendar}>
          <Ionicons name="calendar" size={25} color="#FFFFFF" />
        </View>
      </LinearGradient>

      <View style={[styles.weekCalendar, { backgroundColor: colors.surface }]}>
        <View style={styles.weekHeader}>
          <Text style={[styles.weekTitle, { color: colors.text }]}>
            This week
          </Text>
          <Text style={[styles.weekCaption, { color: colors.textMuted }]}>
            Scheduled lessons
          </Text>
        </View>
        <View style={styles.weekDays}>
          {calendarDays.map((day) => (
            <View
              key={day.key}
              style={[styles.weekDay, { backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[styles.weekDayName, { color: colors.textMuted }]}>
                {day.weekday}
              </Text>
              <Text style={[styles.weekDayNumber, { color: colors.text }]}>
                {day.day}
              </Text>
              <View
                style={[
                  styles.weekCount,
                  day.count > 0 && styles.weekCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.weekCountText,
                    day.count > 0 && styles.weekCountTextActive,
                  ]}
                >
                  {day.count}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {tutorRole && !user?.isVerified && (
        <View style={styles.verification}>
          <View style={styles.verificationIcon}>
            <Ionicons name="shield-outline" size={23} color="#B27618" />
          </View>
          <View style={styles.verificationCopy}>
            <Text style={styles.verificationTitle}>Verification required</Text>
            <Text style={styles.verificationText}>
              Complete tutor verification before publishing lesson times.
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            style={styles.verificationButton}
          >
            <Text style={styles.verificationButtonText}>Open profile</Text>
          </Pressable>
        </View>
      )}
      {tutorRole && user?.isVerified && (
        <View style={[styles.composer, { backgroundColor: colors.surface }]}>
          <Header
            icon="time"
            title="Publish availability"
            caption="Choose a date, start time and lesson duration"
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayRow}
          >
            {days.map((day) => (
              <Pressable
                key={day.key}
                onPress={() => setSelectedDate(day.key)}
                style={[
                  styles.day,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                  selectedDate === day.key && styles.dayActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayName,
                    { color: colors.textMuted },
                    selectedDate === day.key && styles.dayTextActive,
                  ]}
                >
                  {day.day}
                </Text>
                <Text
                  style={[
                    styles.dayNumber,
                    { color: colors.text },
                    selectedDate === day.key && styles.dayTextActive,
                  ]}
                >
                  {day.date}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.times}>
            {timeOptions.map((time) => (
              <Pressable
                key={time}
                onPress={() => setSelectedTime(time)}
                style={[
                  styles.time,
                  { backgroundColor: colors.surfaceMuted },
                  selectedTime === time && styles.timeActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeText,
                    { color: colors.textMuted },
                    selectedTime === time && styles.timeTextActive,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.optionLabel}>CUSTOM START TIME</Text>
          <TextInput
            value={selectedTime}
            onChangeText={setSelectedTime}
            placeholder="HH:MM (for example 13:30)"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            style={[
              styles.customTimeInput,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <Text style={styles.optionLabel}>LESSON DURATION</Text>
          <View style={styles.times}>
            {durationOptions.map((duration) => (
              <Pressable
                key={duration}
                onPress={() => setDurationMinutes(duration)}
                style={[
                  styles.time,
                  { backgroundColor: colors.surfaceMuted },
                  durationMinutes === duration && styles.timeActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeText,
                    { color: colors.textMuted },
                    durationMinutes === duration && styles.timeTextActive,
                  ]}
                >
                  {duration} min
                </Text>
              </Pressable>
            ))}
          </View>
          {!editSlotId && (
            <>
              <Text style={styles.optionLabel}>REPEAT</Text>
              <View style={styles.times}>
                {(
                  [
                    [1, "Once"],
                    [4, "4 weeks"],
                    [8, "8 weeks"],
                  ] as [number, string][]
                ).map(([weeks, label]) => (
                  <Pressable
                    key={weeks}
                    onPress={() => setRepeatWeeks(Number(weeks))}
                    style={[
                      styles.time,
                      { backgroundColor: colors.surfaceMuted },
                      repeatWeeks === weeks && styles.timeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        { color: colors.textMuted },
                        repeatWeeks === weeks && styles.timeTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Pressable
            disabled={busy || !selectedDate}
            onPress={createAvailability}
            style={[styles.primary, !selectedDate && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : reviewEligible ? (
              <>
                <Ionicons
                  name={editSlotId ? "save" : "add-circle"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryText}>
                  {editSlotId
                    ? "Save availability"
                    : repeatWeeks > 1
                      ? `Publish ${repeatWeeks} weekly times`
                      : "Publish lesson time"}
                </Text>
              </>
            ) : null}
          </Pressable>
        </View>
      )}

      {!tutorRole && selectedTutor && (
        <View style={[styles.composer, { backgroundColor: colors.surface }]}>
          <Header
            icon={rescheduleId ? "repeat" : "school"}
            title={
              rescheduleId ? "Choose a new time" : `Book ${selectedTutor.name}`
            }
            caption={
              rescheduleId
                ? "Your original time stays reserved until the tutor responds"
                : `Rs.${selectedTutor.profile?.hourlyRate?.toLocaleString() || "—"} per hour`
            }
          />
          {!rescheduleId && (
            <>
              <Text style={styles.optionLabel}>SESSION SUBJECT</Text>
              <View style={styles.subjectChoices}>
                {selectedTutor.profile?.subjects?.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setSubject(item)}
                    style={[
                      styles.subjectChoice,
                      { backgroundColor: colors.surfaceMuted },
                      subject === item && styles.subjectChoiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectChoiceText,
                        { color: colors.textMuted },
                        subject === item && styles.subjectChoiceTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Or enter another subject"
                style={[
                  styles.subjectInput,
                  { backgroundColor: colors.surfaceMuted, color: colors.text },
                ]}
              />
              <Text style={styles.optionLabel}>SESSION TYPE</Text>
              <View style={styles.sessionTypeChoices}>
                {(
                  [
                    ["online", "Online", "videocam-outline"],
                    ["in_person", "In-person", "people-outline"],
                  ] as const
                ).map(([value, label, icon]) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: sessionType === value }}
                    key={value}
                    onPress={() => setSessionType(value)}
                    style={[
                      styles.sessionTypeChoice,
                      { borderColor: colors.border },
                      sessionType === value && styles.sessionTypeChoiceActive,
                    ]}
                  >
                    <Ionicons
                      name={icon}
                      size={17}
                      color={sessionType === value ? "#FFFFFF" : "#655CF2"}
                    />
                    <Text
                      style={[
                        styles.sessionTypeChoiceText,
                        sessionType === value &&
                          styles.sessionTypeChoiceTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <View style={styles.slotGrid}>
            {slots.length ? (
              slots.map((slot) => {
                const date = new Date(slot.startsAt);
                return (
                  <Pressable
                    key={slot._id}
                    onPress={() => setSelectedSlot(slot._id)}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                      selectedSlot === slot._id && styles.slotActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotDay,
                        { color: colors.textMuted },
                        selectedSlot === slot._id && styles.slotTextActive,
                      ]}
                    >
                      {date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <Text
                      style={[
                        styles.slotTime,
                        { color: colors.text },
                        selectedSlot === slot._id && styles.slotTextActive,
                      ]}
                    >
                      {date.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={styles.emptyText}>
                This tutor has no available times yet.
              </Text>
            )}
          </View>
          <Pressable
            disabled={
              busy || !selectedSlot || (!rescheduleId && !subject.trim())
            }
            onPress={() => setConfirmOpen(true)}
            style={[
              styles.primary,
              (!selectedSlot || (!rescheduleId && !subject.trim())) &&
                styles.disabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryText}>
                  {rescheduleId ? "Review new time" : "Review booking"}
                </Text>
                <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      )}

      {!!error && (
        <View style={styles.error}>
          <Ionicons name="alert-circle" size={17} color={palette.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}
      {!!message && (
        <View style={styles.success}>
          <Ionicons name="checkmark-circle" size={17} color="#168B66" />
          <Text style={styles.successText}>{message}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {tutorRole ? "Lesson requests & schedule" : "Your sessions"}
        </Text>
        <Text style={styles.sectionCount}>{visibleBookings.length}</Text>
      </View>
      {!!bookings.length && (
        <View
          style={[styles.bookingTabs, { backgroundColor: colors.surfaceMuted }]}
        >
          {(
            [
              ["upcoming", "Upcoming"],
              ["requests", "Requests"],
              ["completed", "Completed"],
              ["history", "History"],
            ] as [BookingTab, string][]
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setBookingTab(key)}
              style={[
                styles.bookingTab,
                bookingTab === key && styles.bookingTabActive,
              ]}
            >
              <Text
                style={[
                  styles.bookingTabText,
                  bookingTab === key && styles.bookingTabTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {loading && <ActivityIndicator color="#655CF2" />}
      {!loading && !bookings.length && (
        <View style={[styles.empty, { backgroundColor: colors.surface }]}>
          <Ionicons name="calendar-outline" size={30} color="#655CF2" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No bookings yet
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {tutorRole
              ? "Publish availability to receive learner requests."
              : "Discover a tutor and choose an available time."}
          </Text>
          {!tutorRole && (
            <Pressable
              onPress={() => router.push("/discover")}
              style={styles.discover}
            >
              <Text style={styles.discoverText}>Discover tutors</Text>
            </Pressable>
          )}
        </View>
      )}
      {!loading && !!bookings.length && !visibleBookings.length && (
        <View style={[styles.empty, { backgroundColor: colors.surface }]}>
          <Ionicons name="file-tray-outline" size={28} color="#655CF2" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {bookingTab === "completed" ? "No completed sessions yet" : "Nothing here yet"}
          </Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {bookingTab === "completed"
              ? "Lessons marked complete by your tutor will appear here."
              : "Bookings with this status will appear here."}
          </Text>
        </View>
      )}
      {visibleBookings.map((booking) => (
        <BookingCard
          key={booking._id}
          booking={booking}
          tutorRole={tutorRole}
          showSessionActions={bookingTab !== "history"}
          onOpen={() =>
            router.push({
              pathname: "/session/[id]",
              params: { id: booking._id },
            })
          }
          onAction={bookingAction}
          onCancel={() => confirmCancel(booking)}
          onReschedule={() =>
            router.push({
              pathname: "/booking/reschedule",
              params: { bookingId: booking._id },
            })
          }
          onReview={() => void openReview(booking)}
        />
      ))}

      {tutorRole && slots.length > 0 && (
        <>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Published availability
            </Text>
            <Text style={styles.sectionCount}>{slots.length}</Text>
          </View>
          {slots.map((slot) => (
            <View
              key={slot._id}
              style={[styles.availability, { backgroundColor: colors.surface }]}
            >
              <View style={styles.availabilityIcon}>
                <Ionicons
                  name={slot.isBooked ? "lock-closed" : "time"}
                  size={18}
                  color={slot.isBooked ? "#D28B2D" : "#1A9D74"}
                />
              </View>
              <View style={styles.availabilityCopy}>
                <Text style={[styles.availabilityDate, { color: colors.text }]}>
                  {new Date(slot.startsAt).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text
                  style={[styles.availabilityTime, { color: colors.textMuted }]}
                >
                  {new Date(slot.startsAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  • {slot.isBooked ? "Booked" : "Open"}
                </Text>
              </View>
              {!slot.isBooked && (
                <View style={styles.slotActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit availability"
                    onPress={() => startEditAvailability(slot)}
                    style={styles.editSlot}
                  >
                    <Ionicons name="create-outline" size={16} color="#655CF2" />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove availability"
                    onPress={() => confirmRemoveAvailability(slot)}
                    style={styles.remove}
                  >
                    <Ionicons name="trash-outline" size={16} color="#C04F68" />
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </>
      )}

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalIcon}>
              <Ionicons
                name={rescheduleId ? "repeat" : "calendar"}
                size={23}
                color="#655CF2"
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {rescheduleId ? "Confirm new time" : "Confirm booking"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Check the lesson details before sending your request.
            </Text>
            {selectedTutor && (
              <View
                style={[
                  styles.bookingSummary,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <SummaryRow label="Tutor" value={selectedTutor.name} />
                <SummaryRow
                  label="Subject"
                  value={subject || "Tutoring session"}
                />
                <SummaryRow
                  label="Session type"
                  value={sessionType === "online" ? "Online" : "In-person"}
                />
                {selectedSlotData && (
                  <SummaryRow
                    label="Date & time"
                    value={new Date(selectedSlotData.startsAt).toLocaleString(
                      undefined,
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  />
                )}
                <SummaryRow
                  label="Duration"
                  value={`${selectedDuration} minutes`}
                />
                <SummaryRow
                  label="Estimated price"
                  value={`Rs.${estimatedPrice.toLocaleString()}`}
                />
                <SummaryRow
                  label="Credits required"
                  value={`${Math.max(1, Math.ceil(estimatedPrice / 100))} credits (checked now, charged at meeting unlock)`}
                />
              </View>
            )}
            {rescheduleId && (
              <Text style={styles.policyText}>
                Your original time remains reserved until the tutor accepts this
                request.
              </Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                disabled={busy}
                onPress={() => setConfirmOpen(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Go back</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={submitBooking}
                style={styles.confirmButton}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {rescheduleId ? "Request change" : "Send request"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!cancelTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalIcon, styles.dangerIcon]}>
              <Ionicons name="close-circle-outline" size={24} color="#C04F68" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {cancellingRequest ? "Cancel request?" : "Cancel booking?"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {cancellingRequest
                ? "This request has not been charged. Tell the tutor why you need to cancel."
                : "Tell the other person why you need to cancel."}
            </Text>
            <View style={styles.reasonChoices}>
              {cancellationReasons.map((reason) => (
                <Pressable
                  key={reason}
                  onPress={() => setCancelReason(reason)}
                  style={[
                    styles.reasonChoice,
                    cancelReason === reason && styles.reasonChoiceActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.reasonChoiceText,
                      cancelReason === reason && styles.reasonChoiceTextActive,
                    ]}
                  >
                    {reason}
                  </Text>
                </Pressable>
              ))}
            </View>
            {cancelReason === "Other" && (
              <TextInput
                value={customCancelReason}
                onChangeText={setCustomCancelReason}
                placeholder="Enter a short reason"
                style={[
                  styles.cancelInput,
                  { backgroundColor: colors.surfaceMuted, color: colors.text },
                ]}
                maxLength={240}
              />
            )}
            {!cancellingRequest && (
              <View style={styles.policy}>
                <Ionicons
                  name="information-circle-outline"
                  size={17}
                  color="#9B681B"
                />
                <Text style={styles.policyText}>
                  {tutorRole
                    ? "Tutor cancellation returns all charged credits to the learner."
                    : `Cancellation keeps a 20% fee (${Math.max(1, Math.ceil((cancelTarget?.creditCost || Math.max(1, Math.ceil((cancelTarget?.price || 0) / 100))) * 0.2))} credits). If the meeting was unlocked, the remaining credits are returned.`}{" "}
                  Cancellations close 2 hours before the session.
                </Text>
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable
                disabled={busy}
                onPress={() => setCancelTarget(null)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Keep booking</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={submitCancellation}
                style={styles.cancelButton}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Cancel booking</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!reviewTarget}
        transparent
        animationType="fade"
        onRequestClose={closeReview}
      >
        <View style={styles.modalBackdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalIcon}>
              <Ionicons name="star" size={24} color="#F0A02A" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {hasExistingReview ? "Update your rating" : "Rate your lesson"}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              How was your {reviewTarget?.subject} lesson with{" "}
              {reviewTarget?.tutor?.name || "your tutor"}?
            </Text>

            {reviewLoading ? (
              <ActivityIndicator style={styles.reviewLoader} color="#655CF2" />
            ) : (
              <>
                <View style={styles.ratingPicker}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`${value} star rating`}
                      accessibilityState={{ selected: reviewRating === value }}
                      disabled={reviewSaving}
                      onPress={() => {
                        setReviewRating(value);
                        setReviewError("");
                      }}
                      hitSlop={5}
                    >
                      <Ionicons
                        name={value <= reviewRating ? "star" : "star-outline"}
                        size={35}
                        color="#F0A02A"
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={[styles.reviewLabel, { color: colors.text }]}>
                  Review <Text style={styles.optionalText}>(optional)</Text>
                </Text>
                <TextInput
                  accessibilityLabel="Optional written review"
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  editable={!reviewSaving}
                  multiline
                  maxLength={500}
                  placeholder="What did you like about the lesson?"
                  placeholderTextColor="#999BA9"
                  style={[
                    styles.reviewInput,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Text
                  style={[styles.reviewCount, { color: colors.textMuted }]}
                >
                  {reviewComment.length}/500
                </Text>
              </>
            )}

            {!!reviewError && (
              <Text style={styles.reviewError}>{reviewError}</Text>
            )}
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={reviewSaving}
                onPress={closeReview}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Not now</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={
                  reviewLoading ||
                  reviewSaving ||
                  !reviewEligible ||
                  !reviewRating
                }
                onPress={submitReview}
                style={[
                  styles.confirmButton,
                  (reviewLoading ||
                    reviewSaving ||
                    !reviewEligible ||
                    !reviewRating) &&
                    styles.disabledButton,
                ]}
              >
                {reviewSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {hasExistingReview ? "Update" : "Submit"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </FeatureShell>
  );
}

function Header({
  icon,
  title,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name={icon} size={19} color="#655CF2" />
      </View>
      <View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.headerCaption, { color: colors.textMuted }]}>
          {caption}
        </Text>
      </View>
    </View>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryRowLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <Text style={[styles.summaryRowValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}
function BookingCard({
  booking,
  tutorRole,
  showSessionActions = true,
  onOpen,
  onAction,
  onCancel,
  onReschedule,
  onReview,
}: {
  booking: Booking;
  tutorRole: boolean;
  showSessionActions?: boolean;
  onOpen: () => void;
  onAction: (
    id: string,
    action: string,
    success: string,
    reminder?: boolean,
  ) => void;
  onCancel: () => void;
  onReschedule: () => void;
  onReview: () => void;
}) {
  const { colors } = useAppTheme();
  const date = new Date(booking.startsAt);
  const person = tutorRole ? booking.student?.name : booking.tutor?.name;
  const actionable =
    showSessionActions &&
    ["pending", "confirmed", "scheduled", "reschedule_requested"].includes(
      booking.status,
    );
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${booking.subject} session details`}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.cardMain,
          pressed && styles.cardPressed,
        ]}
      >
      <View style={styles.date}>
        <Text style={styles.dayNumberCard}>{date.getDate()}</Text>
        <Text style={styles.month}>
          {date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
        </Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: ["scheduled", "live", "completed"].includes(
                  booking.status,
                )
                  ? "#1BA67A"
                  : booking.status === "cancelled"
                    ? "#C6536C"
                    : "#F0A336",
              },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textMuted }]}>
            {booking.status.replace("_", " ").toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {booking.subject}
        </Text>
        <Text style={[styles.person, { color: colors.textMuted }]}>
          with {person || "Tutor Link member"}
        </Text>
        <Text style={styles.sessionTime}>
          {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{" "}
          • {booking.durationMinutes} min • Rs.{booking.price.toLocaleString()}
        </Text>
        <View style={styles.sessionTypeBadge}>
          <Ionicons
            name={
              (booking.sessionType || "online") === "online"
                ? "videocam-outline"
                : "people-outline"
            }
            size={12}
            color="#655CF2"
          />
          <Text style={styles.sessionTypeBadgeText}>
            {(booking.sessionType || "online") === "online"
              ? "Online"
              : "In-person"}
          </Text>
        </View>
        <Text style={styles.creditStatus}>
          {booking.creditCost || Math.max(1, Math.ceil(booking.price / 100))}{" "}
          credits · {booking.creditsCharged ? "meeting unlocked" : "not charged yet"}
        </Text>
        {!!booking.cancellationReason && (
          <View style={styles.cancellationDetail}>
            <Text style={styles.cancellationDetailText}>
              Cancelled by {booking.cancelledBy || "member"}:{" "}
              {booking.cancellationReason}
            </Text>
            {booking.status === "refund_pending" && (
              <Text style={styles.refundText}>Refund review pending</Text>
            )}
            {booking.status === "refunded" && (
              <Text style={styles.refundedText}>Refund completed</Text>
            )}
          </View>
        )}
      </View>
      </Pressable>
      <View style={styles.cardActions}>
        {tutorRole &&
          ["pending", "reschedule_requested"].includes(booking.status) && (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm booking"
                onPress={() =>
                  onAction(booking._id, "confirm", "Booking confirmed.")
                }
                style={styles.accept}
              >
                <Ionicons name="checkmark" size={17} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reject booking"
                onPress={() =>
                  onAction(booking._id, "reject", "Booking declined.")
                }
                style={styles.reject}
              >
                <Ionicons name="close" size={17} color="#B44E66" />
              </Pressable>
            </>
          )}
        {["confirmed", "scheduled", "live"].includes(booking.status) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open lesson session"
            onPress={() =>
              router.push({
                pathname: "/session/[id]",
                params: { id: booking._id },
              })
            }
            style={styles.join}
          >
            <Ionicons
              name={
                !tutorRole && booking.status === "confirmed"
                  ? "card"
                  : (booking.sessionType || "online") === "online"
                    ? "videocam"
                    : "people"
              }
              size={17}
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </View>
      {actionable && (
        <View style={styles.footerActions}>
          {!tutorRole && (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: booking.reminderEnabled }}
              accessibilityLabel="Lesson reminders"
              onPress={() =>
                onAction(
                  booking._id,
                  "toggle_reminder",
                  booking.reminderEnabled
                    ? "Reminder disabled."
                    : "Reminder enabled.",
                  !booking.reminderEnabled,
                )
              }
              style={styles.smallAction}
            >
              <Ionicons
                name={
                  booking.reminderEnabled
                    ? "notifications"
                    : "notifications-off-outline"
                }
                size={14}
                color="#655CF2"
              />
              <Text style={styles.smallActionText}>Reminder</Text>
            </Pressable>
          )}
          {!tutorRole && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reschedule booking"
              onPress={onReschedule}
              style={styles.smallAction}
            >
              <Ionicons name="repeat" size={14} color="#655CF2" />
              <Text style={styles.smallActionText}>Reschedule</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel booking"
            onPress={onCancel}
            style={styles.smallAction}
          >
            <Ionicons name="close-circle-outline" size={14} color="#C04F68" />
            <Text style={[styles.smallActionText, { color: "#C04F68" }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}
      {!tutorRole && booking.status === "completed" && (
        <View style={styles.reviewFooter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rate and review ${person || "this tutor"}`}
            onPress={onReview}
            style={styles.reviewAction}
          >
            <Ionicons name="star-outline" size={15} color="#655CF2" />
            <Text style={styles.reviewActionText}>Rate &amp; Review</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    minHeight: 128,
    borderRadius: 25,
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#2B235C",
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  summaryCopy: { flex: 1, paddingRight: 12 },
  summaryLabel: {
    color: "#C8C1F5",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1,
  },
  summaryValue: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 19,
    marginTop: 9,
  },
  summarySub: {
    color: "#CBC7E3",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 5,
  },
  allBookingsButton: {
    minHeight: 30,
    alignSelf: "flex-start",
    borderRadius: 10,
    marginTop: 12,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  allBookingsButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  calendar: {
    width: 49,
    height: 49,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  verification: {
    minHeight: 91,
    padding: 13,
    borderRadius: 22,
    backgroundColor: "#FFF8EA",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  verificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#FFEBC7",
    alignItems: "center",
    justifyContent: "center",
  },
  verificationCopy: { flex: 1, marginLeft: 10 },
  verificationTitle: {
    color: "#6A4818",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  verificationText: {
    color: "#8A704C",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    lineHeight: 12,
    marginTop: 3,
  },
  verificationButton: {
    height: 34,
    paddingHorizontal: 9,
    borderRadius: 11,
    backgroundColor: "#B27618",
    justifyContent: "center",
  },
  verificationButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  composer: {
    padding: 16,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    marginTop: 14,
    shadowColor: "#302B59",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },
  headerTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
  },
  headerCaption: {
    color: "#828495",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  dayRow: { gap: 7, paddingRight: 2 },
  day: {
    width: 50,
    height: 61,
    borderRadius: 16,
    backgroundColor: "#F5F3FA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E9E7F0",
  },
  dayActive: { backgroundColor: "#655CF2", borderColor: "#655CF2" },
  dayName: { color: "#858697", fontFamily: "Inter_700Bold", fontSize: 11 },
  dayNumber: {
    color: "#292B3C",
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
    marginTop: 3,
  },
  dayTextActive: { color: "#FFFFFF" },
  optionLabel: {
    color: "#8A8B9B",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.9,
    marginTop: 14,
  },
  times: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  time: {
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 11,
    backgroundColor: "#F5F3FA",
    justifyContent: "center",
  },
  timeActive: { backgroundColor: "#E5E1FF" },
  timeText: { color: "#737587", fontFamily: "Inter_700Bold", fontSize: 12 },
  timeTextActive: { color: "#5147C8" },
  primary: {
    height: 51,
    borderRadius: 16,
    backgroundColor: "#655CF2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 14,
  },
  primaryText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  disabled: { opacity: 0.45 },
  subjectInput: {
    height: 49,
    borderRadius: 15,
    paddingHorizontal: 13,
    backgroundColor: "#F7F6FB",
    color: "#202233",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginBottom: 12,
  },
  sessionTypeChoices: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 12,
  },
  sessionTypeChoice: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#FFFFFF",
  },
  sessionTypeChoiceActive: {
    backgroundColor: "#655CF2",
    borderColor: "#655CF2",
  },
  sessionTypeChoiceText: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  sessionTypeChoiceTextActive: { color: "#FFFFFF" },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  slot: {
    minWidth: "47%",
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#F5F3FA",
    borderWidth: 1.5,
    borderColor: "#E8E6EF",
  },
  slotActive: { backgroundColor: "#655CF2", borderColor: "#655CF2" },
  slotDay: { color: "#656778", fontFamily: "Inter_700Bold", fontSize: 11 },
  slotTime: {
    color: "#202233",
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    marginTop: 4,
  },
  slotTextActive: { color: "#FFFFFF" },
  error: {
    marginTop: 13,
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  errorText: {
    color: palette.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
  },
  success: {
    marginTop: 13,
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#EAF9F3",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  successText: {
    color: "#168B66",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
  },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 11,
  },
  sectionTitle: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 18,
  },
  sectionCount: {
    marginLeft: 7,
    minWidth: 23,
    height: 20,
    borderRadius: 8,
    backgroundColor: "#E6E2FF",
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textAlign: "center",
    textAlignVertical: "center",
  },
  empty: {
    padding: 25,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  emptyTitle: {
    color: "#232536",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
    marginTop: 8,
  },
  emptyText: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 14,
    textAlign: "center",
    marginTop: 4,
  },
  discover: {
    height: 37,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: "#655CF2",
    justifyContent: "center",
    marginTop: 12,
  },
  discoverText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  card: {
    minHeight: 139,
    borderRadius: 22,
    padding: 13,
    paddingBottom: 46,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 11,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.992 }] },
  cardMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  date: {
    width: 53,
    height: 68,
    borderRadius: 17,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumberCard: {
    color: "#4E43C7",
    fontFamily: "Manrope_700Bold",
    fontSize: 21,
  },
  month: { color: "#7169B6", fontFamily: "Inter_700Bold", fontSize: 11 },
  copy: { flex: 1, marginLeft: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: {
    color: "#838596",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  title: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
    marginTop: 5,
  },
  person: {
    color: "#77798C",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  sessionTime: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    marginTop: 5,
  },
  sessionTypeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#EFEDFF",
  },
  sessionTypeBadgeText: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  creditStatus: {
    color: "#77798C",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    marginTop: 5,
  },
  cardActions: { gap: 5 },
  accept: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#1DA979",
    alignItems: "center",
    justifyContent: "center",
  },
  reject: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFF0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  join: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#655CF2",
    alignItems: "center",
    justifyContent: "center",
  },
  footerActions: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 8,
    height: 30,
    borderTopWidth: 1,
    borderTopColor: "#F0EFF4",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  smallAction: { flexDirection: "row", alignItems: "center", gap: 3 },
  smallActionText: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  reviewAction: {
    minHeight: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFEDFF",
  },
  reviewFooter: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 7,
    height: 36,
    borderTopWidth: 1,
    borderTopColor: "#F0EFF4",
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  reviewActionText: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  availability: {
    minHeight: 69,
    padding: 11,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  availabilityIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#F0F8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  availabilityCopy: { flex: 1, marginLeft: 10 },
  availabilityDate: {
    color: "#292B3C",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  availabilityTime: {
    color: "#7D7F90",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
  remove: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FFF0F3",
    alignItems: "center",
    justifyContent: "center",
  },
  subjectChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 9,
  },
  subjectChoice: {
    minHeight: 34,
    borderRadius: 11,
    paddingHorizontal: 11,
    backgroundColor: "#F1EFF8",
    alignItems: "center",
    justifyContent: "center",
  },
  subjectChoiceActive: { backgroundColor: "#655CF2" },
  subjectChoiceText: {
    color: "#696B7C",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  subjectChoiceTextActive: { color: "#FFFFFF" },
  customTimeInput: {
    height: 43,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F7F6FB",
    color: "#202233",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E8E6EF",
  },
  retryText: { color: "#9F3F56", fontFamily: "Inter_700Bold", fontSize: 11 },
  bookingTabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 15,
    backgroundColor: "#EDEAF6",
    marginBottom: 12,
  },
  bookingTab: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  bookingTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#302B59",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  bookingTabText: {
    color: "#7B7D8D",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
  },
  bookingTabTextActive: { color: "#574CD3" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18,16,39,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 430,
    borderRadius: 25,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  dangerIcon: { backgroundColor: "#FFF0F3" },
  modalTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 11,
  },
  modalSubtitle: {
    color: "#7D7F90",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  bookingSummary: {
    borderRadius: 16,
    backgroundColor: "#F7F6FB",
    padding: 12,
    marginTop: 15,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },
  summaryRowLabel: {
    color: "#7D7F90",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  summaryRowValue: {
    flex: 1,
    color: "#242637",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    textAlign: "right",
  },
  modalActions: { flexDirection: "row", gap: 9, marginTop: 17 },
  reviewLoader: { marginVertical: 30 },
  ratingPicker: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 18,
  },
  reviewLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    marginBottom: 7,
  },
  optionalText: {
    color: "#8B8D9E",
    fontFamily: "Inter_400Regular",
  },
  reviewInput: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    textAlignVertical: "top",
  },
  reviewCount: {
    alignSelf: "flex-end",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    marginTop: 4,
  },
  reviewError: {
    color: "#B64660",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },
  disabledButton: { opacity: 0.48 },
  secondaryButton: {
    flex: 1,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#F0EEF6",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#606273",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  confirmButton: {
    flex: 1,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#655CF2",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    flex: 1,
    height: 45,
    borderRadius: 14,
    backgroundColor: "#C6536C",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
  reasonChoices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 15,
  },
  reasonChoice: {
    minHeight: 35,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: "#F3F1F7",
    alignItems: "center",
    justifyContent: "center",
  },
  reasonChoiceActive: { backgroundColor: "#FFE4EA" },
  reasonChoiceText: {
    color: "#666879",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  reasonChoiceTextActive: { color: "#A8435A" },
  cancelInput: {
    height: 45,
    borderRadius: 12,
    backgroundColor: "#F7F6FB",
    color: "#202233",
    paddingHorizontal: 12,
    marginTop: 9,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  policy: {
    flexDirection: "row",
    gap: 7,
    borderRadius: 13,
    backgroundColor: "#FFF8E9",
    padding: 10,
    marginTop: 13,
  },
  policyText: {
    flex: 1,
    color: "#806137",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
  },
  weekCalendar: { marginTop: 14, borderRadius: 21, padding: 13 },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  weekTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  weekCaption: { fontFamily: "Inter_400Regular", fontSize: 10 },
  weekDays: { flexDirection: "row", gap: 5 },
  weekDay: {
    flex: 1,
    minHeight: 70,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayName: { fontFamily: "Inter_700Bold", fontSize: 9 },
  weekDayNumber: { fontFamily: "Manrope_700Bold", fontSize: 14, marginTop: 3 },
  weekCount: {
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: "#E5E2ED",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  weekCountActive: { backgroundColor: "#655CF2" },
  weekCountText: { color: "#858697", fontFamily: "Inter_700Bold", fontSize: 8 },
  weekCountTextActive: { color: "#FFFFFF" },
  slotActions: { flexDirection: "row", gap: 6 },
  editSlot: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cancellationDetail: {
    marginTop: 7,
    borderRadius: 9,
    backgroundColor: "#FFF1F4",
    padding: 7,
  },
  cancellationDetailText: {
    color: "#9F455B",
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    lineHeight: 12,
  },
  refundText: {
    color: "#B27618",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    marginTop: 3,
  },
  refundedText: {
    color: "#168B66",
    fontFamily: "Inter_700Bold",
    fontSize: 9,
    marginTop: 3,
  },
});
