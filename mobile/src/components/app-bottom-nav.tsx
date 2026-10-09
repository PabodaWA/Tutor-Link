import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Href, router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "@/constants/auth-theme";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";

export type AppTab = "home" | "discover" | "bookings" | "profile";

export function AppBottomNav({ active }: { active: AppTab }) {
  const { user } = useAuth();
  const { isDark, colors } = useAppTheme();
  const tutor = user?.role === "tutor";
  const admin = user?.role === "admin";
  const tabs: {
    key: AppTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    href: Href;
  }[] = admin
    ? [
        { key: "home", label: "Dashboard", icon: "grid", href: "/admin" },
        {
          key: "discover",
          label: "Users",
          icon: "people",
          href: "/admin?view=users",
        },
        {
          key: "bookings",
          label: "Verify",
          icon: "shield-checkmark",
          href: "/admin?view=verify",
        },
        { key: "profile", label: "Profile", icon: "person", href: "/profile" },
      ]
    : [
        {
          key: "home",
          label: tutor ? "Dashboard" : "Home",
          icon: "home",
          href: "/home",
        },
        {
          key: "discover",
          label: tutor ? "Requests" : "Discover",
          icon: tutor ? "mail-unread" : "search",
          href: tutor ? "/tutor-requests" : "/discover",
        },
        {
          key: "bookings",
          label: tutor ? "Schedule" : "Bookings",
          icon: "calendar",
          href: "/bookings",
        },
        { key: "profile", label: "Profile", icon: "person", href: "/profile" },
      ];

  return (
    <View
      style={[styles.shadow, { shadowColor: isDark ? "#000000" : "#1D173F" }]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              key={tab.key}
              onPress={() => !selected && router.replace(tab.href)}
              style={styles.item}
            >
              {selected ? (
                <LinearGradient
                  colors={["#7566F2", "#5140CE"]}
                  style={styles.selectedPill}
                >
                  <Ionicons name={tab.icon} size={19} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View style={styles.inactiveIcon}>
                  <Ionicons
                    name={
                      `${tab.icon}-outline` as keyof typeof Ionicons.glyphMap
                    }
                    size={21}
                    color={colors.inactive}
                  />
                </View>
              )}
              <Text
                style={[
                  styles.label,
                  { color: selected ? palette.primary : colors.inactive },
                  selected && styles.labelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    height: 72,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 14,
    borderRadius: 24,
    shadowColor: "#33275F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 14,
  },
  bar: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  item: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  inactiveIcon: { height: 34, justifyContent: "center" },
  selectedPill: {
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
  label: { color: "#8B8D9E", fontFamily: "Inter_700Bold", fontSize: 10 },
  labelActive: {
    color: palette.primary,
    fontFamily: "Inter_700Bold",
  },
});
