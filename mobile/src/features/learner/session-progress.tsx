import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type ProgressPerson = { _id: string; name: string };
type ProgressBooking = {
  _id: string;
  student: ProgressPerson;
  tutor: ProgressPerson;
  subject: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
};

const activeStatuses = ["confirmed", "paid", "scheduled", "live"];
const subjectAccents = ["#6C5CE7", "#12948C", "#E07A12", "#1B9A58", "#3B82F6"];

export function SessionProgressScreen() {
  const { token } = useAuth();
  const { isDark, colors } = useAppTheme();
  const [bookings, setBookings] = useState<ProgressBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    apiRequest<{ bookings: ProgressBooking[] }>("/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        setBookings(data.bookings);
        setError("");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load progress."))
      .finally(() => setLoading(false));
  }, [token]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const weekStart = startOfWeek(now);
  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const planned = bookings
    .filter((item) => countsTowardProgress(item) && isWithin(item.startsAt, monthStart, nextMonthStart))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const completed = planned.filter((item) => item.status === "completed");
  const ahead = planned.filter((item) => item.status !== "completed");
  const completedThisWeek = completed.filter((item) => new Date(item.startsAt).getTime() >= weekStart.getTime());
  const progress = planned.length ? Math.round((completed.length / planned.length) * 100) : 0;
  const subjects = subjectBreakdown(planned);
  const summary = progressSummary(progress, planned.length, ahead.length);

  return (
    <FeatureShell
      activeTab="home"
      showBack
      fallbackHref="/home"
      title="Session progress"
      subtitle="See how this month's lessons are coming together."
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>THIS MONTH</Text>
            <Text style={styles.heroMonth}>{monthLabel}</Text>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="trending-up" size={18} color="#E5922A" />
          </View>
        </View>
        <Text style={styles.heroValue}>{progress}%</Text>
        <Text style={styles.heroCount}>
          {planned.length ? `${completed.length} of ${planned.length} session${planned.length === 1 ? "" : "s"}` : "No sessions yet"}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.heroHint}>{summary}</Text>
      </View>

      <View style={styles.statRow}>
        <StatPill label="Finished" value={String(completed.length)} tone="green" />
        <StatPill label="Still ahead" value={String(ahead.length)} tone="orange" />
        <StatPill label="This week" value={String(completedThisWeek.length)} tone="purple" />
      </View>

      {!loading && !error && (
        <WeekChart
          weeks={monthWeeks(monthStart, planned)}
          surface={colors.surface}
          border={colors.border}
          text={colors.text}
          muted={colors.textMuted}
          grid={isDark ? "#2B304D" : "#E5DFF0"}
        />
      )}

      {loading && <ActivityIndicator color="#655CF2" style={styles.loader} />}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.retry}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!loading && !error && !planned.length && (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? "#3A2C1A" : "#FFF3E4" }]}>
            <Ionicons name="trending-up" size={22} color="#E5922A" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing planned this month</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Book a lesson and your finished sessions will fill this bar.
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push("/discover")} style={styles.primaryButton}>
            <Text style={styles.primaryText}>Find a tutor</Text>
            <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
          </Pressable>
        </View>
      )}

      {!loading && subjects.length > 0 && (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>By subject</Text>
          {subjects.map((item, index) => {
            const ratio = item.planned ? item.completed / item.planned : 0;
            const accent = subjectAccents[index % subjectAccents.length];
            return (
              <View key={item.subject} style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.subjectRow}>
                  <View style={[styles.subjectDot, { backgroundColor: accent }]} />
                  <Text numberOfLines={1} style={[styles.subjectName, { color: colors.text }]}>{item.subject}</Text>
                  <Text style={[styles.subjectCount, { color: colors.textMuted }]}>{item.completed} of {item.planned}</Text>
                </View>
                <View style={[styles.subjectTrack, { backgroundColor: isDark ? "#2A2750" : "#EEEAF8" }]}>
                  <View style={[styles.subjectFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: accent }]} />
                </View>
              </View>
            );
          })}
        </>
      )}

      {!loading && planned.length > 0 && (
        <>
          <Text style={[styles.heading, { color: colors.text }]}>This month</Text>
          {planned.map((item) => (
            <SessionRow key={item._id} booking={item} isDark={isDark} text={colors.text} muted={colors.textMuted} surface={colors.surface} border={colors.border} />
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push("/bookings")} style={styles.linkRow}>
            <Text style={styles.linkText}>Open your bookings</Text>
            <Ionicons name="arrow-forward" size={15} color="#655CF2" />
          </Pressable>
        </>
      )}
    </FeatureShell>
  );
}

