import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav } from "@/components/app-bottom-nav";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type NotificationType =
  | "booking"
  | "payment"
  | "session"
  | "verification"
  | "account"
  | "reminder"
  | "system";

type NotificationBooking = {
  _id: string;
  tutor?: { _id: string; name: string };
  subject: string;
  startsAt: string;
  durationMinutes: number;
  sessionType?: "online" | "in_person";
  status: string;
};

type Notification = {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  booking?: NotificationBooking | string;
  actionRoute?: string;
  readAt?: string | null;
  createdAt: string;
};

type CardTone = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  background: string;
};

const tones: Record<NotificationType, CardTone> = {
  booking: { icon: "calendar-outline", color: "#5D58F7", background: "#EFEDFF" },
  payment: { icon: "wallet-outline", color: "#177E62", background: "#EAF8F3" },
  session: { icon: "videocam-outline", color: "#5D58F7", background: "#EFEDFF" },
  verification: { icon: "shield-checkmark-outline", color: "#B97810", background: "#FFF7DE" },
  account: { icon: "person-outline", color: "#C65370", background: "#FFF0F4" },
  reminder: { icon: "time-outline", color: "#5D58F7", background: "#EFEDFF" },
  system: { icon: "sparkles", color: "#E78A00", background: "#FFF8DE" },
};

function notificationTone(item: Notification) {
  const copy = `${item.title} ${item.message}`.toLowerCase();
  if (copy.includes("cancel")) {
    return { icon: "close-circle-outline" as const, color: "#DC4963", background: "#FFF0F3" };
  }
  if (copy.includes("confirm")) {
    return { icon: "checkmark-circle-outline" as const, color: "#12A879", background: "#EAFBF4" };
  }
  if (copy.includes("reschedule")) {
    return { icon: "repeat-outline" as const, color: "#765CE8", background: "#F1EEFF" };
  }
  if (copy.includes("request")) {
    return { icon: "paper-plane-outline" as const, color: "#3978D4", background: "#EDF5FF" };
  }
  if (copy.includes("feedback") || copy.includes("review")) {
    return { icon: "star" as const, color: "#F19A00", background: "#FFF8DE" };
  }
  if (copy.includes("tip")) {
    return { icon: "time-outline" as const, color: "#5D58F7", background: "#EFEDFF" };
  }
  return tones[item.type];
}

function bookingDetails(item: Notification) {
  return item.booking && typeof item.booking !== "string" ? item.booking : null;
}

