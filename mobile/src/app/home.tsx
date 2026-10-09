import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/constants/auth-theme";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { AppTopNav } from "@/components/app-top-nav";
import { apiRequest } from "@/services/api";
import { Tutor } from "@/features/lasiru/types";
import { TutorRequest } from "@/features/tutor-requests/types";

type Tab = "home" | "search" | "bookings" | "profile";
type HomePerson = { _id: string; name: string };
type HomeBooking = {
  _id: string;
  student: HomePerson;
  tutor: HomePerson;
  subject: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  sessionType?: "online" | "in_person";
  price?: number;
  creditCost?: number;
};
const activeBookingStatuses = ["confirmed", "paid", "scheduled", "live"];
const exploreSubjects: {
  label: string;
  query: string;
  match: RegExp;
  icon: keyof typeof Ionicons.glyphMap;
  background: string;
  darkBackground: string;
  accent: string;
}[] = [
  { label: "Programming", query: "Programming", match: /program|java|coding|python|web/i, icon: "code-slash", background: "#EDE7FF", darkBackground: "#2C2648", accent: "#6C5CE7" },
  { label: "Math", query: "Math", match: /math/i, icon: "calculator-outline", background: "#D8F6F2", darkBackground: "#143430", accent: "#12948C" },
  { label: "Database", query: "Database", match: /data\s*base|sql/i, icon: "server-outline", background: "#DFF6E8", darkBackground: "#143428", accent: "#1B9A58" },
  { label: "Networking", query: "Networking", match: /network/i, icon: "git-network-outline", background: "#FFE8CC", darkBackground: "#3A2814", accent: "#E07A12" },
];
const tutorAvatarColors = ["#6C5CE7", "#E07A9A", "#218E80", "#E07A12"];