type WeekBucket = { label: string; finished: number; ahead: number };

function WeekChart({
  weeks,
  surface,
  border,
  text,
  muted,
  grid,
}: {
  weeks: WeekBucket[];
  surface: string;
  border: string;
  text: string;
  muted: string;
  grid: string;
}) {
  const [width, setWidth] = useState(0);
  const finishedTotal = weeks.reduce((sum, week) => sum + week.finished, 0);
  const aheadTotal = weeks.reduce((sum, week) => sum + week.ahead, 0);
  const yMax = Math.max(1, ...weeks.map((week) => Math.max(week.finished, week.ahead)));
  const ticks = yMax <= 4 ? Array.from({ length: yMax + 1 }, (_, index) => index) : [0, Math.round(yMax / 2), yMax];
  const chartHeight = 168;
  const plotLeft = 26;
  const plotRight = 6;
  const plotTop = 10;
  const plotBottom = 26;
  const plotHeight = chartHeight - plotTop - plotBottom;
  const plotWidth = Math.max(0, width - plotLeft - plotRight);
  const summary = weeks.map((week) => `${week.label}: ${week.finished} finished, ${week.ahead} ahead`).join(". ");

  return (
    <View style={[styles.chartCard, { backgroundColor: surface, borderColor: border }]}>
      <View style={styles.chartHead}>
        <View>
          <Text style={[styles.chartTitle, { color: text }]}>Sessions by week</Text>
          <Text style={[styles.chartMeta, { color: muted }]}>{finishedTotal} finished · {aheadTotal} ahead</Text>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendFinished]} />
            <Text style={[styles.legendText, { color: muted }]}>Finished</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.legendAhead]} />
            <Text style={[styles.legendText, { color: muted }]}>Ahead</Text>
          </View>
        </View>
      </View>
      <View
        accessibilityRole="image"
        accessibilityLabel={`Weekly session chart. ${summary}`}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {width > 0 && (
          <Svg width={width} height={chartHeight}>
            <Defs>
              <LinearGradient id="finishedBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#7C6DF8" />
                <Stop offset="1" stopColor="#5245DA" />
              </LinearGradient>
              <LinearGradient id="aheadBar" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#F6C27A" />
                <Stop offset="1" stopColor="#E5922A" />
              </LinearGradient>
            </Defs>
            {ticks.map((tick) => {
              const y = plotTop + plotHeight - (tick / yMax) * plotHeight;
              return (
                <Line key={tick} x1={plotLeft} x2={width - plotRight} y1={y} y2={y} stroke={grid} strokeWidth={1} strokeDasharray={tick === 0 ? undefined : "3 4"} />
              );
            })}
            {ticks.map((tick) => {
              const y = plotTop + plotHeight - (tick / yMax) * plotHeight;
              return (
                <SvgText key={`label-${tick}`} x={plotLeft - 6} y={y + 3} fill={muted} fontSize={10} fontFamily="Inter_600SemiBold" textAnchor="end">
                  {tick}
                </SvgText>
              );
            })}
            {weeks.map((week, index) => {
              const slot = plotWidth / weeks.length;
              const center = plotLeft + slot * index + slot / 2;
              const barWidth = Math.min(12, Math.max(6, (slot - 20) / 2));
              const finishedHeight = week.finished ? Math.max(4, (week.finished / yMax) * plotHeight) : 0;
              const aheadHeight = week.ahead ? Math.max(4, (week.ahead / yMax) * plotHeight) : 0;
              const baseline = plotTop + plotHeight;
              return (
                <G key={week.label}>
                  {finishedHeight > 0 && <Path d={roundedBar(center - barWidth - 2, baseline - finishedHeight, barWidth, finishedHeight)} fill="url(#finishedBar)" />}
                  {aheadHeight > 0 && <Path d={roundedBar(center + 2, baseline - aheadHeight, barWidth, aheadHeight)} fill="url(#aheadBar)" />}
                  <SvgText x={center} y={chartHeight - 6} fill={muted} fontSize={10} fontFamily="Inter_600SemiBold" textAnchor="middle">
                    {week.label}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        )}
      </View>
    </View>
  );
}

function roundedBar(x: number, y: number, width: number, height: number) {
  const radius = Math.min(5, width / 2, height / 2);
  return `M ${x} ${y + height} L ${x} ${y + radius} Q ${x} ${y} ${x + radius} ${y} L ${x + width - radius} ${y} Q ${x + width} ${y} ${x + width} ${y + radius} L ${x + width} ${y + height} Z`;
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: "green" | "orange" | "purple" }) {
  const { colors } = useAppTheme();
  const toneStyle = tone === "green" ? styles.pillGreen : tone === "orange" ? styles.pillOrange : styles.pillPurple;
  const valueStyle = tone === "green" ? styles.pillValueGreen : tone === "orange" ? styles.pillValueOrange : styles.pillValuePurple;
  return (
    <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.pillMark, toneStyle]} />
      <Text style={[styles.pillValue, valueStyle]}>{value}</Text>
      <Text style={[styles.pillLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SessionRow({
  booking,
  isDark,
  text,
  muted,
  surface,
  border,
}: {
  booking: ProgressBooking;
  isDark: boolean;
  text: string;
  muted: string;
  surface: string;
  border: string;
}) {
  const date = new Date(booking.startsAt);
  const done = booking.status === "completed";
  const live = booking.status === "live";
  const statusLabel = done ? "Finished" : live ? "Live" : "Upcoming";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${booking.subject} session`}
      onPress={() => router.push({ pathname: "/session/[id]", params: { id: booking._id } })}
      style={({ pressed }) => [styles.session, { backgroundColor: surface, borderColor: border }, pressed && styles.pressed]}
    >
      <View style={[styles.dateBlock, { backgroundColor: isDark ? "#2A2750" : "#F1EEFF" }]}>
        <Text style={styles.dateDay}>{date.getDate()}</Text>
        <Text style={styles.dateMonth}>{date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</Text>
      </View>
      <View style={styles.sessionCopy}>
        <Text numberOfLines={1} style={[styles.sessionTitle, { color: text }]}>{booking.subject}</Text>
        <Text numberOfLines={1} style={[styles.sessionMeta, { color: muted }]}>
          {booking.tutor?.name || "Tutor"} · {date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </Text>
      </View>
      <View style={[styles.status, done ? styles.statusDone : live ? styles.statusLive : styles.statusAhead]}>
        <Text style={[styles.statusText, done ? styles.statusTextDone : live ? styles.statusTextLive : styles.statusTextAhead]}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}

function countsTowardProgress(item: ProgressBooking) {
  return item.status === "completed" || activeStatuses.includes(item.status);
}

function isWithin(value: string, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function startOfWeek(date: Date) {
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

function monthWeeks(monthStart: Date, planned: ProgressBooking[]) {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const lastDate = new Date(year, month + 1, 0);
  const weeks: WeekBucket[] = [];
  let cursor = new Date(year, month, 1);
  while (cursor.getTime() <= lastDate.getTime()) {
    const weekday = cursor.getDay();
    const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
    const weekEnd = new Date(year, month, cursor.getDate() + daysUntilSunday);
    const rangeEnd = weekEnd.getTime() > lastDate.getTime() ? lastDate : weekEnd;
    const rangeStart = cursor;
    const nextStart = new Date(year, month, rangeEnd.getDate() + 1);
    const inWeek = (item: ProgressBooking) => isWithin(item.startsAt, rangeStart, nextStart);
    weeks.push({
      label: rangeStart.getDate() === rangeEnd.getDate() ? String(rangeStart.getDate()) : `${rangeStart.getDate()}–${rangeEnd.getDate()}`,
      finished: planned.filter((item) => item.status === "completed" && inWeek(item)).length,
      ahead: planned.filter((item) => item.status !== "completed" && inWeek(item)).length,
    });
    cursor = nextStart;
  }
  return weeks;
}

function subjectBreakdown(planned: ProgressBooking[]) {
  const groups = new Map<string, { subject: string; completed: number; planned: number }>();
  for (const item of planned) {
    const current = groups.get(item.subject) ?? { subject: item.subject, completed: 0, planned: 0 };
    current.planned += 1;
    if (item.status === "completed") current.completed += 1;
    groups.set(item.subject, current);
  }
  return [...groups.values()].sort((a, b) => b.planned - a.planned || a.subject.localeCompare(b.subject));
}

function progressSummary(progress: number, planned: number, ahead: number) {
  if (!planned) return "Confirmed and completed lessons this month count toward your progress.";
  if (progress >= 100) return "You've finished every planned session this month.";
  if (ahead === 1) return "1 session is still ahead this month.";
  return `${ahead} sessions are still ahead this month.`;
}

const styles = StyleSheet.create({
  hero: { borderRadius: 26, padding: 20, backgroundColor: "#342B82" },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  heroLabel: { color: "#CBC6FF", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1 },
  heroMonth: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginTop: 4 },
  heroIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#FFF3E4", alignItems: "center", justifyContent: "center" },
  heroValue: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 48, letterSpacing: -1.2, marginTop: 14 },
  heroCount: { color: "#DCD8FF", fontFamily: "Inter_700Bold", fontSize: 14, marginTop: 2 },
  track: { height: 8, borderRadius: 4, marginTop: 16, backgroundColor: "rgba(255,255,255,0.16)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: "#C4B5FD" },
  heroHint: { color: "#D4D0F5", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, marginTop: 12 },
  statRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10 },
  pillMark: { width: 18, height: 4, borderRadius: 2, marginBottom: 8 },
  pillGreen: { backgroundColor: "#15966E" },
  pillOrange: { backgroundColor: "#E5922A" },
  pillPurple: { backgroundColor: "#6C5CE7" },
  pillValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 20 },
  pillValueGreen: { color: "#15966E" },
  pillValueOrange: { color: "#E5922A" },
  pillValuePurple: { color: "#6C5CE7" },
  pillLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 2 },
  chartCard: { borderWidth: 1, borderRadius: 20, padding: 16, marginTop: 12 },
  chartHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  chartTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16 },
  chartMeta: { fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 3 },
  legend: { gap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 8, height: 8, borderRadius: 3 },
  legendFinished: { backgroundColor: "#655CF2" },
  legendAhead: { backgroundColor: "#E5922A" },
  legendText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  loader: { marginTop: 22 },
  errorBox: { marginTop: 16, borderRadius: 14, padding: 14, backgroundColor: "#FFF0F3" },
  errorText: { color: "#B64D66", fontFamily: "Inter_700Bold", fontSize: 12 },
  retry: { alignSelf: "flex-start", marginTop: 8 },
  retryText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 12 },
  empty: { marginTop: 16, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: "center" },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginTop: 12 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6 },
  primaryButton: { marginTop: 16, height: 44, borderRadius: 14, paddingHorizontal: 16, backgroundColor: "#655CF2", flexDirection: "row", alignItems: "center", gap: 8 },
  primaryText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  heading: { fontFamily: "Manrope_800ExtraBold", fontSize: 17, marginTop: 22, marginBottom: 10 },
  subjectCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 8 },
  subjectRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectName: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 13 },
  subjectCount: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  subjectTrack: { height: 6, borderRadius: 4, marginTop: 10, overflow: "hidden" },
  subjectFill: { height: "100%", borderRadius: 4 },
  session: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  pressed: { opacity: 0.82 },
  dateBlock: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  dateDay: { color: "#655CF2", fontFamily: "Manrope_800ExtraBold", fontSize: 16, lineHeight: 18 },
  dateMonth: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.4 },
  sessionCopy: { flex: 1 },
  sessionTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  sessionMeta: { fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 3 },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusDone: { backgroundColor: "#E7F8F0" },
  statusAhead: { backgroundColor: "#FFF3E4" },
  statusLive: { backgroundColor: "#EEE9FF" },
  statusText: { fontFamily: "Inter_700Bold", fontSize: 10 },
  statusTextDone: { color: "#15966E" },
  statusTextAhead: { color: "#C56A10" },
  statusTextLive: { color: "#655CF2" },
  linkRow: { marginTop: 6, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  linkText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 13 },
});
