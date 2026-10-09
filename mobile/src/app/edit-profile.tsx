import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { palette } from "@/constants/auth-theme";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { authApi } from "@/services/api";

const levels = ["Foundation", "Undergraduate", "Postgraduate"];
const goals = ["Pass exams", "Build skills", "Master a subject"];
const experienceOptions = ["New tutor", "1-2 years", "3+ years"];

export default function EditProfileScreen() {
  const { user, token, refreshUser } = useAuth();
  const { colors } = useAppTheme();
  const tutor = user?.role === "tutor";
  const profile = user?.profile;
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [topics, setTopics] = useState(
    (tutor ? profile?.subjects : profile?.interests)?.join(", ") || "",
  );
  const [level, setLevel] = useState(profile?.studyLevel || "Undergraduate");
  const [goal, setGoal] = useState(profile?.learningGoal || "Build skills");
  const [experience, setExperience] = useState(
    profile?.experience || "1-2 years",
  );
  const [rate, setRate] = useState(String(profile?.hourlyRate || 1500));
  const [qualifications, setQualifications] = useState(
    profile?.qualifications?.join(", ") || "",
  );
  const [documents, setDocuments] = useState<
    DocumentPicker.DocumentPickerAsset[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  async function save() {
    if (!token)
      return setError("Your session has expired. Please sign in again.");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!list(topics).length && !user?.role?.includes("admin"))
      return setError("Add at least one subject.");
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const payload = tutor
        ? {
            name: name.trim(),
            bio: bio.trim(),
            subjects: list(topics),
            experience,
            hourlyRate: Number(rate),
            qualifications: list(qualifications),
          }
        : user?.role === "student"
          ? {
              name: name.trim(),
              bio: bio.trim(),
              interests: list(topics),
              studyLevel: level,
              learningGoal: goal,
            }
          : { name: name.trim(), bio: bio.trim() };
      const result = await authApi.updateProfile(payload, token);
      await refreshUser();
      setMessage(
        tutor &&
          user?.verificationStatus !== "not_requested" &&
          result.user.verificationStatus === "not_requested"
          ? "Profile saved. Your identity or qualifications changed, so please submit new verification evidence."
          : "Profile updated successfully.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification() {
    if (!token) return setError("Your session has expired.");
    const qualificationList = list(qualifications);
    if (!qualificationList.length || !documents.length)
      return setError(
        "Add a qualification and select a supporting PDF or image.",
      );
    try {
      setLoading(true);
      setError("");
      const result = await authApi.requestVerification(
        { qualifications: qualificationList, documents },
        token,
      );
      await refreshUser();
      setDocuments([]);
      setMessage(result.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit verification.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function pickDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const tooLarge = result.assets.find(
      (asset) => (asset.size || 0) > 5 * 1024 * 1024,
    );
    if (tooLarge) return setError(`${tooLarge.name} is larger than 5 MB.`);
    setDocuments((items) =>
      [
        ...items,
        ...result.assets.filter(
          (asset) => !items.some((item) => item.name === asset.name),
        ),
      ].slice(0, 5),
    );
    setError("");
  }

  return (
    <FeatureShell
      activeTab="profile"
      showBack
      fallbackHref="/profile"
      title="Edit your profile"
      subtitle="Keep your information accurate so Tutor Link can create better matches."
    >
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
        />
        <Field
          label="About you"
          value={bio}
          onChangeText={setBio}
          placeholder={
            tutor
              ? "Tell learners about your teaching style"
              : "Tell tutors about your learning goals"
          }
          multiline
        />
        {user?.role !== "admin" && (
          <Field
            label={tutor ? "Subjects you teach" : "Subjects you enjoy"}
            value={topics}
            onChangeText={setTopics}
            placeholder="Java, Mathematics, Databases"
            hint="Separate multiple subjects with commas"
          />
        )}

        {tutor ? (
          <>
            <Picker
              label="Experience"
              options={experienceOptions}
              value={experience}
              onChange={setExperience}
            />
            <Field
              label="Hourly rate (Rs.)"
              value={rate}
              onChangeText={setRate}
              placeholder="1500"
              keyboardType="number-pad"
            />
            <Field
              label="Qualifications"
              value={qualifications}
              onChangeText={setQualifications}
              placeholder="BSc Computer Science, Java Certification"
              hint="Separate qualifications with commas"
            />
          </>
        ) : user?.role === "student" ? (
          <>
            <Picker
              label="Study level"
              options={levels}
              value={level}
              onChange={setLevel}
            />
            <Picker
              label="Main goal"
              options={goals}
              value={goal}
              onChange={setGoal}
            />
          </>
        ) : null}

        {!!error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={17} color={palette.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {!!message && (
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={17} color="#168B66" />
            <Text style={styles.successText}>{message}</Text>
          </View>
        )}
        <Pressable disabled={loading} onPress={save} style={styles.save}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.saveText}>Save profile</Text>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </>
          )}
        </Pressable>
      </View>

      {tutor && (
        <View style={[styles.verifyCard, { backgroundColor: colors.surface }]}>
          <View style={styles.verifyHeader}>
            <View style={styles.verifyIcon}>
              <Ionicons name="shield-checkmark" size={22} color="#655CF2" />
            </View>
            <View style={styles.verifyCopy}>
              <Text style={[styles.verifyTitle, { color: colors.text }]}>
                Tutor verification
              </Text>
              <Text style={styles.verifyStatus}>
                {(user?.verificationStatus || "not_requested")
                  .replace("_", " ")
                  .toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={[styles.verifyBody, { color: colors.textMuted }]}>
            Verified tutors appear in discovery and earn more trust from
            learners.
          </Text>
          {user?.verificationStatus !== "verified" &&
            (user?.verificationStatus !== "pending" ||
              !profile?.verificationFiles?.length) && (
              <>
                {user?.verificationStatus === "pending" &&
                  !profile?.verificationFiles?.length && (
                    <Text
                      style={[styles.verifyBody, { color: colors.textMuted }]}
                    >
                      This older request only has document names. Select the
                      actual files and resubmit so an admin can review them.
                    </Text>
                  )}
                {(user?.verificationStatus === "rejected" ||
                  user?.verificationStatus === "not_requested") &&
                  !!user.verificationNote && (
                    <View style={styles.rejected}>
                      <Ionicons
                        name="information-circle"
                        size={17}
                        color="#B44E66"
                      />
                      <Text style={styles.rejectedText}>
                        {user.verificationNote}
                      </Text>
                    </View>
                  )}
                <Text style={[styles.label, { color: colors.text }]}>
                  Supporting documents
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={pickDocuments}
                  style={[
                    styles.documentPicker,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={21}
                    color="#655CF2"
                  />
                  <View style={styles.documentPickerCopy}>
                    <Text
                      style={[
                        styles.documentPickerTitle,
                        { color: colors.text },
                      ]}
                    >
                      Choose PDF or image
                    </Text>
                    <Text style={[styles.hint, { color: colors.textMuted }]}>
                      Up to 5 files, maximum 5 MB each
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.documentList}>
                  {documents.map((document) => (
                    <View
                      key={document.name}
                      style={[
                        styles.documentChip,
                        { backgroundColor: colors.softPurple },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={15}
                        color="#655CF2"
                      />
                      <Text
                        numberOfLines={1}
                        style={[styles.documentName, { color: colors.text }]}
                      >
                        {document.name}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${document.name}`}
                        onPress={() =>
                          setDocuments((items) =>
                            items.filter((item) => item.name !== document.name),
                          )
                        }
                      >
                        <Ionicons
                          name="close-circle"
                          size={17}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable
                  disabled={loading}
                  onPress={submitVerification}
                  style={styles.verifyButton}
                >
                  <Text style={styles.verifyButtonText}>
                    Submit for admin review
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#655CF2" />
                </Pressable>
              </>
            )}
          {user?.verificationStatus === "pending" &&
            !!profile?.verificationFiles?.length && (
              <View style={styles.pending}>
                <Ionicons name="time" size={17} color="#D98A28" />
                <Text style={styles.pendingText}>
                  Your documents are waiting for admin review.
                </Text>
              </View>
            )}
        </View>
      )}
      <Pressable onPress={() => router.replace("/profile")}>
        <Text style={styles.done}>Return to profile</Text>
      </Pressable>
    </FeatureShell>
  );
}

function Field({
  label,
  hint,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; hint?: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#A0A2B1"
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            color: colors.text,
          },
          multiline && styles.textarea,
        ]}
      />
      {hint && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      )}
    </View>
  );
}
function Picker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.option,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
              value === option && styles.optionActive,
            ]}
          >
            <Text
              style={[
                styles.optionText,
                { color: colors.textMuted },
                value === option && styles.optionTextActive,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    shadowColor: "#302B59",
    shadowOpacity: 0.07,
    shadowRadius: 13,
    elevation: 3,
  },
  field: { marginBottom: 17 },
  label: {
    color: "#242637",
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    marginBottom: 7,
  },
  input: {
    minHeight: 53,
    borderRadius: 16,
    paddingHorizontal: 13,
    backgroundColor: "#F7F6FB",
    borderWidth: 1.5,
    borderColor: "#E9E7F0",
    color: "#171A2B",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  textarea: { height: 96, paddingTop: 13, textAlignVertical: "top" },
  hint: {
    color: "#9697A6",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 5,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: {
    minHeight: 36,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: "#F5F3FA",
    borderWidth: 1,
    borderColor: "#E7E5EE",
    justifyContent: "center",
  },
  optionActive: { backgroundColor: "#655CF2", borderColor: "#655CF2" },
  optionText: { color: "#696B7D", fontFamily: "Inter_700Bold", fontSize: 12 },
  optionTextActive: { color: "#FFFFFF" },
  error: {
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginBottom: 12,
  },
  errorText: {
    color: palette.danger,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  success: {
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#EAF9F3",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginBottom: 12,
  },
  successText: {
    color: "#168B66",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
  },
  save: {
    height: 54,
    borderRadius: 17,
    backgroundColor: "#655CF2",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#655CF2",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  saveText: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 15 },
  verifyCard: {
    padding: 17,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    marginTop: 14,
  },
  verifyHeader: { flexDirection: "row", alignItems: "center" },
  verifyIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  verifyCopy: { marginLeft: 10 },
  verifyTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
  },
  verifyStatus: {
    color: "#D48728",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.7,
  },
  verifyBody: {
    color: "#737587",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 16,
    marginTop: 12,
    marginBottom: 15,
  },
  verifyButton: {
    height: 49,
    borderRadius: 15,
    backgroundColor: "#EFEDFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  verifyButtonText: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  pending: {
    height: 48,
    borderRadius: 15,
    backgroundColor: "#FFF6E9",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 8,
  },
  pendingText: { color: "#A36820", fontFamily: "Inter_700Bold", fontSize: 12 },
  done: {
    color: "#655CF2",
    textAlign: "center",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    marginTop: 17,
  },
  rejected: {
    flexDirection: "row",
    gap: 8,
    padding: 11,
    borderRadius: 13,
    backgroundColor: "#FFF0F3",
    marginBottom: 13,
  },
  rejectedText: {
    flex: 1,
    color: "#A8435A",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 16,
  },
  documentPicker: {
    minHeight: 66,
    borderRadius: 15,
    borderWidth: 1.5,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 10,
    marginBottom: 10,
  },
  documentPickerCopy: { flex: 1 },
  documentPickerTitle: { fontFamily: "Inter_700Bold", fontSize: 13 },
  documentList: { gap: 7, marginBottom: 13 },
  documentChip: {
    minHeight: 39,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  documentName: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 11 },
});
