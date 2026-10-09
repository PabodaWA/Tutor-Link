import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest, authApi, UserProfile } from "@/services/api";

const fallbackSubjects = ["Programming", "Mathematics", "Database", "Networking"];
const proficiencyOptions = ["Beginner", "Intermediate", "Advanced"] as const;
const learningStyleOptions = ["Step-by-step", "Interactive", "Visual examples", "Exam prep", "Online", "Physical", "Group"] as const;

type Proficiency = (typeof proficiencyOptions)[number];

export function StudentMatchPreferences() {
  const { token, user, refreshUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [subjects, setSubjects] = useState<string[]>(fallbackSubjects);
  const [subject, setSubject] = useState("");
  const [proficiency, setProficiency] = useState<Proficiency>("Intermediate");
  const [learningStyles, setLearningStyles] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [showSubjects, setShowSubjects] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    if (!token || user?.role !== "student") return;
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      authApi.profile(token),
      apiRequest<{ subjects: string[] }>("/tutors/subjects"),
    ])
      .then(([profileResult, subjectResult]) => {
        if (!active) return;
        const profile: UserProfile = profileResult.user.profile || {};
        const availableSubjects = subjectResult.subjects.length ? subjectResult.subjects : fallbackSubjects;
        const initialSubject = profile.preferredSubject
          || profile.interests?.find((item) => availableSubjects.includes(item))
          || availableSubjects[0]
          || "";
        setSubjects(availableSubjects);
        setSubject(initialSubject);
        setProficiency(profile.currentProficiency || "Intermediate");
        setLearningStyles(profile.learningStyles?.slice(0, 2) || []);
        setGoal(profile.tutorMatchGoal || profile.learningGoal || "");
        setShowSubjects(!initialSubject);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load your matching preferences.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, user?.role]));

  function toggleLearningStyle(value: string) {
    setError("");
    setLearningStyles((current) => {
      if (current.includes(value)) return current.filter((item) => item !== value);
      if (current.length === 2) {
        setError("Select up to two learning styles.");
        return current;
      }
      return [...current, value];
    });
  }

  async function findTutors() {
    if (!token || saving) return;
    if (!subject) return setError("Choose the subject you want help with.");
    if (!learningStyles.length) return setError("Select at least one learning style.");
    if (!goal.trim()) return setError("Add a short learning goal so tutors can be matched accurately.");
    try {
      setSaving(true);
      setError("");
      await authApi.updateProfile({
        preferredSubject: subject,
        currentProficiency: proficiency,
        learningStyles,
        tutorMatchGoal: goal.trim(),
      }, token);
      await refreshUser();
      router.push("/recommended-tutors");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save your preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FeatureShell
      activeTab="discover"
      showBack
      fallbackHref="/home"
      title="Find a Tutor"
      subtitle="Tell us how you learn best and we’ll create a personal tutor shortlist."
    >
      {loading ? (
        <View style={styles.loading}><ActivityIndicator color="#5C50EB" /><Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading your preferences...</Text></View>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeading label="SUBJECT" />
            <View style={[styles.subjectSelected, { backgroundColor: isDark ? colors.surfaceMuted : "#F8F7FF", borderColor: colors.border }]}>
              <View style={styles.subjectIcon}><Ionicons name="book-outline" size={18} color="#5D50EB" /></View>
              <View style={styles.subjectCopy}>
                <Text style={[styles.subjectName, { color: colors.text }]}>{subject || "Choose a subject"}</Text>
                <Text style={[styles.subjectMeta, { color: colors.textMuted }]}>Personalized university tutor matching</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setShowSubjects((value) => !value)} hitSlop={8}>
                <Text style={styles.changeText}>{showSubjects ? "Done" : "Change"}</Text>
              </Pressable>
            </View>
            {showSubjects && (
              <View style={styles.chipWrap}>
                {subjects.map((item) => <ChoiceChip key={item} label={item} selected={subject === item} onPress={() => { setSubject(item); setError(""); }} />)}
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.labelRow}><SectionHeading label="CURRENT PROFICIENCY" /><Text style={styles.recommended}>Recommended for your level</Text></View>
            <View style={[styles.segment, { backgroundColor: isDark ? colors.surfaceMuted : "#F4F3FA" }]}>
              {proficiencyOptions.map((item) => (
                <Pressable key={item} onPress={() => setProficiency(item)} style={[styles.segmentItem, proficiency === item && styles.segmentSelected]}>
                  <Text style={[styles.segmentText, { color: proficiency === item ? "#27213F" : colors.textMuted }, proficiency === item && styles.segmentTextSelected]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.labelRow}><SectionHeading label="LEARNING STYLE" /><Text style={[styles.hint, { color: colors.textMuted }]}>Select up to 2</Text></View>
            <View style={styles.chipWrap}>
              {learningStyleOptions.map((item) => <ChoiceChip key={item} label={item} selected={learningStyles.includes(item)} onPress={() => toggleLearningStyle(item)} />)}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.labelRow}><SectionHeading label="TARGET & GOALS" /><Text style={[styles.hint, { color: colors.textMuted }]}>{goal.length}/150</Text></View>
            <TextInput
              accessibilityLabel="Your learning goal"
              multiline
              maxLength={150}
              onChangeText={(value) => { setGoal(value); setError(""); }}
              placeholder="Example: Preparing for midterm exams and improving problem-solving skills."
              placeholderTextColor={colors.textMuted}
              style={[styles.goalInput, { backgroundColor: isDark ? colors.surfaceMuted : "#FAF9FF", borderColor: colors.border, color: colors.text }]}
              textAlignVertical="top"
              value={goal}
            />
            <View style={styles.activeRow}><Ionicons name="checkmark-circle-outline" size={15} color="#12956D" /><Text style={styles.activeText}>Your choices are saved securely to your learner profile</Text></View>
          </View>

          {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={17} color="#C3455B" /><Text style={styles.errorText}>{error}</Text></View>}

          <Pressable accessibilityRole="button" accessibilityLabel="Find my recommended tutors" disabled={saving} onPress={findTutors} style={({ pressed }) => [styles.submitWrap, pressed && styles.pressed, saving && styles.disabled]}>
            <LinearGradient colors={["#6558EE", "#5142D6"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submit}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.submitText}>Find My Tutor</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></>}
            </LinearGradient>
          </Pressable>
          <Text style={[styles.footerNote, { color: colors.textMuted }]}>Verified tutors • Personal match • You can update these choices anytime</Text>
        </>
      )}
    </FeatureShell>
  );
}

function SectionHeading({ label }: { label: string }) {
  return <Text style={styles.sectionHeading}>{label}</Text>;
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      {selected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontFamily: "Inter_500Medium", fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 12 },
  sectionHeading: { color: "#817B99", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.8 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  recommended: { color: "#11966D", fontFamily: "Inter_600SemiBold", fontSize: 9 },
  hint: { fontFamily: "Inter_400Regular", fontSize: 10 },
  subjectSelected: { marginTop: 11, minHeight: 70, borderWidth: 1, borderRadius: 17, padding: 11, flexDirection: "row", alignItems: "center" },
  subjectIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#EEECFF", alignItems: "center", justifyContent: "center" },
  subjectCopy: { flex: 1, marginHorizontal: 11 },
  subjectName: { fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  subjectMeta: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 3 },
  changeText: { color: "#5D50EB", fontFamily: "Inter_700Bold", fontSize: 11 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 },
  chip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: "#E5E1F0", backgroundColor: "#FAF9FE", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  chipSelected: { backgroundColor: "#5B4EEA", borderColor: "#5B4EEA" },
  chipText: { color: "#4C4860", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  chipTextSelected: { color: "#FFFFFF" },
  segment: { padding: 4, borderRadius: 14, flexDirection: "row" },
  segmentItem: { flex: 1, height: 37, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  segmentSelected: { backgroundColor: "#FFFFFF", shadowColor: "#312A61", shadowOpacity: 0.1, shadowRadius: 7, elevation: 2 },
  segmentText: { fontFamily: "Inter_500Medium", fontSize: 10 },
  segmentTextSelected: { fontFamily: "Inter_700Bold" },
  goalInput: { minHeight: 112, borderWidth: 1, borderRadius: 15, padding: 12, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18 },
  activeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  activeText: { color: "#148766", fontFamily: "Inter_500Medium", fontSize: 9 },
  errorBox: { borderRadius: 13, backgroundColor: "#FFF0F2", padding: 11, flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  errorText: { color: "#A63C50", fontFamily: "Inter_600SemiBold", fontSize: 10, flex: 1 },
  submitWrap: { borderRadius: 17, overflow: "hidden" },
  submit: { height: 54, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  submitText: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 14 },
  footerNote: { textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 10 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.65 },
});
