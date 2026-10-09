import { Ionicons } from "@expo/vector-icons";
import { Href, router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/context/auth-context";
import { apiRequest } from "@/services/api";
import { BrandLogo } from "./brand-logo";
import { useAppTheme } from "@/context/theme-context";

export function AppTopNav({
  showBack = false,
  fallbackHref = "/home",
}: {
  showBack?: boolean;
  fallbackHref?: Href;
}) {
  const { user, token } = useAuth();
  const { isDark, colors, toggleMode } = useAppTheme();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const role =
    user?.role === "admin"
      ? "ADMIN"
      : user?.role === "tutor"
        ? "TUTOR"
        : "LEARNER";

  useEffect(() => {
    if (!token) return;
    const request = setTimeout(
      () =>
        apiRequest<{ unreadCount: number }>("/notifications?limit=1", {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((data) => setUnreadCount(data.unreadCount))
          .catch(() => undefined),
      0,
    );
    return () => clearTimeout(request);
  }, [pathname, token]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(fallbackHref);
  }

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          shadowColor: isDark ? "#000000" : "#352A68",
        },
      ]}
    >
      <View style={styles.leading}>
        {showBack && (
          <Pressable
            accessibilityLabel="Go back"
            onPress={goBack}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={19} color="#FFFFFF" />
          </Pressable>
        )}
        <BrandLogo compact />
      </View>
      <View style={styles.actions}>
        <View style={[styles.role, { backgroundColor: colors.softPurple }]}>
          <View style={styles.roleDot} />
          <Text style={styles.roleText}>{role}</Text>
        </View>
        <Pressable
          accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
          onPress={toggleMode}
          style={({ pressed }) => [
            styles.bell,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={isDark ? "sunny-outline" : "moon-outline"}
            size={19}
            color={isDark ? "#FFD166" : colors.icon}
          />
        </Pressable>
        <Pressable
          accessibilityLabel={`${unreadCount} unread notifications`}
          onPress={() => router.push("/notifications")}
          style={({ pressed }) => [
            styles.bell,
            {
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="notifications-outline"
            size={20}
            color={colors.icon}
          />
          {unreadCount > 0 && (
            <View style={styles.notificationDot}>
              {unreadCount < 10 && (
                <Text style={styles.notificationCount}>{unreadCount}</Text>
              )}
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: "auto",
    maxWidth: 760,
    height: 64,
    marginHorizontal: 16,
    marginTop: 7,
    paddingHorizontal: 9,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.98)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    shadowColor: "#25204C",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
    zIndex: 10,
  },
  leading: { flexDirection: "row", alignItems: "center", gap: 7 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#655CF2",
    shadowColor: "#655CF2",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  role: {
    height: 25,
    paddingHorizontal: 6,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFEDFF",
  },
  roleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#655CF2" },
  roleText: {
    color: "#5B51D4",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.7,
  },
  bell: {
    width: 37,
    height: 37,
    borderRadius: 12,
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
    right: 5,
    top: 4,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF627D",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notificationCount: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
});
