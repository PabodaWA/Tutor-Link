import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";
import { Tutor } from "./types";

type MatchParameter = { label: string; value: string; met: boolean };
type MatchResponse = { tutor: Tutor; match: { score: number; confidence: number; summary: string; parameters: MatchParameter[] } };

export function WhyThisTutorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [data, setData] = useState<MatchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const request = token && id
      ? apiRequest<MatchResponse>(`/tutors/${id}/match`, { headers: { Authorization: `Bearer ${token}` } })
      : Promise.reject(new Error("Sign in as a learner to view tutor matches."));

    request
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not calculate this tutor match."); })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id, refreshKey, token]);

  const retry = () => {
    setLoading(true);
    setError("");
    setRefreshKey((value) => value + 1);
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: isDark ? colors.background : "#EFEDFF" }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/discover")} style={[styles.headerButton, { backgroundColor: colors.surface }]}><Ionicons name="chevron-back" size={20} color={colors.text} /></Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Why This Tutor</Text>
        <Pressable onPress={() => data && router.push({ pathname: "/tutor/[id]", params: { id: data.tutor._id } })} style={[styles.headerButton, { backgroundColor: colors.surface }]}><Ionicons name="share-social-outline" size={18} color="#655CF2" /></Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator color="#655CF2" style={styles.loader} />}
        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={retry}><Text style={styles.retry}>Try again</Text></Pressable></View>}
        {data && <>
          <View style={[styles.tutorRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <LinearGradient colors={["#7165F4", "#5043D2"]} style={styles.avatar}><Text style={styles.avatarText}>{initials(data.tutor.name)}</Text></LinearGradient>
            <View style={styles.tutorCopy}><View style={styles.nameRow}><Text style={[styles.name, { color: colors.text }]}>{data.tutor.name}</Text><Ionicons name="checkmark-circle" size={14} color="#15966E" /></View><Text style={[styles.subject, { color: colors.textMuted }]}>{data.tutor.profile?.subjects?.join(" • ") || "University Tutor"}</Text></View>
            <View style={styles.topMatch}><Text style={styles.topMatchText}>{data.match.score >= 80 ? "TOP MATCH" : "GOOD MATCH"}</Text></View>
          </View>

          <View style={[styles.scoreArea, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.scoreRing}><View style={[styles.scoreInner, { backgroundColor: colors.surface }]}><Text style={[styles.score, { color: colors.text }]}>{data.match.score}<Text style={styles.percent}>%</Text></Text><Text style={styles.scoreLabel}>MATCH SCORE</Text></View></View>
            <View style={[styles.strengthPill, { backgroundColor: isDark ? colors.surfaceMuted : "#F0EEFF" }]}><Ionicons name="sparkles" size={15} color="#655CF2" /><Text style={styles.strengthText}>{data.match.score >= 80 ? "Strong match for your learning profile" : "Compatible with your learning profile"}</Text></View>
            <Text style={[styles.summary, { color: colors.textMuted }]}>{data.match.summary}</Text>
          </View>

          <View style={[styles.metrics, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.metric}><Text style={[styles.metricValue, { color: colors.text }]}>{data.match.confidence}%</Text><Text style={[styles.metricLabel, { color: colors.textMuted }]}>PROFILE CONFIDENCE</Text></View><View style={[styles.metricDivider, { backgroundColor: colors.border }]} /><View style={styles.metric}><Text style={[styles.metricValue, { color: colors.text }]}>{data.match.parameters.filter((item) => item.met).length}/{data.match.parameters.length}</Text><Text style={[styles.metricLabel, { color: colors.textMuted }]}>PARAMETERS MET</Text></View></View>

          <View style={styles.sectionHeading}><Text style={[styles.sectionTitle, { color: colors.text }]}>Match parameters</Text><View style={styles.allVerified}><Ionicons name="checkmark-circle" size={12} color="#15966E" /><Text style={styles.allVerifiedText}>Live data</Text></View></View>
          <View style={[styles.parameters, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {data.match.parameters.map((item, index) => <View key={item.label} style={[styles.parameter, index < data.match.parameters.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}><View style={styles.parameterIcon}><Ionicons name={parameterIcon(index)} size={15} color="#655CF2" /></View><Text style={[styles.parameterLabel, { color: colors.textMuted }]}>{item.label}</Text><Text style={[styles.parameterValue, { color: colors.text }]} numberOfLines={1}>{item.value}</Text><Ionicons name={item.met ? "checkmark" : "information-circle-outline"} size={16} color={item.met ? "#15966E" : "#D58B23"} /></View>)}
          </View>

          <View style={[styles.note, { backgroundColor: colors.surface }]}><View style={styles.noteTop}><Ionicons name="shield-checkmark-outline" size={16} color="#655CF2" /><Text style={[styles.noteTitle, { color: colors.text }]}>How this score works</Text></View><Text style={[styles.noteText, { color: colors.textMuted }]}>The match uses your learning interests and goal together with the tutor&apos;s verified subjects, experience and current availability. It updates when either profile changes.</Text></View>
        </>}
      </ScrollView>
      {!!data && <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}><Pressable onPress={() => router.push({ pathname: "/tutor/[id]", params: { id: data.tutor._id } })} style={styles.profileButton}><Text style={styles.profileButtonText}>View Tutor Profile</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></Pressable></View>}
    </SafeAreaView>
  );
}

function initials(value: string) { return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(); }
function parameterIcon(index: number): keyof typeof Ionicons.glyphMap { return (["book-outline", "flag-outline", "school-outline", "time-outline"] as const)[index] || "checkmark-circle-outline"; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, header: { width: "100%", maxWidth: 600, alignSelf: "center", minHeight: 68, paddingHorizontal: 18, flexDirection: "row", alignItems: "center" }, headerButton: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }, headerTitle: { flex: 1, textAlign: "center", fontFamily: "Manrope_800ExtraBold", fontSize: 19 },
  scroll: { flex: 1 }, content: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 18, paddingBottom: 36 }, loader: { marginTop: 80 }, error: { borderRadius: 18, backgroundColor: "#FFF0F3", padding: 16, marginTop: 20, alignItems: "center" }, errorText: { color: "#AB455C", fontFamily: "Inter_400Regular", fontSize: 13, lineHeight: 18 }, retry: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 13, marginTop: 10 },
  tutorRow: { minHeight: 88, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, marginBottom: 14, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }, avatar: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center" }, avatarText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 16 }, tutorCopy: { flex: 1, marginLeft: 12, minWidth: 0 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5 }, name: { fontFamily: "Manrope_800ExtraBold", fontSize: 15 }, subject: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, marginTop: 4 }, topMatch: { borderRadius: 10, backgroundColor: "#DDF8EC", paddingHorizontal: 9, paddingVertical: 7, marginLeft: 6 }, topMatchText: { color: "#14875F", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.3 },
  scoreArea: { alignItems: "center", borderWidth: 1, borderRadius: 26, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 22, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }, scoreRing: { width: 144, height: 144, borderRadius: 72, borderWidth: 10, borderColor: "#5D55F5", alignItems: "center", justifyContent: "center", shadowColor: "#655CF2", shadowOpacity: 0.19, shadowRadius: 16, elevation: 5 }, scoreInner: { width: 115, height: 115, borderRadius: 58, alignItems: "center", justifyContent: "center" }, score: { fontFamily: "Manrope_800ExtraBold", fontSize: 36 }, percent: { color: "#655CF2", fontSize: 19 }, scoreLabel: { color: "#77798B", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.8, marginTop: 1 }, strengthPill: { borderRadius: 15, paddingHorizontal: 14, paddingVertical: 10, marginTop: 19, flexDirection: "row", alignItems: "center", gap: 6 }, strengthText: { color: "#5B50DE", fontFamily: "Inter_700Bold", fontSize: 11 }, summary: { maxWidth: 325, textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginTop: 12 },
  metrics: { minHeight: 88, flexDirection: "row", alignItems: "center", marginTop: 14, borderWidth: 1, borderRadius: 20, shadowColor: "#302B59", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }, metric: { flex: 1, alignItems: "center" }, metricValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 21 }, metricLabel: { fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.65, marginTop: 5 }, metricDivider: { width: 1, height: 42 }, sectionHeading: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }, sectionTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 16 }, allVerified: { flexDirection: "row", alignItems: "center", gap: 5 }, allVerifiedText: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 10 },
  parameters: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, shadowColor: "#302B59", shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }, parameter: { minHeight: 60, flexDirection: "row", alignItems: "center" }, parameterIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#EFEDFF", alignItems: "center", justifyContent: "center" }, parameterLabel: { width: 102, fontFamily: "Inter_500Medium", fontSize: 11, marginLeft: 10 }, parameterValue: { flex: 1, textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 11, marginRight: 8 },
  note: { borderRadius: 20, padding: 16, marginTop: 15, shadowColor: "#302B59", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }, noteTop: { flexDirection: "row", alignItems: "center", gap: 8 }, noteTitle: { fontFamily: "Inter_700Bold", fontSize: 13 }, noteText: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, marginTop: 9 }, footer: { borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 11, paddingBottom: 15 }, profileButton: { width: "100%", maxWidth: 564, alignSelf: "center", height: 54, borderRadius: 16, backgroundColor: "#5D55F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: "#5D55F5", shadowOpacity: 0.22, shadowRadius: 10, elevation: 4 }, profileButtonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
});
