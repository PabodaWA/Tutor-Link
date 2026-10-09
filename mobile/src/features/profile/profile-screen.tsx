import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { palette } from "@/constants/auth-theme";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";

export function ProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const { isDark, colors, toggleMode } = useAppTheme();
  const isTutor = user?.role === "tutor";
  const isAdmin = user?.role === "admin";
  const roleTitle = isAdmin
    ? "Platform Administrator"
    : isTutor
      ? `${user?.verificationStatus === "verified" ? "Verified" : user?.verificationStatus === "pending" ? "Verification Pending" : "Unverified"} University Tutor`
      : "University Learner";
  useEffect(() => {
    refreshUser().catch(() => undefined);
  }, [refreshUser]);
  async function signOut() {
    await logout();
    router.replace("/");
  }

  return (
    <FeatureShell
      activeTab="profile"
      title="Your profile"
      subtitle="Personalize your Tutor Link identity and account experience."
    >
      <LinearGradient
        colors={isAdmin ? ["#181633", "#393173"] : ["#201B50", "#6552E4"]}
        style={styles.hero}
      >
        <View pointerEvents="none" style={styles.heroGlow} />
        <View pointerEvents="none" style={styles.heroGlowSmall} />
        <View style={styles.avatar}>
          <Text style={styles.initials}>
            {user?.name
              ?.split(" ")
              .map((part) => part[0])
              .join("")
              .slice(0, 2) || "TU"}
          </Text>
          <View style={styles.camera}>
            <Ionicons name="camera" size={12} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.name}>{user?.name || "Tutor Link Member"}</Text>
        <Text style={styles.email}>
          {user?.email || "member@university.edu"}
        </Text>
        <View style={styles.role}>
          <Ionicons
            name={isAdmin ? "shield-checkmark" : isTutor ? "school" : "rocket"}
            size={13}
            color="#DCD7FF"
          />
          <Text style={styles.roleText}>{roleTitle}</Text>
        </View>
      </LinearGradient>

      {isAdmin && (
        <View style={[styles.adminOverview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AdminStatus icon="shield-checkmark" color="#655CF2" value="Administrator" label="ROLE" />
          <View style={[styles.adminDivider, { backgroundColor: colors.border }]} />
          <AdminStatus icon="key" color="#D8852A" value="Full access" label="PERMISSIONS" />
          <View style={[styles.adminDivider, { backgroundColor: colors.border }]} />
          <AdminStatus icon="pulse" color="#1B9D76" value={user?.status === "suspended" ? "Suspended" : "Active"} label="STATUS" />
        </View>
      )}

      {!isAdmin && (
        <View style={[styles.stats, { backgroundColor: colors.surface }]}>
          <Stat
            value={isTutor ? "4.9" : "12"}
            label={isTutor ? "Rating" : "Sessions"}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Stat
            value={isTutor ? "46h" : "8h"}
            label={isTutor ? "Taught" : "Learned"}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Stat
            value={isTutor ? "28" : "5"}
            label={isTutor ? "Students" : "Tutors"}
          />
        </View>
      )}

      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Menu
          onPress={() => router.push("/edit-profile")}
          icon="person-outline"
          color="#655CF2"
          title="Personal information"
          caption="Name, email and university"
        />
        {isTutor && (
          <Menu
            onPress={() => router.push("/edit-profile")}
            icon="ribbon-outline"
            color="#D8852A"
            title="Qualifications"
            caption="Expertise and verification documents"
            badge={
              user?.verificationStatus === "verified"
                ? "Verified"
                : user?.verificationStatus === "pending"
                  ? "Pending"
                  : undefined
            }
          />
        )}
        {!isAdmin && (
          <Menu
            onPress={() => router.push("/edit-profile")}
            icon={isTutor ? "cash-outline" : "heart-outline"}
            color="#1B9D76"
            title={isTutor ? "Rates & availability" : "Learning preferences"}
            caption={
              isTutor
                ? "Pricing and teaching schedule"
                : "Subjects, level and goals"
            }
          />
        )}
        {isAdmin && (
          <Menu
            icon="key-outline"
            color="#D8852A"
            title="Admin security"
            caption="Password and privileged access"
          />
        )}
      </View>

      <Text style={styles.sectionLabel}>PREFERENCES</Text>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Menu
          onPress={toggleMode}
          icon={isDark ? "moon" : "sunny"}
          color={isDark ? "#9B8DFF" : "#E39B22"}
          title="Appearance"
          caption={isDark ? "Dark mode is active" : "Light mode is active"}
          badge={isDark ? "Dark" : "Light"}
        />
        <Menu
          onPress={() => router.push("/notifications")}
          icon="notifications-outline"
          color="#655CF2"
          title="Messages & notifications"
          caption="Session chat and account alerts"
          badge="On"
        />
        <Menu
          icon="card-outline"
          color="#D05A76"
          title={isTutor ? "Payout methods" : "Payment methods"}
          caption="Secure billing preferences"
        />
        <Menu
          icon="help-buoy-outline"
          color="#278AA5"
          title="Help & support"
          caption="FAQs and contact support"
        />
      </View>

      <Pressable onPress={signOut} style={styles.signOut}>
        <View style={styles.signOutIcon}>
          <Ionicons name="log-out-outline" size={18} color="#C24C67" />
        </View>
        <Text style={styles.signOutText}>Sign out of Tutor Link</Text>
        <Ionicons name="chevron-forward" size={17} color="#C9A2AB" />
      </Pressable>
      <Text style={styles.version}>
        Tutor Link version 1.0.0 • Made for better learning
      </Text>
    </FeatureShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}
function AdminStatus({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.adminStat}>
      <View style={[styles.adminStatIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={16} color={color} /></View>
      <Text numberOfLines={1} style={[styles.adminStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.adminStatLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}
function Menu({
  icon,
  color,
  title,
  caption,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  caption: string;
  badge?: string;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menu, { borderBottomColor: colors.border }]}
    >
      <View style={[styles.menuIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={19} color={color} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[styles.menuTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.menuCaption, { color: colors.textMuted }]}>
          {caption}
        </Text>
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: colors.softPurple }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={17} color={colors.inactive} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 216,
    borderRadius: 28,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#231C51",
    shadowOpacity: 0.27,
    shadowRadius: 18,
    elevation: 7,
    overflow: "hidden",
  },
  heroGlow: { position: "absolute", width: 190, height: 190, borderRadius: 95, right: -62, top: -82, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(126,111,246,0.10)" },
  heroGlowSmall: { position: "absolute", width: 85, height: 85, borderRadius: 43, left: -28, bottom: -36, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  avatar: {
    width: 75,
    height: 75,
    borderRadius: 27,
    backgroundColor: "#7768ED",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 21 },
  camera: {
    position: "absolute",
    right: -4,
    bottom: 2,
    width: 24,
    height: 24,
    borderRadius: 10,
    backgroundColor: "#1DA979",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  name: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 20,
    marginTop: 13,
  },
  email: {
    color: "#C9C5E3",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 4,
  },
  role: {
    height: 27,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  roleText: { color: "#E6E2FF", fontFamily: "Inter_700Bold", fontSize: 11 },
  adminOverview: { minHeight: 94, borderRadius: 21, marginTop: 13, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", borderWidth: 1, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  adminStat: { flex: 1, minWidth: 0, alignItems: "center" },
  adminStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  adminStatValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 11 },
  adminStatLabel: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.55, marginTop: 2 },
  adminDivider: { width: 1, height: 40 },
  stats: {
    minHeight: 86,
    backgroundColor: "#FFFFFF",
    borderRadius: 21,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    shadowColor: "#302B59",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: {
    color: palette.ink,
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
  },
  statLabel: {
    color: palette.muted,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  divider: { width: 1, height: 31, backgroundColor: "#ECEBF2" },
  sectionLabel: {
    color: "#8B8C9C",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.1,
    marginTop: 23,
    marginBottom: 9,
  },
  card: {
    borderRadius: 23,
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    shadowColor: "#302B59",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  menu: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EFF5",
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  menuCopy: { flex: 1, marginLeft: 10 },
  menuTitle: {
    color: "#242637",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  menuCaption: {
    color: "#858797",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  badge: {
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 8,
    backgroundColor: "#E8F8F1",
    justifyContent: "center",
    marginRight: 7,
  },
  badgeText: { color: "#178A67", fontFamily: "Inter_700Bold", fontSize: 10 },
  signOut: {
    height: 59,
    borderRadius: 19,
    backgroundColor: "#FFF1F4",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginTop: 18,
  },
  signOutIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: {
    color: "#B64760",
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    flex: 1,
    marginLeft: 10,
  },
  version: {
    color: "#A0A0AF",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    textAlign: "center",
    marginTop: 18,
  },
});
