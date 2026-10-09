import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Href } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { AppBottomNav, AppTab } from "./app-bottom-nav";
import { AppTopNav } from "./app-top-nav";
import { useAppTheme } from "@/context/theme-context";

export function FeatureShell({
  title,
  subtitle,
  children,
  activeTab,
  showBack,
  fallbackHref,
}: PropsWithChildren<{
  title: string;
  subtitle: string;
  activeTab: AppTab;
  showBack?: boolean;
  fallbackHref?: Href;
}>) {
  const { colors } = useAppTheme();
  const sectionLabel =
    activeTab === "discover"
      ? "DISCOVER"
      : activeTab === "bookings"
        ? "LEARNING SCHEDULE"
        : activeTab === "profile"
          ? "YOUR ACCOUNT"
          : "TUTOR LINK";
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(113,94,255,0.10)", "rgba(113,94,255,0)"]}
        style={styles.ambient}
      />
      <AppTopNav showBack={showBack} fallbackHref={fallbackHref} />
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowDot} />
            <Text style={styles.eyebrow}>{sectionLabel}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>
      <AppBottomNav active={activeTab} />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F3FD" },
  scroller: { flex: 1 },
  ambient: { position: "absolute", top: 0, left: 0, right: 0, height: 260 },
  scroll: { width: "100%", maxWidth: 760, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  header: { marginBottom: 20 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#655CF2" },
  eyebrow: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1.1 },
  title: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
    marginTop: 8,
  },
  subtitle: {
    color: "#74778C",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
});