export function NotificationsCenter() {
  const { user, token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        if (refresh) setRefreshing(true);
        const data = await apiRequest<{
          notifications: Notification[];
          unreadCount: number;
        }>("/notifications", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
        setError("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load notifications.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const grouped = useMemo(() => {
    const todayKey = dateKey(new Date());
    const today = notifications.filter(
      (item) => dateKey(new Date(item.createdAt)) === todayKey,
    );
    return {
      today,
      todayUnread: today.filter((item) => !item.readAt).length,
      earlier: notifications.filter(
        (item) => dateKey(new Date(item.createdAt)) !== todayKey,
      ),
    };
  }, [notifications]);

  async function markAllRead() {
    if (!token || !unreadCount || busy) return;
    try {
      setBusy(true);
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      const readAt = new Date().toISOString();
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: item.readAt || readAt })),
      );
      setUnreadCount(0);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function open(item: Notification) {
    if (!token) return;
    if (!item.readAt) {
      await apiRequest(`/notifications/${item._id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      setNotifications((items) =>
        items.map((entry) =>
          entry._id === item._id
            ? { ...entry, readAt: new Date().toISOString() }
            : entry,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    if (item.actionRoute) router.push(item.actionRoute as Href);
  }

  return (
    <SafeAreaView
      edges={["top"]}
      style={[
        styles.safe,
        { backgroundColor: isDark ? colors.background : "#EFEDFF" },
      ]}
    >
      <View style={styles.headerWrap}>
        <LinearGradient
          colors={isDark ? ["#332D72", "#1F1D48"] : ["#786BF7", "#5545CE"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerGlowLarge} />
          <View style={styles.headerGlowSmall} />
          <View style={styles.headerCopy}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowDot} />
              <Text style={styles.eyebrow}>ACTIVITY CENTER</Text>
              {!!unreadCount && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{unreadCount} unread</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.subtitle}>Stay updated on your learning journey</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount ? "Mark all notifications as read" : "All notifications are read"}
            disabled={!unreadCount || busy}
            onPress={() => void markAllRead()}
            style={[styles.readAll, (!unreadCount || busy) && styles.readAllDisabled]}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                <Text style={styles.readAllText}>
                  {unreadCount ? "Read all" : "All read"}
                </Text>
              </>
            )}
          </Pressable>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#5D58F7"
          />
        }
      >
        {!!error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle-outline" size={18} color="#C14E68" />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => void load(true)}><Text style={styles.retry}>Retry</Text></Pressable>
          </View>
        )}

        {loading && <ActivityIndicator color="#5D58F7" style={styles.loader} />}

        {!loading && !!grouped.today.length && (
          <NotificationSection
            title="TODAY"
            badge={grouped.todayUnread ? `${grouped.todayUnread} New` : undefined}
            items={grouped.today}
            onOpen={open}
            colors={colors}
          />
        )}

        {!loading && !!grouped.earlier.length && (
          <NotificationSection
            title="EARLIER THIS WEEK"
            items={grouped.earlier}
            onOpen={open}
            colors={colors}
          />
        )}

        {!loading && !notifications.length && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done" size={30} color="#5D58F7" />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>You&apos;re all caught up</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Booking updates and lesson reminders will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <AppBottomNav active={user?.role === "admin" ? "home" : "bookings"} />
    </SafeAreaView>
  );
}

function NotificationSection({
  title,
  badge,
  items,
  onOpen,
  colors,
}: {
  title: string;
  badge?: string;
  items: Notification[];
  onOpen: (item: Notification) => Promise<void>;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={[styles.sectionLine, { backgroundColor: colors.border }]} />
        {!!badge && <Text style={styles.newBadge}>{badge}</Text>}
      </View>
      {items.map((item) => (
        <NotificationCard key={item._id} item={item} onOpen={onOpen} colors={colors} />
      ))}
    </View>
  );
}

function NotificationCard({
  item,
  onOpen,
  colors,
}: {
  item: Notification;
  onOpen: (item: Notification) => Promise<void>;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const tone = notificationTone(item);
  const booking = bookingDetails(item);
  const expanded = item.type === "reminder" && !!booking;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.readAt ? "" : "Unread notification: "}${item.title}`}
      onPress={() => void onOpen(item)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: item.readAt ? colors.surface : colors.surfaceElevated,
          borderColor: item.readAt ? colors.border : `${tone.color}55`,
        },
        !item.readAt && styles.cardUnread,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.cardAccent, { backgroundColor: tone.color }]} />
      <View style={styles.cardTop}>
        <View style={[styles.typeIcon, { backgroundColor: tone.background }]}>
          <Ionicons name={tone.icon} size={19} color={tone.color} />
        </View>
        <View style={styles.cardCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, { color: tone.color }]} numberOfLines={1}>{item.title}</Text>
            {!item.readAt && <View style={styles.unreadDot} />}
          </View>
          <Text style={[styles.message, expanded && styles.reminderMessage, { color: expanded ? "#E0445E" : colors.textMuted }]} numberOfLines={expanded ? undefined : 2}>{item.message}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.timeAgo, { color: colors.textMuted }]}>{relativeTime(item.createdAt)}</Text>
          {!!item.actionRoute && (
            <View style={[styles.chevron, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
            </View>
          )}
        </View>
      </View>

      {expanded && booking && (
        <>
          <View style={[styles.details, { backgroundColor: colors.surfaceMuted }]}>
            <DetailRow label="Tutor:" value={booking.tutor?.name || "Your tutor"} colors={colors} />
            <DetailRow label="Subject:" value={booking.subject} accent colors={colors} />
            <DetailRow label="Date:" value={formatDate(booking.startsAt)} colors={colors} />
            <DetailRow label="Time:" value={formatTimeRange(booking.startsAt, booking.durationMinutes)} colors={colors} />
          </View>
          <View style={styles.actionButton}>
            <Text style={styles.actionText}>View Session</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </>
      )}
    </Pressable>
  );
}

