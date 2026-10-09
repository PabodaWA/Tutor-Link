import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { Tutor } from "@/features/lasiru/types";
import { apiRequest } from "@/services/api";

type Preferences = {
  preferredSubject: string;
  currentProficiency: string;
  learningStyles: string[];
  tutorMatchGoal: string;
};

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function nextAvailability(value?: string) {
  if (!value) return "Contact for availability";
  return `Next: ${new Date(value).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" })}`;
}

export function RecommendedTutors() {
  const { token, user } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [sortByRating, setSortByRating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecommendations = useCallback(async () => {
    if (!token || user?.role !== "student") return;
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{ tutors: Tutor[]; preferences: Preferences }>("/tutors/recommended", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTutors(data.tutors);
      setPreferences(data.preferences);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load recommendations.");
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useFocusEffect(useCallback(() => {
    void loadRecommendations();
  }, [loadRecommendations]));

  const visibleTutors = useMemo(() => {
    const rankedTutors = sortByRating
      ? [...tutors].sort((left, right) => right.averageRating - left.averageRating)
      : tutors;
    return rankedTutors.slice(0, 2);
  }, [sortByRating, tutors]);

  return (
    <FeatureShell
      activeTab="discover"
      showBack
      fallbackHref="/find-tutor"
      title="Recommended Tutors"
      subtitle={preferences?.preferredSubject ? `Personal matches for ${preferences.preferredSubject} at ${preferences.currentProficiency.toLowerCase()} level.` : "Tutors selected from your learning preferences."}
    >
      <View style={styles.toolbar}>
        <Text style={[styles.available, { color: colors.textMuted }]}>{visibleTutors.length} recommendations</Text>
        <Pressable accessibilityRole="button" onPress={() => setSortByRating((value) => !value)} style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="swap-vertical" size={14} color="#5D50EB" />
          <Text style={styles.sortText}>{sortByRating ? "Top rated" : "Best match"}</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.loading}><ActivityIndicator color="#5D50EB" /><Text style={[styles.loadingText, { color: colors.textMuted }]}>Creating your personal shortlist...</Text></View>}
      {!!error && !loading && (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="cloud-offline-outline" size={30} color="#655CF2" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Recommendations unavailable</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>{error}</Text>
          <Pressable onPress={() => void loadRecommendations()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
        </View>
      )}

      {!loading && !error && visibleTutors.map((tutor, index) => (
        <View key={tutor._id} style={[styles.card, { backgroundColor: colors.surface, borderColor: index === 0 ? "#C9C3FF" : colors.border }]}>
          {index === 0 && <View style={styles.topLabel}><Ionicons name="sparkles" size={11} color="#FFFFFF" /><Text style={styles.topLabelText}>TOP RECOMMENDATION</Text></View>}
          <View style={styles.tutorTop}>
            <LinearGradient colors={index % 2 ? ["#E790A8", "#BC5577"] : ["#7065F4", "#4D42C7"]} style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(tutor.name)}</Text>
            </LinearGradient>
            <View style={styles.tutorCopy}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{tutor.name}</Text>
                <Ionicons name="checkmark-circle" size={14} color="#128D69" />
              </View>
              <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>{tutor.profile?.experience || "University tutor"} • Verified</Text>
              <View style={styles.ratingRow}><Ionicons name="star" size={13} color="#F5A623" /><Text style={styles.rating}>{tutor.averageRating ? tutor.averageRating.toFixed(1) : "New"}</Text><Text style={[styles.reviews, { color: colors.textMuted }]}>({tutor.reviewCount || 0})</Text><View style={styles.onlineDot} /><Text style={styles.online}>Online</Text></View>
            </View>
            <View style={[styles.matchBadge, { backgroundColor: isDark ? "#173C35" : "#DFF8EE" }]}><Text style={styles.matchText}>{tutor.matchScore || 0}% match</Text></View>
          </View>

          <View style={[styles.subjectBar, { backgroundColor: isDark ? colors.surfaceMuted : "#F7F6FC" }]}>
            <Ionicons name="book-outline" size={13} color="#6159A4" />
            <Text numberOfLines={1} style={[styles.subjectText, { color: colors.text }]}>{tutor.profile?.subjects?.join(", ") || "General tutoring"}</Text>
            <Text numberOfLines={1} style={[styles.nextText, { color: colors.textMuted }]}>{nextAvailability(tutor.nextAvailableAt)}</Text>
          </View>

          <View style={styles.reasonRow}>
            {(tutor.matchReasons || []).slice(0, 2).map((reason) => <View key={reason} style={styles.reasonPill}><Ionicons name="checkmark" size={10} color="#5D50EB" /><Text style={styles.reasonText}>{reason}</Text></View>)}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={() => router.push({ pathname: "/tutor/[id]/why", params: { id: tutor._id } })} style={[styles.whyButton, { borderColor: colors.border }]}>
              <Ionicons name="help-circle-outline" size={15} color={colors.text} /><Text style={[styles.whyText, { color: colors.text }]}>Why Tutor?</Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: "/tutor/[id]", params: { id: tutor._id } })} style={styles.profileButton}>
              <Text style={styles.profileText}>View Profile</Text><Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ))}

      {!loading && !error && !visibleTutors.length && (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="people-outline" size={32} color="#655CF2" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching tutors yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Try another subject or update your learning preferences.</Text>
          <Pressable onPress={() => router.replace("/find-tutor")} style={styles.retry}><Text style={styles.retryText}>Update preferences</Text></Pressable>
        </View>
      )}

      {!loading && !error && !!visibleTutors.length && (
        <Pressable onPress={() => router.push("/find-tutor")} style={[styles.customize, { borderColor: colors.border }]}>
          <Ionicons name="options-outline" size={17} color="#5D50EB" /><Text style={styles.customizeText}>Customize my match again</Text>
        </Pressable>
      )}
    </FeatureShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  available: { fontFamily: "Inter_500Medium", fontSize: 10 },
  sortButton: { borderWidth: 1, height: 34, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  sortText: { color: "#5D50EB", fontFamily: "Inter_700Bold", fontSize: 10 },
  loading: { minHeight: 280, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Inter_500Medium", fontSize: 11 },
  card: { borderWidth: 1, borderRadius: 21, padding: 13, marginBottom: 13, overflow: "hidden" },
  topLabel: { alignSelf: "flex-start", marginHorizontal: -13, marginTop: -13, marginBottom: 12, paddingHorizontal: 12, height: 25, borderBottomRightRadius: 12, backgroundColor: "#6558EE", flexDirection: "row", alignItems: "center", gap: 5 },
  topLabelText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.7 },
  tutorTop: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 16 },
  tutorCopy: { flex: 1, minWidth: 0, marginLeft: 11 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { maxWidth: "85%", fontFamily: "Manrope_800ExtraBold", fontSize: 14 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  rating: { color: "#BE7A10", fontFamily: "Inter_700Bold", fontSize: 10, marginLeft: 3 },
  reviews: { fontFamily: "Inter_400Regular", fontSize: 9, marginLeft: 2 },
  onlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#19B982", marginLeft: 9 },
  online: { color: "#14966F", fontFamily: "Inter_600SemiBold", fontSize: 9, marginLeft: 3 },
  matchBadge: { alignSelf: "flex-start", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6, marginLeft: 5 },
  matchText: { color: "#12825F", fontFamily: "Inter_700Bold", fontSize: 9 },
  subjectBar: { borderRadius: 12, minHeight: 36, paddingHorizontal: 10, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6 },
  subjectText: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 9 },
  nextText: { maxWidth: "43%", fontFamily: "Inter_400Regular", fontSize: 8, textAlign: "right" },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 9 },
  reasonPill: { borderRadius: 10, backgroundColor: "#F0EEFF", paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 3 },
  reasonText: { color: "#5B51A4", fontFamily: "Inter_600SemiBold", fontSize: 8 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  whyButton: { flex: 0.8, height: 41, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  whyText: { fontFamily: "Inter_700Bold", fontSize: 10 },
  profileButton: { flex: 1.3, height: 41, borderRadius: 13, backgroundColor: "#5749E4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  profileText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  empty: { borderWidth: 1, borderRadius: 20, padding: 24, minHeight: 230, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16, marginTop: 10 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: 5 },
  retry: { backgroundColor: "#5D50EB", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 14 },
  retryText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 10 },
  customize: { height: 46, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2 },
  customizeText: { color: "#5D50EB", fontFamily: "Inter_700Bold", fontSize: 11 },
});