export default function HomeScreen() {
  const { user, token, logout } = useAuth();
  const { isDark, colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>("home");
  const isTutor = user?.role === "tutor";
  const firstName =
    user?.name?.split(" ")[0] || (isTutor ? "Tutor" : "Learner");
  async function signOut() {
    await logout();
    router.replace("/");
  }
  function selectTab(next: Tab) {
    if (next === "search" && !isTutor) return router.push("/discover");
    if (next === "search" && isTutor) return router.push("/tutor-requests");
    if (next === "bookings") return router.push("/bookings");
    if (next === "profile") return router.push("/profile");
    setTab(next);
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(113,94,255,0.10)", "rgba(113,94,255,0)"]}
        style={styles.ambient}
      />
      <AppTopNav />
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {tab === "home" &&
          (isTutor ? (
            <TutorDashboard name={firstName} token={token} />
          ) : (
            <LearnerDashboard name={firstName} token={token} />
          ))}
        {tab !== "home" && (
          <EmptyPanel tab={tab} tutor={isTutor} onSignOut={signOut} />
        )}
      </ScrollView>
      <FloatingNav selected={tab} onSelect={selectTab} tutor={isTutor} />
    </SafeAreaView>
  );
}

function LearnerDashboard({
  name,
  token,
}: {
  name: string;
  token: string | null;
}) {
  const { isDark, colors } = useAppTheme();
  const [bookings, setBookings] = useState<HomeBooking[]>([]);
  const [creditBalance, setCreditBalance] = useState(0);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subjectCatalog, setSubjectCatalog] = useState<string[]>([]);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  useFocusEffect(useCallback(() => {
    apiRequest<{ tutors: Tutor[] }>("/tutors?sort=rating&limit=3")
      .then((data) => setTutors(data.tutors))
      .catch(() => undefined);
    apiRequest<{ subjects: string[] }>("/tutors/subjects")
      .then((data) => setSubjectCatalog(data.subjects))
      .catch(() => undefined);
    if (!token) return;
    apiRequest<{ bookings: HomeBooking[] }>("/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setBookings(data.bookings))
      .catch(() => undefined);
    apiRequest<{ balance: number }>("/credits", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => setCreditBalance(data.balance))
      .catch(() => undefined);
  }, [token]));

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = startOfWeek(now);
  const upcoming = bookings
    .filter((item) => activeBookingStatuses.includes(item.status) && new Date(item.startsAt).getTime() + item.durationMinutes * 60000 >= now.getTime())
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const completedThisMonth = bookings.filter((item) => item.status === "completed" && isWithin(item.startsAt, monthStart, nextMonthStart));
  const completedThisWeek = completedThisMonth.filter((item) => new Date(item.startsAt).getTime() >= weekStart.getTime());
  const plannedThisMonth = bookings.filter((item) => (
    (item.status === "completed" || activeBookingStatuses.includes(item.status))
    && isWithin(item.startsAt, monthStart, nextMonthStart)
  ));
  const progress = plannedThisMonth.length
    ? Math.round((completedThisMonth.length / plannedThisMonth.length) * 100)
    : 0;
  const nextSession = upcoming[0];
  const cells = calendarCells(visibleMonth);
  const upcomingDays = new Set(
    bookings.filter((item) => activeBookingStatuses.includes(item.status)).map((item) => dayKey(item.startsAt)),
  );
  const completedDays = new Set(
    bookings.filter((item) => item.status === "completed").map((item) => dayKey(item.startsAt)),
  );
  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    shadowColor: isDark ? "#000000" : "#2F295D",
  };

  function shiftMonth(amount: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  function openSubject(item: (typeof exploreSubjects)[number]) {
    const match = subjectCatalog.find((name) => item.match.test(name));
    router.push(match
      ? { pathname: "/discover", params: { subject: match } }
      : { pathname: "/discover", params: { q: item.query } });
  }

  return (
    <View style={styles.learnerDash}>
      <PageIntro
        title={`Ready to level up, ${name}?`}
        subtitle="See what's ahead, celebrate your progress, and find a tutor you'll love learning with."
      />
      <View style={styles.learnerSectionHead}>
        <Text style={[styles.learnerKicker, { color: colors.textMuted }]}>OVERVIEW</Text>
        <Text style={[styles.learnerSectionMeta, { color: colors.textMuted }]}>This Month</Text>
      </View>
      <View style={styles.learnerStatGrid}>
        <View style={styles.learnerStatRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open upcoming sessions"
          onPress={() => router.push("/bookings")}
          style={({ pressed }) => [styles.learnerStatCard, cardStyle, pressed && styles.cardPressed]}
        >
          <View style={styles.learnerStatTop}>
            <Text style={[styles.learnerStatLabel, { color: colors.textMuted }]}>Upcoming</Text>
            <View style={[styles.learnerStatIcon, { backgroundColor: isDark ? "#2A2750" : "#F1EEFF" }]}>
              <Ionicons name="calendar-outline" size={15} color="#6C5CE7" />
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.learnerStatValue, { color: colors.text }]}>{upcoming.length} Active</Text>
          <Text style={[styles.learnerStatHint, { color: upcoming[0] ? "#15966E" : colors.textMuted }]}>
            {upcoming[0] ? formatNextIn(upcoming[0].startsAt) : "Nothing scheduled"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open completed sessions"
          onPress={() => router.push("/bookings")}
          style={({ pressed }) => [styles.learnerStatCard, cardStyle, pressed && styles.cardPressed]}
        >
          <View style={styles.learnerStatTop}>
            <Text style={[styles.learnerStatLabel, { color: colors.textMuted }]}>Completed</Text>
            <View style={[styles.learnerStatIcon, { backgroundColor: isDark ? "#173328" : "#E7F8F0" }]}>
              <Ionicons name="checkmark-circle" size={16} color="#15966E" />
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.learnerStatValue, { color: colors.text }]}>
            {completedThisMonth.length} Session{completedThisMonth.length === 1 ? "" : "s"}
          </Text>
          <Text style={styles.learnerStatHintGreen}>+{completedThisWeek.length} this week</Text>
        </Pressable>
        </View>
        <View style={styles.learnerStatRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open session progress"
          onPress={() => router.push("/progress")}
          style={({ pressed }) => [styles.learnerStatCard, cardStyle, pressed && styles.cardPressed]}
        >
          <View style={styles.learnerStatTop}>
            <Text style={[styles.learnerStatLabel, { color: colors.textMuted }]}>Progress</Text>
            <View style={[styles.learnerStatIcon, { backgroundColor: isDark ? "#3A2C1A" : "#FFF3E4" }]}>
              <Ionicons name="trending-up" size={16} color="#E5922A" />
            </View>
          </View>
          <View style={styles.learnerProgressRow}>
            <Text style={[styles.learnerStatValue, { color: colors.text }]}>{progress}%</Text>
            <Text style={[styles.learnerTarget, { color: colors.textMuted }]}>
              {plannedThisMonth.length ? `${completedThisMonth.length} of ${plannedThisMonth.length}` : "No sessions"}
            </Text>
          </View>
          <View style={[styles.learnerProgressTrack, { backgroundColor: isDark ? "#2A2750" : "#EEEAF8" }]}>
            <View style={[styles.learnerProgressFill, { width: `${progress}%` }]} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Tutor Link credits"
          onPress={() => router.push("/credits")}
          style={({ pressed }) => [styles.learnerStatCard, cardStyle, pressed && styles.cardPressed]}
        >
          <View style={styles.learnerStatTop}>
            <Text style={[styles.learnerStatLabel, { color: colors.textMuted }]}>Credits</Text>
            <View style={[styles.learnerStatIcon, { backgroundColor: isDark ? "#1A2740" : "#E8F1FF" }]}>
              <Ionicons name="wallet-outline" size={15} color="#3B82F6" />
            </View>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={[styles.learnerStatValue, { color: colors.text }]}>{creditBalance.toLocaleString()}</Text>
          <Text style={styles.learnerStatHintGreen}>{formatCreditHours(creditBalance, bookings)}</Text>
        </Pressable>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customize your tutor recommendations"
        onPress={() => router.push("/find-tutor")}
        style={({ pressed }) => [
          styles.matchShortcut,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.cardPressed,
        ]}
      >
        <LinearGradient colors={["#7568F5", "#5143D3"]} style={styles.matchShortcutIcon}>
          <Ionicons name="color-wand" size={20} color="#FFFFFF" />
        </LinearGradient>
        <View style={styles.matchShortcutCopy}>
          <View style={styles.matchShortcutLabelRow}>
            <Text style={styles.matchShortcutEyebrow}>NEW HERE?</Text>
            <Text style={[styles.matchShortcutStep, { color: colors.textMuted }]}>Takes about 1 minute</Text>
          </View>
          <Text style={[styles.matchShortcutTitle, { color: colors.text }]}>Set Up My Tutor Match</Text>
          <Text style={[styles.matchShortcutText, { color: colors.textMuted }]}>Share your goals and get personalized tutor recommendations</Text>
        </View>
        <View style={styles.matchShortcutAction}><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></View>
      </Pressable>

      <Text style={[styles.learnerBlockTitle, { color: colors.text }]}>Explore subjects</Text>
      <View style={styles.exploreRow}>
        {exploreSubjects.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={`Browse ${item.label} tutors`}
            onPress={() => openSubject(item)}
            style={({ pressed }) => [
              styles.exploreCard,
              { backgroundColor: isDark ? item.darkBackground : item.background },
              pressed && styles.cardPressed,
            ]}
          >
            <View style={[styles.exploreIcon, { backgroundColor: item.accent }]}>
              <Ionicons name={item.icon} size={14} color="#FFFFFF" />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.exploreName, { color: isDark ? "#F7F4FF" : colors.text }]}>{item.label}</Text>
            <Text numberOfLines={2} style={[styles.exploreHint, { color: isDark ? "#C9C3E4" : "#7A748E" }]}>Browse tutors</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.learnerSectionHead}>
        <Text style={[styles.learnerBlockTitle, styles.learnerBlockTitleInline, { color: colors.text }]}>Verified tutors</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="View all verified tutors" hitSlop={8} onPress={() => router.push("/discover")}>
          <Text style={styles.learnerViewAll}>View All</Text>
        </Pressable>
      </View>
      {tutors.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find a tutor"
          onPress={() => router.push("/discover")}
          style={[styles.verifiedEmpty, cardStyle]}
        >
          <Ionicons name="people-outline" size={20} color={palette.primary} />
          <View style={styles.verifiedCopy}>
            <Text style={[styles.verifiedName, { color: colors.text }]}>No verified tutors yet</Text>
            <Text style={[styles.verifiedSubject, { color: colors.textMuted }]}>Browse subjects to find a match.</Text>
          </View>
        </Pressable>
      ) : tutors.map((tutor, index) => {
        const subject = tutor.profile?.subjects?.[0] || "University tutor";
        const status = tutorStatusLine(tutor);
        return (
          <Pressable
            key={tutor._id}
            accessibilityRole="button"
            accessibilityLabel={`View ${tutor.name}`}
            onPress={() => router.push({ pathname: "/tutor/[id]", params: { id: tutor._id } })}
            style={({ pressed }) => [styles.verifiedCard, cardStyle, pressed && styles.cardPressed]}
          >
            <View style={[styles.verifiedAvatar, { backgroundColor: tutorAvatarColors[index % tutorAvatarColors.length] }]}>
              <Text style={styles.verifiedInitials}>{initials(tutor.name)}</Text>
            </View>
            <View style={styles.verifiedCopy}>
              <Text numberOfLines={1} style={[styles.verifiedName, { color: colors.text }]}>{tutor.name}</Text>
              <Text numberOfLines={1} style={[styles.verifiedSubject, { color: colors.textMuted }]}>{subject}</Text>
              <View style={styles.verifiedStatusRow}>
                {status.isNew && (
                  <>
                    <Ionicons name="star" size={12} color="#F5B400" />
                    <Text style={styles.verifiedNew}>New</Text>
                  </>
                )}
                {status.isNew && !!status.availability && <Text style={[styles.verifiedStatusSep, { color: colors.textMuted }]}>·</Text>}
                {!!status.availability && (
                  <>
                    {!status.isNew && <View style={styles.verifiedStatusDot} />}
                    <Text style={styles.verifiedStatus}>{status.availability}</Text>
                  </>
                )}
                {!status.isNew && !status.availability && (
                  <Text style={[styles.verifiedStatus, { color: colors.textMuted }]}>Verified</Text>
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        );
      })}

      <View style={[styles.learnerCalendar, cardStyle]}>
        <View style={styles.learnerCalendarHead}>
          <View>
            <Text style={[styles.learnerCalendarTitle, { color: colors.text }]}>Schedule Calendar</Text>
            <Text style={[styles.learnerCalendarMonth, { color: colors.textMuted }]}>
              {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
          </View>
          <View style={[styles.learnerMonthPager, { backgroundColor: isDark ? colors.surfaceMuted : "#F4F2FA" }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} onPress={() => shiftMonth(-1)} style={styles.learnerMonthButton}>
              <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
            </Pressable>
            <Text style={[styles.learnerMonthLabel, { color: colors.text }]}>
              {visibleMonth.toLocaleDateString(undefined, { month: "short" })}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} onPress={() => shiftMonth(1)} style={styles.learnerMonthButton}>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        </View>
        <View style={styles.learnerWeekRow}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <Text key={day} style={[styles.learnerWeekday, { color: colors.textMuted }]}>{day}</Text>
          ))}
        </View>
        <View style={styles.learnerDayGrid}>
          {cells.map((cell) => {
            const key = dayKey(cell.date);
            const selected = sameDay(cell.date, selectedDate);
            const hasUpcoming = upcomingDays.has(key);
            const hasCompleted = completedDays.has(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={cell.date.toDateString()}
                onPress={() => {
                  setSelectedDate(startOfDay(cell.date));
                  if (!cell.inMonth) setVisibleMonth(startOfMonth(cell.date));
                }}
                style={styles.learnerDayCell}
              >
                <View style={[styles.learnerDayBubble, selected && styles.learnerDaySelected]}>
                  <Text
                    style={[
                      styles.learnerDayText,
                      { color: selected ? "#FFFFFF" : cell.inMonth ? colors.text : colors.textMuted },
                      !cell.inMonth && !selected && styles.learnerDayOutside,
                    ]}
                  >
                    {cell.date.getDate()}
                  </Text>
                </View>
                <View style={styles.learnerDotRow}>
                  {hasUpcoming && <View style={styles.learnerDotUpcoming} />}
                  {hasCompleted && <View style={styles.learnerDotCompleted} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.learnerLegend, { borderTopColor: colors.border }]}>
          <View style={styles.learnerLegendItem}>
            <View style={styles.learnerDotUpcoming} />
            <Text style={[styles.learnerLegendText, { color: colors.textMuted }]}>Upcoming Class</Text>
          </View>
          <View style={styles.learnerLegendItem}>
            <View style={styles.learnerDotCompleted} />
            <Text style={[styles.learnerLegendText, { color: colors.textMuted }]}>Completed</Text>
          </View>
        </View>
      </View>

      <View style={styles.learnerSectionHead}>
        <Text style={[styles.learnerBlockTitle, styles.learnerBlockTitleInline, { color: colors.text }]}>Upcoming session</Text>
        {upcoming.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View all upcoming sessions"
            hitSlop={8}
            onPress={() => router.push("/bookings")}
          >
            <Text style={styles.learnerViewAll}>View all</Text>
          </Pressable>
        )}
      </View>
      {nextSession ? (
        <View style={[styles.upcomingSessionCard, cardStyle]}>
          <View style={styles.upcomingSessionTop}>
            <View style={styles.upcomingSessionAvatar}>
              <Text style={styles.upcomingSessionInitials}>{initials(nextSession.tutor?.name || "Tutor")}</Text>
            </View>
            <View style={styles.upcomingSessionCopy}>
              <Text numberOfLines={1} style={[styles.upcomingSessionSubject, { color: colors.text }]}>{nextSession.subject}</Text>
              <Text numberOfLines={1} style={[styles.upcomingSessionTutor, { color: colors.textMuted }]}>
                with {nextSession.tutor?.name || "your tutor"}
              </Text>
            </View>
            <View style={[styles.upcomingSessionMode, { backgroundColor: isDark ? "#2A2750" : "#EFEDFF" }]}>
              <Ionicons name={nextSession.sessionType === "in_person" ? "people" : "videocam"} size={12} color="#655CF2" />
              <Text style={styles.upcomingSessionModeText}>
                {nextSession.sessionType === "in_person" ? "In-person" : "Online"}
              </Text>
            </View>
          </View>
          <View style={[styles.upcomingSessionTiming, { backgroundColor: isDark ? colors.surfaceMuted : "#F0EFFF" }]}>
            <Ionicons name="time-outline" size={16} color="#655CF2" />
            <Text numberOfLines={1} style={[styles.upcomingSessionWhen, { color: colors.text }]}>
              {new Date(nextSession.startsAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              {" · "}{nextSession.durationMinutes} min
            </Text>
            <Text style={styles.upcomingSessionCountdown}>{formatNextIn(nextSession.startsAt)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${nextSession.subject} session`}
            onPress={() => router.push({ pathname: "/session/[id]", params: { id: nextSession._id } })}
            style={({ pressed }) => [styles.upcomingSessionButton, pressed && styles.cardPressed]}
          >
            <Text style={styles.upcomingSessionButtonText}>Open session</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Find a tutor"
          onPress={() => router.push("/discover")}
          style={[styles.upcomingSessionEmpty, cardStyle]}
        >
          <Ionicons name="calendar-outline" size={20} color={palette.primary} />
          <View style={styles.upcomingSessionCopy}>
            <Text style={[styles.upcomingSessionSubject, { color: colors.text }]}>No upcoming sessions</Text>
            <Text style={[styles.upcomingSessionTutor, { color: colors.textMuted }]}>Book a tutor and your next lesson will show up here.</Text>
          </View>
        </Pressable>
      )}
    </View>
  );
}

function TutorDashboard({ name, token }: { name: string; token: string | null }) {
  const { colors, isDark } = useAppTheme();
  const [bookings, setBookings] = useState<HomeBooking[]>([]);
  const [tutorRequests, setTutorRequests] = useState<TutorRequest[]>([]);
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const weeklyEarnings = [1400, 2200, 1800, 2600, 3500, 600, 400];
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const pendingRequests = tutorRequests.filter((item) => item.status === "pending");
  const featuredRequest = pendingRequests[0];
  const activeSessions = bookings
    .filter((item) => ["confirmed", "paid", "scheduled", "live"].includes(item.status))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const nextSession = activeSessions[0];
  const todayKey = new Date().toDateString();
  const completedToday = bookings.filter((item) => item.status === "completed" && new Date(item.startsAt).toDateString() === todayKey).length;
  const upcomingToday = activeSessions.filter((item) => new Date(item.startsAt).toDateString() === todayKey).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const [bookingData, requestData] = await Promise.all([
      apiRequest<{ bookings: HomeBooking[] }>("/bookings", { headers }),
      apiRequest<{ requests: TutorRequest[] }>("/tutor-requests", { headers }),
    ]);
    setBookings(bookingData.bookings);
    setTutorRequests(requestData.requests);
  }, [token]);

  useFocusEffect(useCallback(() => {
    void loadDashboard().catch(() => setRequestMessage("Could not refresh tutor requests."));
  }, [loadDashboard]));

  async function respondToRequest(action: "accept" | "reject") {
    if (!token || !featuredRequest || requestBusy) return;
    try {
      setRequestBusy(true);
      setRequestMessage("");
      await apiRequest(`/tutor-requests/${featuredRequest._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      setRequestMessage(
        action === "accept"
          ? "Tutor request accepted. The learner has been notified."
          : "Tutor request declined. The learner has been notified.",
      );
      await loadDashboard();
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : "Could not update this request.");
    } finally {
      setRequestBusy(false);
    }
  }

  return (
    <>
      <View style={styles.tutorWelcome}>
        <View style={styles.tutorIntro}>
          <PageIntro
            title={`${greeting}, ${name}`}
            subtitle="Your learners are waiting. Open today's session, answer new requests, and keep inspiring."
          />
        </View>
        <Pressable onPress={() => router.push("/bookings")} style={styles.availablePill}>
          <View style={styles.availablePulse} />
          <Text style={styles.availablePillText}>Available</Text>
        </Pressable>
      </View>

      <DashboardSectionHeader
        title="Today&apos;s Sessions"
        meta={`${completedToday} Completed • ${upcomingToday} Upcoming`}
        onPress={() => router.push("/bookings")}
      />
      {nextSession ? (
        <View style={[styles.todaySessionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.todaySessionTop}>
            <View style={styles.learnerAvatar}>
              <Text style={styles.learnerAvatarText}>{initials(nextSession.student?.name || "Student")}</Text>
            </View>
            <View style={styles.todaySessionCopy}>
              <Text style={[styles.todaySessionName, { color: colors.text }]}>{nextSession.student?.name || "Learner"}</Text>
              <Text style={[styles.todaySessionSubject, { color: colors.textMuted }]}>{nextSession.subject} • {nextSession.durationMinutes} min</Text>
            </View>
            <View style={styles.sessionMode}>
              <Ionicons name={nextSession.sessionType === "in_person" ? "people" : "videocam"} size={11} color="#655CF2" />
              <Text style={styles.sessionModeText}>{nextSession.sessionType === "in_person" ? "In-person" : "Jitsi"}</Text>
            </View>
          </View>
          <View style={[styles.sessionTiming, { backgroundColor: isDark ? colors.surfaceMuted : "#F0EFFF" }]}>
            <Ionicons name="time-outline" size={15} color="#655CF2" />
            <Text style={[styles.sessionTimingText, { color: colors.text }]}>{new Date(nextSession.startsAt).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}</Text>
            <View style={styles.sessionCountdownWrap}>
              <View style={styles.sessionCountdownDot} />
              <Text style={styles.sessionCountdown}>{nextSession.status.replace("_", " ").toUpperCase()}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: "/session/[id]", params: { id: nextSession._id } })}
            style={({ pressed }) => [styles.startSessionButton, pressed && styles.cardPressed]}
          >
            <Text style={styles.startSessionText}>Open Session</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => router.push("/bookings")} style={[styles.noTutors, { backgroundColor: colors.surface }]}>
          <Ionicons name="calendar-outline" size={20} color={palette.primary} />
          <View><Text style={[styles.noTutorsTitle, { color: colors.text }]}>No upcoming sessions</Text><Text style={[styles.noTutorsText, { color: colors.textMuted }]}>Accepted lessons will appear here.</Text></View>
        </Pressable>
      )}

      <DashboardSectionHeader
        title="Pending Requests"
        meta={pendingRequests.length ? `${pendingRequests.length} New` : "All Clear"}
        warning={pendingRequests.length > 0}
        onPress={() => router.push("/tutor-requests")}
      />
      <View style={[styles.requestPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {featuredRequest ? <>
          <View style={styles.requestLine}>
            <View style={styles.requestAvatarSmall}>
              <Text style={styles.requestAvatarText}>{featuredRequest.student.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</Text>
            </View>
            <View style={styles.requestLineCopy}>
              <View style={styles.requestNameRow}>
                <Text style={[styles.requestLineName, { color: colors.text }]}>{featuredRequest.student.name}</Text>
                <Text style={[styles.requestGrade, { color: colors.textMuted }]}>{featuredRequest.student.profile?.studyLevel || "Learner"}</Text>
              </View>
              <Text style={[styles.requestLineSubject, { color: colors.textMuted }]} numberOfLines={1}>Wants to connect with you as a tutor</Text>
              <View style={styles.requestTimeRow}>
                <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                <Text style={[styles.requestTimeText, { color: colors.textMuted }]}>Sent {new Date(featuredRequest.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</Text>
              </View>
            </View>
          </View>
          <View style={[styles.requestNotice, { backgroundColor: isDark ? colors.surfaceMuted : "#F0EFFF" }]}>
            <Ionicons name="information-circle-outline" size={15} color="#655CF2" />
            <Text style={[styles.requestNoticeText, { color: colors.textMuted }]}>{pendingRequests.length} request{pendingRequests.length === 1 ? "" : "s"} awaiting your acceptance</Text>
          </View>
          <View style={styles.dashboardRequestActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reject booking request"
              disabled={requestBusy}
              onPress={() => void respondToRequest("reject")}
              style={[styles.dashboardRejectButton, requestBusy && styles.dashboardActionDisabled]}
            >
              <Ionicons name="close" size={16} color="#B84963" />
              <Text style={styles.dashboardRejectText}>Reject</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Accept booking request"
              disabled={requestBusy}
              onPress={() => void respondToRequest("accept")}
              style={[styles.dashboardAcceptButton, requestBusy && styles.dashboardActionDisabled]}
            >
              {requestBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Ionicons name="checkmark" size={16} color="#FFFFFF" /><Text style={styles.dashboardAcceptText}>Accept</Text></>}
            </Pressable>
          </View>
        </> : <View style={styles.requestsComplete}><Ionicons name="checkmark-circle" size={23} color="#15966E" /><View><Text style={[styles.requestsCompleteTitle, { color: colors.text }]}>All caught up</Text><Text style={[styles.requestsCompleteText, { color: colors.textMuted }]}>You have reviewed every booking request.</Text></View></View>}
        {!!requestMessage && <Text style={[styles.dashboardRequestMessage, { color: colors.textMuted }]}>{requestMessage}</Text>}
        <Pressable onPress={() => router.push("/tutor-requests")} style={[styles.viewRequestsButton, { backgroundColor: isDark ? colors.surfaceMuted : "#EFEDFF" }]}>
          <Text style={styles.viewRequestsText}>{pendingRequests.length ? `View Requests (${pendingRequests.length})` : "View Request History"}</Text>
          <Ionicons name="arrow-forward" size={14} color="#655CF2" />
        </Pressable>
      </View>

      <DashboardSectionHeader title="Weekly Earnings" meta="This Week" onPress={() => router.push("/payments")} />
      <Pressable onPress={() => router.push("/payments")} style={[styles.weeklyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.weeklyTop}>
          <View><Text style={[styles.weeklyLabel, { color: colors.textMuted }]}>GROSS TOTAL</Text><Text style={[styles.weeklyValue, { color: colors.text }]}>Rs. 12,500</Text></View>
          <View style={styles.growthPill}><Ionicons name="trending-up" size={12} color="#15966E" /><Text style={styles.growthText}>+18%</Text></View>
        </View>
        <View style={styles.chart}>
          {weeklyEarnings.map((amount, index) => (
            <View key={dayLabels[index]} style={styles.chartColumn}>
              <View style={styles.chartTrack}><LinearGradient colors={index === 4 ? ["#7C6DF8", "#5245DA"] : ["#E4E1FA", "#D6D2F4"]} style={[styles.chartBar, { height: `${Math.max(12, Math.round((amount / 3500) * 100))}%` }]} /></View>
              <Text style={[styles.chartDay, index === 4 && styles.chartDayActive]}>{dayLabels[index]}</Text>
            </View>
          ))}
        </View>
        <View style={styles.weeklyFooter}>
          <View style={styles.sessionsCompleted}>
            <Ionicons name="checkmark-circle-outline" size={13} color="#15966E" />
            <Text style={[styles.weeklyFooterText, { color: colors.textMuted }]}>4 sessions completed</Text>
          </View>
          <Text style={[styles.weeklyFooterText, { color: colors.textMuted }]}>Next payout: Friday</Text>
        </View>
      </Pressable>
    </>
  );
}

function DashboardSectionHeader({ title, meta, warning, onPress }: { title: string; meta: string; warning?: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.dashboardSectionHeader}><Text style={[styles.dashboardSectionTitle, { color: colors.text }]}>{title}</Text><Pressable onPress={onPress} style={[styles.dashboardMeta, warning && styles.dashboardMetaWarning]}><Text style={[styles.dashboardMetaText, warning && styles.dashboardMetaWarningText]}>{meta}</Text></Pressable></View>;
}

export function TutorDashboardLegacy({
  name,
  token,
}: {
  name: string;
  token: string | null;
}) {
  const { colors } = useAppTheme();
  const [earnings, setEarnings] = useState({
    total: 0,
    available: 0,
    pending: 0,
    paidSessions: 0,
  });
  const [bookings, setBookings] = useState<HomeBooking[]>([]);
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      apiRequest<{ earnings: typeof earnings }>("/payments/earnings", {
        headers,
      }),
      apiRequest<{ bookings: HomeBooking[] }>("/bookings", { headers }),
    ])
      .then(([paymentData, bookingData]) => {
        setEarnings(paymentData.earnings);
        setBookings(bookingData.bookings);
      })
      .catch(() => undefined);
  }, [token]);
  const requests = bookings.filter((item) =>
    ["pending", "reschedule_requested"].includes(item.status),
  );
  const nextLesson = bookings
    .filter((item) => ["confirmed", "scheduled", "live"].includes(item.status))
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )[0];
  return (
    <>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>TEACH • INSPIRE • EARN</Text>
          <Text style={[styles.pageTitle, { color: colors.text }]}>
            Ready to make an{`\n`}impact, {name}?
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.push("/profile")}
          style={({ pressed }) => [
            styles.avatar,
            pressed && styles.avatarPressed,
          ]}
        >
          <Text style={styles.avatarText}>{name[0]}</Text>
          <View style={[styles.onlineDot, { borderColor: colors.background }]} />
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="View demo earnings and payments" onPress={() => router.push('/payments')}><LinearGradient
        colors={["#171636", "#5544D6", "#806BFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.earningCard}
      >
        <View style={styles.earningTop}>
          <View>
            <Text style={styles.earningLabel}>DEMO EARNINGS</Text>
            <Text style={styles.earningValue}>
              Rs. {earnings.total.toLocaleString()}
            </Text>
          </View>
          <View style={styles.wallet}>
            <Ionicons name="wallet" size={21} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.earningBottom}>
          <Text style={styles.earningTrend}>
            Rs. {earnings.available.toLocaleString()} available
          </Text>
          <View style={styles.withdraw}>
            <Text style={styles.withdrawText}>
              Rs. {earnings.pending.toLocaleString()} pending
            </Text>
          </View>
        </View>
      </LinearGradient></Pressable>
      <View style={[styles.statsRow, { backgroundColor: colors.background }]}>
        <Stat
          icon="card"
          value={String(earnings.paidSessions)}
          label="Paid sessions"
          color="#655CF6"
        />
        <Stat icon="calendar" value={String(bookings.filter((item) => ['confirmed', 'scheduled', 'live'].includes(item.status)).length)} label="Upcoming" color="#F19B3F" />
        <Stat
          icon="wallet"
          value={`Rs.${earnings.available.toLocaleString()}`}
          label="Available"
          color="#20A47A"
        />
      </View>
      <SectionTitle
        title="New lesson requests"
        action="View all"
        onPress={() => router.push("/bookings")}
      />
      {requests.slice(0, 2).map((booking) => (
        <RequestCard
          key={booking._id}
          initials={
            booking.student?.name
              ?.split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2) || "ST"
          }
          name={booking.student?.name || "Learner"}
          subject={booking.subject}
          time={new Date(booking.startsAt).toLocaleString(undefined, {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          onPress={() => router.push("/bookings")}
        />
      ))}
      {!requests.length && (
        <Pressable
          onPress={() => router.push("/bookings")}
          style={styles.noTutors}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={palette.primary}
          />
          <View>
            <Text style={styles.noTutorsTitle}>No pending requests</Text>
            <Text style={styles.noTutorsText}>
              New learner bookings will appear here.
            </Text>
          </View>
        </Pressable>
      )}
      <SectionTitle
        title="Next teaching session"
        action="Manage"
        onPress={() => router.push("/bookings")}
      />
      {nextLesson ? (
        <Pressable
          onPress={() =>
            router.push({
              pathname: "/session/[id]",
              params: { id: nextLesson._id },
            })
          }
          style={styles.scheduleCard}
        >
          <View style={styles.timeRail}>
            <Text style={styles.scheduleTime}>
              {new Date(nextLesson.startsAt)
                .toLocaleTimeString([], { hour: "numeric" })
                .replace(/\s?[AP]M/i, "")}
            </Text>
            <Text style={styles.schedulePeriod}>
              {new Date(nextLesson.startsAt)
                .toLocaleTimeString([], { hour: "numeric" })
                .match(/[AP]M/i)?.[0] || ""}
            </Text>
          </View>
          <View style={styles.scheduleLine} />
          <View style={styles.scheduleCopy}>
            <Text style={styles.scheduleTitle}>{nextLesson.subject}</Text>
            <Text style={styles.scheduleStudent}>
              with {nextLesson.student?.name || "Learner"} •{" "}
              {nextLesson.durationMinutes} min
            </Text>
          </View>
          <View style={styles.videoButton}>
            <Ionicons
              name={
                nextLesson.status === "confirmed" ? "hourglass" : "videocam"
              }
              size={16}
              color={palette.primary}
            />
          </View>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push("/bookings")}
          style={styles.noTutors}
        >
          <Ionicons name="calendar-outline" size={20} color={palette.primary} />
          <View>
            <Text style={styles.noTutorsTitle}>Schedule is clear</Text>
            <Text style={styles.noTutorsText}>
              Publish availability to receive bookings.
            </Text>
          </View>
        </Pressable>
      )}
    </>
  );
}

function SectionTitle({
  title,
  action,
  onPress,
}: {
  title: string;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionTitle}>
      <Text style={[styles.sectionText, { color: colors.text }]}>{title}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${action} ${title}`}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.sectionActionButton,
          { backgroundColor: colors.softPurple },
          pressed && styles.actionPressed,
        ]}
      >
        <Text style={styles.sectionAction}>{action}</Text>
        <Ionicons name="chevron-forward" size={14} color={palette.primary} />
      </Pressable>
    </View>
  );
}
function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}
function RequestCard({
  initials,
  name,
  subject,
  time,
  onPress,
}: {
  initials: string;
  name: string;
  subject: string;
  time: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.requestCard, { backgroundColor: colors.surface }]}
    >
      <View
        style={[styles.requestAvatar, { backgroundColor: colors.softPurple }]}
      >
        <Text style={styles.requestInitials}>{initials}</Text>
      </View>
      <View style={styles.requestCopy}>
        <Text style={[styles.requestName, { color: colors.text }]}>{name}</Text>
        <Text style={[styles.requestSubject, { color: colors.textMuted }]}>
          {subject}
        </Text>
        <Text style={styles.requestTime}>{time}</Text>
      </View>
      <View
        style={[styles.arrowButton, { backgroundColor: colors.softPurple }]}
      >
        <Ionicons name="arrow-forward" size={14} color={palette.primary} />
      </View>
    </Pressable>
  );
}

function EmptyPanel({
  tab,
  tutor,
  onSignOut,
}: {
  tab: Tab;
  tutor: boolean;
  onSignOut: () => void;
}) {
  const config =
    tab === "search"
      ? {
          icon: "search" as const,
          title: tutor ? "Student requests" : "Discover tutors",
          text: tutor
            ? "New students looking for your expertise will appear here."
            : "Search by subject, rating, price, and availability.",
        }
      : tab === "bookings"
        ? {
            icon: "calendar" as const,
            title: tutor ? "Teaching schedule" : "Your bookings",
            text: "All upcoming and completed sessions in one beautiful place.",
          }
        : {
            icon: "person" as const,
            title: "Your profile",
            text: "Manage account details, preferences, and Tutor Link settings.",
          };
  return (
    <View style={styles.empty}>
      <LinearGradient colors={["#7B6DFF", "#5144D5"]} style={styles.emptyIcon}>
        <Ionicons name={config.icon} size={34} color="#FFFFFF" />
      </LinearGradient>
      <Text style={styles.emptyTitle}>{config.title}</Text>
      <Text style={styles.emptyText}>{config.text}</Text>
      {tab === "profile" && (
        <Pressable style={styles.signOut} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={17} color="#B74661" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      )}
    </View>
  );
}

function FloatingNav({
  selected,
  onSelect,
  tutor,
}: {
  selected: Tab;
  onSelect: (tab: Tab) => void;
  tutor: boolean;
}) {
  const { isDark, colors } = useAppTheme();
  const tabs: {
    key: Tab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: "home", label: tutor ? "Dashboard" : "Home", icon: "home" },
    {
      key: "search",
      label: tutor ? "Requests" : "Discover",
      icon: tutor ? "mail-unread" : "search",
    },
    {
      key: "bookings",
      label: tutor ? "Schedule" : "Bookings",
      icon: "calendar",
    },
    { key: "profile", label: "Profile", icon: "person" },
  ];
  return (
    <View style={[styles.navShadow, { shadowColor: isDark ? "#000000" : "#211B4B" }]}>
      <View style={[styles.nav, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {tabs.map((item) => {
          const active = selected === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => onSelect(item.key)}
              style={styles.navItem}
            >
              {active ? (
                <LinearGradient
                  colors={["#776CF7", "#574BDB"]}
                  style={styles.activePill}
                >
                  <Ionicons name={item.icon} size={19} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <Ionicons
                  name={
                    `${item.icon}-outline` as keyof typeof Ionicons.glyphMap
                  }
                  size={21}
                  color={colors.inactive}
                />
              )}
              <Text style={[styles.navLabel, { color: active ? palette.primary : colors.inactive }, active && styles.navLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function PageIntro({ title, subtitle }: { title: string; subtitle: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.pageIntro}>
      <View style={styles.pageIntroEyebrow}>
        <View style={styles.pageIntroDot} />
        <Text style={styles.pageIntroLabel}>HOME</Text>
      </View>
      <Text style={[styles.pageIntroTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.pageIntroSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    </View>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(value: Date | string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isWithin(value: string, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function formatNextIn(startsAt: string) {
  const minutes = Math.round((new Date(startsAt).getTime() - Date.now()) / 60000);
  if (minutes <= 0) return "In progress";
  if (minutes < 60) return `Next in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Next in ${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `Next in ${days} days`;
}

function tutorStatusLine(tutor: Tutor) {
  const isNew = !tutor.averageRating;
  if (!tutor.nextAvailableAt) return { isNew, availability: "" };
  const date = new Date(tutor.nextAvailableAt);
  const today = new Date();
  const availability = date.toDateString() === today.toDateString()
    ? "Available today"
    : `Next ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return { isNew, availability };
}

function formatCreditHours(balance: number, bookings: HomeBooking[]) {
  const samples = bookings.filter((item) => item.creditCost && item.durationMinutes);
  const creditsPerHour = samples.length
    ? samples.reduce((sum, item) => sum + (item.creditCost! / (item.durationMinutes / 60)), 0) / samples.length
    : 15;
  const hours = creditsPerHour > 0 ? balance / creditsPerHour : 0;
  if (hours <= 0) return "0 hours";
  const rounded = Math.round(hours * 10) / 10;
  const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `≈ ${label} hour${rounded === 1 ? "" : "s"}`;
}

function calendarCells(month: Date) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let index = 0; index < leading; index += 1) {
    cells.push({ date: new Date(year, monthIndex, index - leading + 1), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, monthIndex, day), inMonth: true });
  }
  let trailing = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, monthIndex + 1, trailing), inMonth: false });
    trailing += 1;
  }
  return cells;
}

function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F3FD" },
  ambient: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  scroller: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28 },
  paymentShortcut: { borderWidth: 1, borderRadius: 18, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, marginTop: 17 },
  paymentShortcutIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#EFEDFF', alignItems: 'center', justifyContent: 'center' },
  paymentShortcutCopy: { flex: 1 }, paymentShortcutTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, paymentShortcutText: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  topBar: {
    height: 72,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: "#2D285C",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 5,
  },
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
  },
  greeting: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 2,
  },
  topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  rolePill: {
    height: 25,
    paddingHorizontal: 8,
    borderRadius: 9,
    backgroundColor: "#EEECFF",
    justifyContent: "center",
  },
  rolePillText: {
    color: palette.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.7,
  },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F4FA",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    shadowColor: "#30295F",
    shadowOpacity: 0.1,
    shadowRadius: 7,
    elevation: 2,
  },
  notificationDot: {
    position: "absolute",
    right: 9,
    top: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#FF627D",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  headingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 27,
  },
  learnerHero: { marginTop: 17, marginHorizontal: -6, paddingHorizontal: 15, paddingTop: 17, paddingBottom: 15, borderRadius: 27, borderWidth: 1, overflow: "hidden" },
  learnerHeading: { marginTop: 0 },
  heroGlow: { position: "absolute", width: 155, height: 155, borderRadius: 78, right: -48, top: -58, backgroundColor: "rgba(112,91,232,0.12)" },
  eyebrow: {
    color: palette.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  pageTitle: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 19,
    backgroundColor: "#2B245C",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#25204F",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  avatarPressed: { opacity: 0.78, transform: [{ scale: 0.95 }] },
  avatarText: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 18 },
  onlineDot: {
    position: "absolute",
    right: -2,
    bottom: 3,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#23BA83",
    borderWidth: 3,
    borderColor: "#F5F3FD",
  },
  searchBox: {
    height: 59,
    paddingHorizontal: 11,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    borderWidth: 1,
    shadowColor: "#2A255A",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  searchIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F0ECFF", alignItems: "center", justifyContent: "center" },
  searchPlaceholder: {
    color: "#8C8E9E",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    flex: 1,
    marginLeft: 11,
  },
  matchShortcut: { minHeight: 92, borderWidth: 1, borderRadius: 22, padding: 13, marginTop: 15, flexDirection: "row", alignItems: "center", shadowColor: "#312A62", shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 3 },
  matchShortcutIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: "#5143D3", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  matchShortcutCopy: { flex: 1, marginHorizontal: 12 },
  matchShortcutLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  matchShortcutEyebrow: { color: "#5D50EB", fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.8 },
  matchShortcutStep: { fontFamily: "Inter_500Medium", fontSize: 12 },
  matchShortcutTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginTop: 3, letterSpacing: -0.2 },
  matchShortcutText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16, marginTop: 2 },
  matchShortcutAction: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#5C50E9", alignItems: "center", justifyContent: "center", shadowColor: "#5143D3", shadowOpacity: 0.22, shadowRadius: 6, elevation: 3 },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 13,
  },
  sectionText: {
    color: palette.ink,
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },
  sectionActionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 11,
    backgroundColor: "#EBE8FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sectionAction: {
    color: palette.primary,
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  actionPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  subjectRow: { gap: 10, paddingRight: 4 },
  subjectCard: {
    width: 116,
    minHeight: 120,
    borderRadius: 21,
    padding: 12,
    justifyContent: "space-between",
    shadowColor: "#3C346D",
    shadowOpacity: 0.06,
    shadowRadius: 9,
    elevation: 2,
  },
  cardPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  subjectIcon: {
    width: 35,
    height: 35,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#242044",
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 2,
  },
  subjectName: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  lessonCount: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  tutorCard: {
    minHeight: 104,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ECE7F4",
    shadowColor: "#3B3168",
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 3,
  },
  tutorAvatar: {
    width: 51,
    height: 51,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tutorInitials: {
    color: "#FFFFFF",
    fontFamily: "Manrope_700Bold",
    fontSize: 17,
  },
  tutorOnline: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    right: -2,
    bottom: 2,
    backgroundColor: "#21B984",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  tutorCopy: { flex: 1, marginLeft: 11 },
  tutorName: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
  },
  tutorSubject: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 3,
  },
  rating: { color: "#D8871F", fontFamily: "Inter_700Bold", fontSize: 12 },
  dot: { color: "#AAAABD", fontFamily: "Inter_400Regular", fontSize: 12 },
  available: { color: "#14966D", fontFamily: "Inter_700Bold", fontSize: 11 },
  priceWrap: { alignItems: "flex-end" },
  price: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  perSession: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 2,
  },
  arrowButton: {
    width: 30,
    height: 30,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFEDFF",
    marginTop: 8,
  },
  noTutors: {
    minHeight: 76,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  noTutorsTitle: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  noTutorsText: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  sessionCard: {
    minHeight: 89,
    borderRadius: 22,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  dateBox: {
    width: 50,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  dateDay: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 20 },
  dateMonth: { color: "#CFC9FF", fontFamily: "Inter_700Bold", fontSize: 11 },
  sessionCopy: { flex: 1, marginLeft: 12 },
  sessionLabel: {
    color: "#BEB7FF",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.9,
  },
  sessionTitle: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
    marginTop: 4,
  },
  sessionTime: {
    color: "#D3CFEB",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  join: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7162F0",
  },
  tutorWelcome: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  tutorIntro: { flex: 1 },
  tutorWelcomeCopy: { flex: 1 },
  tutorGreeting: { fontFamily: "Manrope_800ExtraBold", fontSize: 23, letterSpacing: -0.5 },
  tutorGreetingSub: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 },
  availablePill: { marginTop: 26, borderRadius: 14, backgroundColor: "#DDF8EC", borderWidth: 1, borderColor: "#BDEDD9", paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 6 },
  availablePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#17AF7A" },
  availablePillText: { color: "#11845F", fontFamily: "Inter_700Bold", fontSize: 9 },
  dashboardSectionHeader: { minHeight: 50, marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dashboardSectionTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  dashboardMeta: { borderRadius: 9, backgroundColor: "#EFEDFF", paddingHorizontal: 8, paddingVertical: 5 },
  dashboardMetaText: { color: "#655CF2", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  dashboardMetaWarning: { backgroundColor: "#FFF0D5" },
  dashboardMetaWarningText: { color: "#BD7114" },
  todaySessionCard: { borderRadius: 21, borderWidth: 1, padding: 14, shadowColor: "#2F295D", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  todaySessionTop: { flexDirection: "row", alignItems: "center" },
  learnerAvatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: "#272252", alignItems: "center", justifyContent: "center" },
  learnerAvatarText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  todaySessionCopy: { flex: 1, marginLeft: 10 },
  todaySessionName: { fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  todaySessionSubject: { fontFamily: "Inter_400Regular", fontSize: 9.5, marginTop: 3 },
  sessionMode: { borderRadius: 9, backgroundColor: "#EFEDFF", paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 4 },
  sessionModeText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 8 },
  sessionTiming: { minHeight: 39, borderRadius: 12, marginTop: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 7 },
  sessionTimingText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 10 },
  sessionCountdownWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionCountdownDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#E34E5D" },
  sessionCountdown: { color: "#E34E5D", fontFamily: "Inter_700Bold", fontSize: 8.5 },
  startSessionButton: { height: 43, borderRadius: 11, backgroundColor: "#5D55F5", marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startSessionText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 11 },
  requestPanel: { borderRadius: 21, borderWidth: 1, padding: 12, shadowColor: "#302B59", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  requestLine: { minHeight: 75, flexDirection: "row", alignItems: "center" },
  requestAvatarSmall: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#E7E3FF", alignItems: "center", justifyContent: "center" },
  requestAvatarText: { color: "#5B51DF", fontFamily: "Manrope_800ExtraBold", fontSize: 11 },
  requestLineCopy: { flex: 1, marginLeft: 10 },
  requestNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  requestLineName: { fontFamily: "Inter_700Bold", fontSize: 11 },
  requestGrade: { fontFamily: "Inter_600SemiBold", fontSize: 8 },
  requestLineSubject: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 2 },
  requestTimeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  requestTimeText: { color: "#6A61E5", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  requestNotice: { minHeight: 34, borderRadius: 10, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 6 },
  requestNoticeText: { fontFamily: "Inter_500Medium", fontSize: 8.5 },
  dashboardRequestActions: { flexDirection: "row", gap: 8, marginTop: 9 },
  dashboardRejectButton: { flex: 1, height: 40, borderRadius: 11, backgroundColor: "#FFF0F3", borderWidth: 1, borderColor: "#F6D6DE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dashboardRejectText: { color: "#B84963", fontFamily: "Inter_700Bold", fontSize: 10 },
  dashboardAcceptButton: { flex: 1, height: 40, borderRadius: 11, backgroundColor: "#5D55F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  dashboardAcceptText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  dashboardActionDisabled: { opacity: 0.55 },
  dashboardRequestMessage: { fontFamily: "Inter_600SemiBold", fontSize: 9, lineHeight: 13, marginTop: 8, textAlign: "center" },
  requestsComplete: { minHeight: 75, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8 },
  requestsCompleteTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  requestsCompleteText: { fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 3 },
  viewRequestsButton: { height: 40, borderRadius: 11, marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  viewRequestsText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 10 },
  dashboardEmpty: { minHeight: 90, borderRadius: 19, padding: 15, flexDirection: "row", alignItems: "center", gap: 11 },
  dashboardEmptyCompact: { minHeight: 68, padding: 9 },
  dashboardEmptyIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EFEDFF", alignItems: "center", justifyContent: "center" },
  dashboardEmptyTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  dashboardEmptyDetail: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 3 },
  weeklyCard: { borderRadius: 21, borderWidth: 1, padding: 15, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  weeklyTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  weeklyLabel: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.7 },
  weeklyValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 24, marginTop: 5 },
  growthPill: { borderRadius: 11, backgroundColor: "#DFF8EE", paddingHorizontal: 8, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  growthText: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 8 },
  chart: { height: 100, marginTop: 13, flexDirection: "row", alignItems: "flex-end", gap: 7 },
  chartColumn: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end" },
  chartTrack: { width: "70%", flex: 1, justifyContent: "flex-end" },
  chartBar: { width: "100%", minHeight: 9, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  chartDay: { color: "#9697A7", fontFamily: "Inter_600SemiBold", fontSize: 8, marginTop: 5 },
  chartDayActive: { color: "#655CF2", fontFamily: "Inter_700Bold" },
  weeklyFooter: { borderTopWidth: 1, borderTopColor: "#EEEAF7", marginTop: 12, paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  sessionsCompleted: { flexDirection: "row", alignItems: "center", gap: 4 },
  weeklyFooterText: { fontFamily: "Inter_500Medium", fontSize: 8.5 },
  weeklyAvailable: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 8.5 },
  earningCard: {
    minHeight: 164,
    borderRadius: 27,
    padding: 19,
    marginTop: 23,
    shadowColor: "#302767",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 8,
  },
  earningTop: { flexDirection: "row", justifyContent: "space-between" },
  earningLabel: {
    color: "#CFC9F9",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.9,
  },
  earningValue: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 29,
    marginTop: 8,
  },
  wallet: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  earningBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  earningTrend: { color: "#B8FFD9", fontFamily: "Inter_700Bold", fontSize: 13 },
  withdraw: {
    height: 34,
    paddingHorizontal: 13,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
  },
  withdrawText: { color: "#5144D3", fontFamily: "Inter_700Bold", fontSize: 13 },
  statsRow: { flexDirection: "row", gap: 9, marginTop: 14 },
  stat: {
    flex: 1,
    minHeight: 105,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#302B5D",
    shadowOpacity: 0.07,
    shadowRadius: 11,
    elevation: 2,
  },
  statIcon: {
    width: 33,
    height: 33,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
    marginTop: 5,
  },
  statLabel: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 1,
  },
  requestCard: {
    minHeight: 94,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  requestAvatar: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBE8FF",
  },
  requestInitials: {
    color: palette.primary,
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
  },
  requestCopy: { flex: 1, marginLeft: 10 },
  requestName: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
  },
  requestSubject: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 3,
  },
  requestTime: {
    color: "#15916B",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    marginTop: 5,
  },
  requestActions: { flexDirection: "row", gap: 6 },
  reject: {
    width: 33,
    height: 33,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F3",
  },
  accept: {
    width: 33,
    height: 33,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1EAE7E",
  },
  scheduleCard: {
    minHeight: 82,
    borderRadius: 20,
    padding: 13,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  timeRail: { width: 39, alignItems: "center" },
  scheduleTime: {
    color: palette.ink,
    fontFamily: "Manrope_700Bold",
    fontSize: 16,
  },
  schedulePeriod: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  scheduleLine: {
    width: 3,
    height: 47,
    borderRadius: 2,
    backgroundColor: "#6C5EF2",
    marginHorizontal: 11,
  },
  scheduleCopy: { flex: 1 },
  scheduleTitle: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
  },
  scheduleStudent: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 5,
  },
  videoButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 130,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },
  emptyTitle: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 24,
    marginTop: 22,
  },
  emptyText: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  signOut: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 15,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 25,
  },
  signOutText: {
    color: "#B74661",
    fontFamily: "Manrope_700Bold",
    fontSize: 15,
  },
  navShadow: {
    height: 72,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    borderRadius: 24,
    shadowColor: "#211B4B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 14,
  },
  nav: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.98)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  navItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  activePill: {
    width: 44,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  navLabel: { color: "#8B8D9E", fontFamily: "Inter_700Bold", fontSize: 11 },
  navLabelActive: {
    color: palette.primary,
    fontWeight: "900",
    transform: [{ translateY: 1 }],
  },
  learnerDash: { paddingTop: 4 },
  pageIntro: { marginTop: 18, marginBottom: 4 },
  pageIntroEyebrow: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageIntroDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#655CF2" },
  pageIntroLabel: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.1 },
  pageIntroTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 28, lineHeight: 34, letterSpacing: -0.8, marginTop: 8 },
  pageIntroSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 19, marginTop: 4 },
  learnerBlockTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginTop: 20, marginBottom: 12 },
  learnerBlockTitleInline: { marginTop: 0, marginBottom: 0 },
  learnerViewAll: { color: "#6C5CE7", fontFamily: "Inter_700Bold", fontSize: 13 },
  exploreRow: { flexDirection: "row", gap: 8 },
  exploreCard: { flex: 1, minHeight: 104, borderRadius: 18, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 10 },
  exploreIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  exploreName: { fontFamily: "Manrope_800ExtraBold", fontSize: 12, marginTop: 10 },
  exploreHint: { fontFamily: "Inter_500Medium", fontSize: 10, lineHeight: 13, marginTop: 2 },
  verifiedCard: { minHeight: 78, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  verifiedEmpty: { minHeight: 72, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  verifiedAvatar: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  verifiedInitials: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  verifiedCopy: { flex: 1 },
  verifiedName: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  verifiedSubject: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  verifiedStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  verifiedNew: { color: "#F5B400", fontFamily: "Inter_700Bold", fontSize: 11 },
  verifiedStatusSep: { fontFamily: "Inter_700Bold", fontSize: 11 },
  verifiedStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#15966E" },
  verifiedStatus: { color: "#15966E", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  learnerSectionHead: { minHeight: 36, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  learnerKicker: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 1.1 },
  learnerSectionMeta: { fontFamily: "Inter_500Medium", fontSize: 12 },
  learnerStatGrid: { gap: 10 },
  learnerStatRow: { flexDirection: "row", gap: 10 },
  learnerStatCard: { flex: 1, minHeight: 118, borderRadius: 20, borderWidth: 1, padding: 14, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  learnerStatTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  learnerStatLabel: { fontFamily: "Inter_500Medium", fontSize: 12 },
  learnerStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  learnerStatValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 22, letterSpacing: -0.4, marginTop: 12 },
  learnerStatHint: { fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 4 },
  learnerStatHintGreen: { color: "#15966E", fontFamily: "Inter_600SemiBold", fontSize: 12, marginTop: 4 },
  learnerProgressRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
  learnerTarget: { flexShrink: 1, fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 3 },
  learnerProgressTrack: { height: 6, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  learnerProgressFill: { height: "100%", borderRadius: 4, backgroundColor: "#6C5CE7" },
  learnerCalendar: { borderRadius: 24, borderWidth: 1, padding: 16, marginTop: 16, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  learnerCalendarHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  learnerCalendarTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16 },
  learnerCalendarMonth: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 3 },
  learnerMonthPager: { height: 34, borderRadius: 12, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", gap: 2 },
  learnerMonthButton: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  learnerMonthLabel: { minWidth: 36, textAlign: "center", fontFamily: "Inter_700Bold", fontSize: 13 },
  learnerWeekRow: { flexDirection: "row", marginTop: 16 },
  learnerWeekday: { flex: 1, textAlign: "center", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  learnerDayGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  learnerDayCell: { width: "14.285%", height: 46, alignItems: "center", justifyContent: "center" },
  learnerDayBubble: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  learnerDaySelected: { backgroundColor: "#5B4FE0" },
  learnerDayText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  learnerDayOutside: { opacity: 0.45 },
  learnerDotRow: { height: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  learnerDotUpcoming: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#6C5CE7" },
  learnerDotCompleted: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#22C55E" },
  learnerLegend: { borderTopWidth: 1, marginTop: 8, paddingTop: 12, flexDirection: "row", justifyContent: "center", gap: 22 },
  learnerLegendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  learnerLegendText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  upcomingSessionCard: { borderRadius: 24, borderWidth: 1, padding: 14, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  upcomingSessionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  upcomingSessionAvatar: { width: 46, height: 46, borderRadius: 16, backgroundColor: "#6C5CE7", alignItems: "center", justifyContent: "center" },
  upcomingSessionInitials: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  upcomingSessionCopy: { flex: 1 },
  upcomingSessionSubject: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 },
  upcomingSessionTutor: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 },
  upcomingSessionMode: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  upcomingSessionModeText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 11 },
  upcomingSessionTiming: { minHeight: 42, borderRadius: 14, marginTop: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  upcomingSessionWhen: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 12 },
  upcomingSessionCountdown: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 12 },
  upcomingSessionButton: { height: 44, borderRadius: 14, backgroundColor: "#5D55F5", marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  upcomingSessionButtonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14 },
  upcomingSessionEmpty: { minHeight: 78, borderRadius: 24, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12 },
});