function DetailRow({
  label,
  value,
  accent,
  colors,
}: {
  label: string;
  value: string;
  accent?: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: accent ? "#5D58F7" : colors.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(value: string, durationMinutes: number) {
  const start = new Date(value);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${start.toLocaleTimeString([], options)} – ${end.toLocaleTimeString([], options)}`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerWrap: {
    width: "100%",
    maxWidth: 792,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  header: {
    minHeight: 122,
    overflow: "hidden",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    shadowColor: "#342589",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 8,
  },
  headerGlowLarge: { position: "absolute", width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(255,255,255,0.10)", right: -62, top: -77 },
  headerGlowSmall: { position: "absolute", width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.08)", left: -28, bottom: -41 },
  headerCopy: { flex: 1 },
  eyebrowRow: { minHeight: 20, flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#CFC9FF" },
  eyebrow: { color: "rgba(255,255,255,0.72)", fontFamily: "Inter_700Bold", fontSize: 8.5, letterSpacing: 1.1 },
  unreadCountBadge: { borderRadius: 8, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 7, paddingVertical: 3, marginLeft: 2, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  unreadCountText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 8.5 },
  title: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  subtitle: { color: "rgba(255,255,255,0.76)", fontFamily: "Inter_400Regular", fontSize: 11.5, lineHeight: 17, marginTop: 1 },
  readAll: {
    minWidth: 82,
    height: 39,
    borderRadius: 13,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  readAllText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 9.5 },
  readAllDisabled: { opacity: 0.62 },
  scroller: { flex: 1 },
  content: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
  section: { marginBottom: 12 },
  sectionHeader: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { color: "#85849C", fontFamily: "Inter_700Bold", fontSize: 9.5, letterSpacing: 1.15 },
  sectionLine: { flex: 1, height: StyleSheet.hairlineWidth },
  newBadge: { color: "#5D58F7", backgroundColor: "#E2DEFF", borderRadius: 10, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 4, fontFamily: "Inter_700Bold", fontSize: 8.5 },
  loader: { marginTop: 70 },
  error: { minHeight: 46, borderRadius: 14, paddingHorizontal: 12, marginBottom: 8, backgroundColor: "#FFF0F3", flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { color: "#B74760", fontFamily: "Inter_400Regular", fontSize: 11, flex: 1 },
  retry: { color: "#5D58F7", fontFamily: "Inter_700Bold", fontSize: 11 },
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: "#302A62",
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardUnread: { shadowOpacity: 0.095, elevation: 4 },
  cardAccent: { position: "absolute", left: 0, top: 13, bottom: 13, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  cardTop: { flexDirection: "row", alignItems: "center" },
  typeIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  titleRow: { minHeight: 18, flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { flexShrink: 1, fontFamily: "Manrope_800ExtraBold", fontSize: 12.5, lineHeight: 17 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F34C5E" },
  cardMeta: { width: 56, minHeight: 43, marginLeft: 8, alignItems: "flex-end", justifyContent: "space-between" },
  timeAgo: { fontFamily: "Inter_500Medium", fontSize: 8.5, textAlign: "right" },
  chevron: { width: 23, height: 23, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  message: { fontFamily: "Inter_400Regular", fontSize: 10.5, lineHeight: 15.5, marginTop: 2 },
  reminderMessage: { fontFamily: "Inter_600SemiBold" },
  details: { borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, marginTop: 14, gap: 7 },
  detailRow: { flexDirection: "row", alignItems: "center" },
  detailLabel: { width: 62, fontFamily: "Inter_400Regular", fontSize: 10.5 },
  detailValue: { flex: 1, textAlign: "right", fontFamily: "Inter_600SemiBold", fontSize: 10.5 },
  actionButton: { height: 44, marginTop: 11, borderRadius: 13, backgroundColor: "#5D58F7", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  actionText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  empty: { minHeight: 330, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  emptyIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#DED9FF", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 18, marginTop: 14 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 5 },
});
