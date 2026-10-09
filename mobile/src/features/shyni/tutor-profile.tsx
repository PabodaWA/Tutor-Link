import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";
import { Tutor } from "@/features/lasiru/types";

type Review = {
  _id: string;
  rating: number;
  comment: string;
  student?: { name?: string };
  createdAt: string;
};

type ProfileSection = "about" | "qualifications" | "reviews" | "style";
type TutorRequestStatus = "pending" | "accepted" | "rejected";

const profileSections: { key: ProfileSection; label: string }[] = [
  { key: "about", label: "About" },
  { key: "qualifications", label: "Qualifications" },
  { key: "reviews", label: "Reviews" },
  { key: "style", label: "Style" },
];

export function TutorProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingReview, setSavingReview] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [reviewEligibilityLoading, setReviewEligibilityLoading] =
    useState(true);
  const [reviewEligibilityError, setReviewEligibilityError] = useState("");
  const [hasOwnReview, setHasOwnReview] = useState(false);
  const [activeSection, setActiveSection] = useState<ProfileSection>("about");
  const [tutorRequestStatus, setTutorRequestStatus] = useState<TutorRequestStatus | null>(null);
  const [tutorRequestId, setTutorRequestId] = useState("");
  const [tutorSessionStatus, setTutorSessionStatus] = useState<"not_started" | "live" | "completed">("not_started");
  const [sendingTutorRequest, setSendingTutorRequest] = useState(false);
  const [tutorRequestFeedback, setTutorRequestFeedback] = useState("");

  const reviewPercentages = useMemo(
    () =>
      (tutor?.ratingBreakdown || []).map((item) => ({
        ...item,
        percentage: tutor?.reviewCount
          ? Math.round((item.count / tutor.reviewCount) * 100)
          : 0,
      })),
    [tutor],
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{ tutor: Tutor; reviews: Review[] }>(
        `/tutors/${id}`,
      );
      setTutor(data.tutor);
      setReviews(data.reviews);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load this tutor.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  const loadReviewEligibility = useCallback(async () => {
    if (user?.role !== "student" || !token || !id) return;
    try {
      setReviewEligibilityLoading(true);
      setReviewEligibilityError("");
      const data = await apiRequest<{
        canReview: boolean;
        review: { rating: number; comment: string } | null;
      }>(`/tutors/${id}/review-eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCanReview(data.canReview);
      setHasOwnReview(Boolean(data.review));
      if (data.review) {
        setRating(data.review.rating);
        setComment(data.review.comment || "");
      }
    } catch (err) {
      setCanReview(false);
      setReviewEligibilityError(
        err instanceof Error ? err.message : "Could not check review access.",
      );
    } finally {
      setReviewEligibilityLoading(false);
    }
  }, [id, token, user?.role]);

  useEffect(() => {
    const request = setTimeout(() => void loadReviewEligibility(), 0);
    return () => clearTimeout(request);
  }, [loadReviewEligibility]);

  const loadTutorRequest = useCallback(async () => {
    if (user?.role !== "student" || !token || !id) return;
    try {
      const data = await apiRequest<{ requests: { _id: string; status: TutorRequestStatus; sessionStatus?: "not_started" | "live" | "completed" }[] }>(
        `/tutor-requests?tutorId=${encodeURIComponent(id)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const latest = data.requests[0];
      setTutorRequestStatus(latest?.status || null);
      setTutorRequestId(latest?._id || "");
      setTutorSessionStatus(latest?.sessionStatus || "not_started");
    } catch {
      setTutorRequestStatus(null);
    }
  }, [id, token, user?.role]);

  useEffect(() => {
    const request = setTimeout(() => void loadTutorRequest(), 0);
    return () => clearTimeout(request);
  }, [loadTutorRequest]);

  async function sendTutorRequest() {
    if (!token || !id || sendingTutorRequest) return;
    try {
      setSendingTutorRequest(true);
      setTutorRequestFeedback("");
      await apiRequest("/tutor-requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tutorId: id }),
      });
      setTutorRequestStatus("pending");
      setTutorRequestFeedback("Tutor request sent successfully.");
    } catch (err) {
      setTutorRequestFeedback(
        err instanceof Error ? err.message : "Could not send the tutor request.",
      );
    } finally {
      setSendingTutorRequest(false);
    }
  }

  function handleTutorRequestButton() {
    if (tutorRequestStatus === "accepted" && tutorRequestId && tutorSessionStatus !== "not_started") {
      router.push({ pathname: "/direct-session/[requestId]", params: { requestId: tutorRequestId } });
      return;
    }
    void sendTutorRequest();
  }

  async function submitReview() {
    if (!token) return setError("Sign in as a learner to review this tutor.");
    try {
      setSavingReview(true);
      setError("");
      const result = await apiRequest<{ review: Review }>(
        `/tutors/${id}/reviews`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ rating, comment }),
        },
      );
      setMessage("Your verified review was saved.");
      setHasOwnReview(true);
      setReviews((items) => [
        result.review,
        ...items.filter((item) => item._id !== result.review._id),
      ]);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your review.",
      );
    } finally {
      setSavingReview(false);
    }
  }

  return (
    <FeatureShell
      activeTab="discover"
      showBack
      fallbackHref="/discover"
      title="Tutor profile"
      subtitle="Qualifications, expertise and authentic student feedback."
    >
      {loading && <ActivityIndicator style={styles.loader} color="#655CF2" />}
      {!!error && !tutor && (
        <View style={[styles.errorState, { backgroundColor: colors.surface }]}>
          <Ionicons name="alert-circle-outline" size={30} color="#C6536C" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void load()}
            style={styles.submit}
          >
            <Text style={styles.submitText}>Try again</Text>
          </Pressable>
        </View>
      )}
      {tutor && (
        <>
          <LinearGradient colors={["#1C1944", "#5847D3"]} style={styles.hero}>
            <View style={styles.avatar}>
              <Text style={styles.initials}>
                {tutor.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </Text>
              <View style={styles.verified}>
                <Ionicons name="checkmark" size={11} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.name}>{tutor.name}</Text>
            <Text style={styles.subjects}>
              {tutor.profile?.subjects?.join(" • ") || "University Tutor"}
            </Text>
            <View style={styles.stats}>
              <Stat
                value={
                  tutor.averageRating ? tutor.averageRating.toFixed(1) : "New"
                }
                label="Rating"
              />
              <View style={styles.line} />
              <Stat value={`${tutor.completedSessions || 0}`} label="Lessons" />
              <View style={styles.line} />
              <Stat value={`${tutor.studentsTaught || 0}`} label="Students" />
            </View>
          </LinearGradient>
          {user?.role === "student" && (
            <>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Send a tutor request to ${tutor.name}`}
                  disabled={sendingTutorRequest || tutorRequestStatus === "pending" || (tutorRequestStatus === "accepted" && tutorSessionStatus === "not_started")}
                  onPress={handleTutorRequestButton}
                  style={[styles.message, (sendingTutorRequest || tutorRequestStatus === "pending" || (tutorRequestStatus === "accepted" && tutorSessionStatus === "not_started")) && styles.disabled]}
                >
                  {sendingTutorRequest ? <ActivityIndicator size="small" color="#655CF2" /> : <Ionicons name={tutorRequestStatus === "accepted" && tutorSessionStatus !== "not_started" ? "videocam" : tutorRequestStatus === "accepted" ? "checkmark-circle" : tutorRequestStatus === "pending" ? "time" : "person-add-outline"} size={16} color="#655CF2" />}
                  {!sendingTutorRequest && <Text style={styles.messageText}>{tutorRequestStatus === "accepted" && tutorSessionStatus !== "not_started" ? "Open Session" : tutorRequestStatus === "accepted" ? "Accepted" : tutorRequestStatus === "pending" ? "Pending" : "Tutor Request"}</Text>}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Book a lesson with ${tutor.name}`}
                  style={styles.book}
                  onPress={() =>
                    router.push({
                      pathname: "/booking/availability",
                      params: { tutorId: tutor._id },
                    })
                  }
                >
                  <Text style={styles.bookText}>
                    Book • Rs.{tutor.profile?.hourlyRate?.toLocaleString() || "—"}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
              {!!tutorRequestFeedback && <Text style={styles.requestFeedback}>{tutorRequestFeedback}</Text>}
            </>
          )}

          <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
            {profileSections.map((section) => {
              const active = activeSection === section.key;
              return (
                <Pressable
                  key={section.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveSection(section.key)}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{section.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {activeSection === "about" && (<>
          <Card title="About" icon="person-outline">
            <View style={[styles.aboutCopy, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={styles.aboutEyebrow}>PROFILE SUMMARY</Text>
              <Text style={[styles.body, { color: colors.textMuted }]}>
                {tutor.profile?.bio ||
                  `${tutor.name} teaches ${tutor.profile?.subjects?.join(", ") || "university subjects"} with a clear, learner-focused approach. Book a session to discuss your learning goals and preferred pace.`}
              </Text>
            </View>
            <View style={styles.profileFacts}>
              <Info
                icon="time-outline"
                title={tutor.profile?.experience || "Experience not listed"}
                detail="Teaching experience"
              />
              <Info
                icon="calendar-outline"
                title={
                  tutor.nextAvailableAt
                    ? new Date(tutor.nextAvailableAt).toLocaleString(
                        undefined,
                        {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "No open slots"
                }
                detail="Next availability"
              />
            </View>
          </Card>
          <Card title="Focus areas" icon="bulb-outline">
            <View style={styles.chipRow}>
              {(tutor.profile?.subjects?.length ? tutor.profile.subjects : ["General tutoring"]).map((subject) => (
                <View key={subject} style={styles.chip}><Text style={styles.chipText}>{subject}</Text></View>
              ))}
            </View>
            <View style={styles.factGrid}>
              <MiniFact icon="language-outline" label="Languages" value="English, Sinhala" />
              <MiniFact icon="chatbubble-ellipses-outline" label="Response" value="Within a day" />
            </View>
          </Card>
          </>)}

          {activeSection === "qualifications" && (<>
          <Card title="Qualifications" icon="ribbon-outline">
            {tutor.profile?.qualifications?.length ? (
              tutor.profile.qualifications.map((item, index) => (
                <QualificationItem
                  key={item}
                  title={item}
                  index={index}
                />
              ))
            ) : (
              <EmptyPanel icon="school-outline" title="No qualifications listed" detail="This tutor has not added academic qualifications yet." />
            )}
            <View style={styles.verificationBanner}>
              <View style={styles.verificationShield}><Ionicons name="shield-checkmark" size={19} color="#15966E" /></View>
              <View style={styles.verificationCopy}>
                <Text style={styles.verificationTitle}>Tutor Link verified profile</Text>
                <Text style={styles.verificationDetail}>Identity and submitted credentials reviewed by administration</Text>
              </View>
              {!!tutor.verificationReviewedAt && <Text style={styles.verificationYear}>{new Date(tutor.verificationReviewedAt).getFullYear()}</Text>}
            </View>
          </Card>
          <Card title="Subject competency" icon="library-outline">
            {(tutor.profile?.subjects || []).map((subject) => (
              <View key={subject} style={[styles.competency, { backgroundColor: colors.surfaceMuted }]}>
                <View><Text style={[styles.competencyTitle, { color: colors.text }]}>{subject}</Text><Text style={[styles.competencyDetail, { color: colors.textMuted }]}>Tutor-declared area of expertise</Text></View>
                <View style={styles.verifiedPill}><Text style={styles.verifiedPillText}>Verified tutor</Text></View>
              </View>
            ))}
          </Card>
          </>)}

          {activeSection === "style" && (<>
            <Card title="Teaching style & approach" icon="color-palette-outline">
              <View style={[styles.styleIntro, { backgroundColor: colors.surfaceMuted }]}>
                <View style={styles.styleIntroTop}>
                  <Text style={styles.styleEyebrow}>CORE METHODOLOGY</Text>
                  <View style={styles.adaptiveBadge}><Ionicons name="sparkles" size={11} color="#655CF2" /><Text style={styles.adaptiveText}>Adaptive</Text></View>
                </View>
                <Text style={[styles.styleIntroText, { color: colors.textMuted }]}>Structured lessons adapted to the learner&apos;s current level, goals and preferred pace.</Text>
              </View>
              <View style={styles.methodGrid}>
                <Method number="01" tone="purple" icon="list-outline" title="Step-by-step" detail="Clear explanations and guided practice" />
                <Method number="02" tone="teal" icon="create-outline" title="Live practice" detail="Work through problems together" />
                <Method number="03" tone="blue" icon="document-text-outline" title="Problem sets" detail="Targeted exercises for each topic" />
                <Method number="04" tone="orange" icon="flag-outline" title="Goal focused" detail="Sessions aligned to learner outcomes" />
              </View>
            </Card>
            <Card title="Teaching track record" icon="trending-up-outline">
              <View style={styles.trackRow}>
                <TrackStat value={tutor.profile?.experience || "New"} label="Experience" />
                <TrackStat value={`${tutor.completedSessions || 0}`} label="Completed lessons" />
                <TrackStat value={`${tutor.studentsTaught || 0}`} label="Students taught" />
              </View>
            </Card>
            <Card title="Best suited for" icon="people-outline">
              {["Learners building strong foundations", "Students preparing for assignments or exams", "Anyone who prefers structured, guided practice"].map((item) => (
                <View key={item} style={styles.suitability}><Ionicons name="checkmark-circle-outline" size={17} color="#18A579" /><Text style={[styles.suitabilityText, { color: colors.textMuted }]}>{item}</Text></View>
              ))}
            </Card>
          </>)}

          {activeSection === "reviews" && (<>
          <Card title="Student reviews" icon="star-outline">
            <View style={[styles.reviewTop, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.reviewScore, { color: colors.text }]}>
                {tutor.averageRating ? tutor.averageRating.toFixed(1) : "—"}
              </Text>
              <View>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Ionicons
                      key={value}
                      name={
                        value <= Math.round(tutor.averageRating || 0)
                          ? "star"
                          : "star-outline"
                      }
                      size={16}
                      color="#F0A02A"
                    />
                  ))}
                </View>
                <Text style={[styles.reviewCount, { color: colors.textMuted }]}>
                  {tutor.reviewCount} verified reviews
                </Text>
              </View>
            </View>
            <View style={styles.breakdown}>
              {reviewPercentages.map((item) => (
                <View key={item.rating} style={styles.ratingBarRow}>
                  <Text
                    style={[styles.ratingBarLabel, { color: colors.textMuted }]}
                  >
                    {item.rating} ★
                  </Text>
                  <View
                    style={[
                      styles.ratingTrack,
                      { backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <View
                      style={[
                        styles.ratingFill,
                        {
                          width: `${item.percentage}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.ratingBarCount, { color: colors.textMuted }]}
                  >
                    {item.percentage}%
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.feedbackBadge}>
              <Ionicons name="shield-checkmark-outline" size={12} color="#15966E" />
              <Text style={styles.feedbackBadgeText}>Only verified lesson feedback is included</Text>
            </View>
            {reviews.length ? (
              reviews.map((review) => (
                <View key={review._id} style={[styles.review, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewInitial}>
                      {review.student?.name?.[0] || "L"}
                    </Text>
                  </View>
                  <View style={styles.reviewCopy}>
                    <View style={styles.reviewNameRow}>
                      <Text style={[styles.reviewName, { color: colors.text }]}>
                        {review.student?.name || "Verified learner"}
                      </Text>
                      <Text style={styles.smallStars}>
                        {"★".repeat(review.rating)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.reviewText, { color: colors.textMuted }]}
                    >
                      {review.comment || "Rating only"}
                    </Text>
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString(
                        undefined,
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <EmptyPanel icon="chatbubble-ellipses-outline" title="No reviews yet" detail="Be the first learner to review this tutor after a completed lesson." />
            )}
          </Card>
          {user?.role === "student" && (
            <Card
              title={
                hasOwnReview
                  ? "Edit your verified review"
                  : "Write a verified review"
              }
              icon="create-outline"
            >
              {reviewEligibilityLoading ? (
                <ActivityIndicator color="#655CF2" />
              ) : reviewEligibilityError ? (
                <>
                  <Text style={styles.inlineError}>
                    {reviewEligibilityError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadReviewEligibility()}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>Check again</Text>
                  </Pressable>
                </>
              ) : !canReview ? (
                <>
                  <Text
                    style={[styles.reviewHint, { color: colors.textMuted }]}
                  >
                    Complete a lesson with this tutor before writing a verified
                    review.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadReviewEligibility()}
                    style={styles.submit}
                  >
                    <Text style={styles.submitText}>
                      Check eligibility again
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text
                    style={[styles.reviewHint, { color: colors.textMuted }]}
                  >
                    Your review is linked to a completed lesson.
                  </Text>
                  <View style={styles.ratingPicker}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable
                        key={value}
                        accessibilityRole="button"
                        accessibilityLabel={`${value} star rating`}
                        onPress={() => setRating(value)}
                      >
                        <Ionicons
                          name={value <= rating ? "star" : "star-outline"}
                          size={25}
                          color="#F0A02A"
                        />
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    multiline
                    maxLength={500}
                    placeholder="Share more about your experience (optional)"
                    placeholderTextColor="#999BA9"
                    style={[
                      styles.reviewInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        color: colors.text,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.characterCount, { color: colors.textMuted }]}
                  >
                    {comment.length}/500
                  </Text>
                  {!!error && <Text style={styles.inlineError}>{error}</Text>}
                  {!!message && <Text style={styles.success}>{message}</Text>}
                  <Pressable
                    accessibilityRole="button"
                    disabled={savingReview}
                    onPress={submitReview}
                    style={[
                      styles.submit,
                      savingReview && styles.disabled,
                    ]}
                  >
                    {savingReview ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitText}>
                        {hasOwnReview ? "Update review" : "Publish review"}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </Card>
          )}
          </>)}
        </>
      )}
    </FeatureShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} style={styles.statValue}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardTitle}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={17} color="#655CF2" />
        </View>
        <Text style={[styles.cardTitleText, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
function Info({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={17} color="#655CF2" />
      </View>
      <View style={styles.infoCopy}>
        <Text style={[styles.infoTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.infoDetail, { color: colors.textMuted }]}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

function QualificationItem({ title, index }: { title: string; index: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.qualificationItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <LinearGradient colors={["#756BF5", "#5549D8"]} style={styles.qualificationIcon}>
        <Ionicons name="school-outline" size={18} color="#FFFFFF" />
      </LinearGradient>
      <View style={styles.qualificationCopy}>
        <Text style={styles.qualificationLabel}>ACADEMIC CREDENTIAL {String(index + 1).padStart(2, "0")}</Text>
        <Text style={[styles.qualificationTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.qualificationDetail, { color: colors.textMuted }]}>Submitted and reviewed during tutor verification</Text>
      </View>
      <Ionicons name="checkmark-circle" size={19} color="#15966E" />
    </View>
  );
}

function EmptyPanel({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyPanel, { backgroundColor: colors.surfaceMuted }]}>
      <View style={styles.emptyPanelIcon}><Ionicons name={icon} size={20} color="#655CF2" /></View>
      <Text style={[styles.emptyPanelTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyPanelDetail, { color: colors.textMuted }]}>{detail}</Text>
    </View>
  );
}

function MiniFact({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.miniFact, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={icon} size={17} color="#655CF2" />
      <Text style={[styles.miniFactLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.miniFactValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function Method({
  number,
  tone,
  icon,
  title,
  detail,
}: {
  number: string;
  tone: "purple" | "teal" | "blue" | "orange";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}) {
  const { colors, isDark } = useAppTheme();
  const palette = {
    purple: { gradient: ["#F4F1FF", "#ECE8FF"], accent: "#655CF2", icon: "#E2DCFF" },
    teal: { gradient: ["#EEFBF7", "#E4F8F1"], accent: "#159B74", icon: "#D3F3E8" },
    blue: { gradient: ["#EFF6FF", "#E6F0FF"], accent: "#3973D6", icon: "#D8E7FF" },
    orange: { gradient: ["#FFF8EB", "#FFF2DD"], accent: "#D98216", icon: "#FFE8C3" },
  }[tone];
  return (
    <LinearGradient
      colors={isDark ? [colors.surfaceMuted, colors.surfaceMuted] : palette.gradient as [string, string]}
      style={[styles.method, { borderColor: isDark ? colors.border : `${palette.accent}18` }]}
    >
      <View style={styles.methodTop}>
        <View style={[styles.methodIcon, { backgroundColor: isDark ? colors.surface : palette.icon }]}><Ionicons name={icon} size={16} color={palette.accent} /></View>
        <Text style={[styles.methodNumber, { color: palette.accent }]}>{number}</Text>
      </View>
      <Text style={[styles.methodTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.methodDetail, { color: colors.textMuted }]}>{detail}</Text>
      <View style={[styles.methodAccent, { backgroundColor: palette.accent }]} />
    </LinearGradient>
  );
}

function TrackStat({ value, label }: { value: string; label: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.trackStat, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={styles.trackValue}>{value}</Text>
      <Text style={[styles.trackLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 60 },
  errorState: {
    padding: 25,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },
  errorText: {
    color: "#B84D64",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  hero: {
    borderRadius: 27,
    padding: 22,
    alignItems: "center",
    shadowColor: "#292052",
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 7,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 27,
    backgroundColor: "#796BF0",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 22 },
  verified: {
    position: "absolute",
    right: -4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1BB17E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  name: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 21,
    marginTop: 13,
  },
  subjects: {
    color: "#CBC6EC",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 5,
  },
  stats: { flexDirection: "row", alignItems: "center", marginTop: 21 },
  stat: { width: 88, alignItems: "center" },
  statValue: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
    maxWidth: 80,
  },
  statLabel: {
    color: "#BBB5DF",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  line: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.16)" },
  actions: { flexDirection: "row", gap: 9, marginTop: 14 },
  message: {
    flex: 0.58,
    height: 51,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E4E1F5",
  },
  messageText: {
    color: "#655CF2",
    fontFamily: "Manrope_700Bold",
    fontSize: 11,
  },
  requestFeedback: { color: "#655CF2", fontFamily: "Inter_600SemiBold", fontSize: 10, marginTop: 7, textAlign: "center" },
  book: {
    flex: 1,
    height: 51,
    borderRadius: 17,
    backgroundColor: "#655CF2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#655CF2",
    shadowOpacity: 0.25,
    shadowRadius: 11,
    elevation: 4,
  },
  bookText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  tabs: {
    minHeight: 48,
    borderRadius: 17,
    paddingHorizontal: 5,
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#302B59",
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  tab: { flex: 1, height: 43, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#655CF2" },
  tabText: { color: "#858797", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  tabTextActive: { color: "#655CF2", fontFamily: "Inter_700Bold" },
  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#FFFFFF",
    marginTop: 13,
    shadowColor: "#302B59",
    shadowOpacity: 0.06,
    shadowRadius: 11,
    elevation: 2,
  },
  cardTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleText: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
  },
  body: {
    color: "#686B7D",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 18,
  },
  aboutCopy: { borderRadius: 17, padding: 14, borderLeftWidth: 3, borderLeftColor: "#655CF2" },
  aboutEyebrow: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.9, marginBottom: 8 },
  profileFacts: { marginTop: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip: { borderRadius: 12, backgroundColor: "#F0EEFF", paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: "#5148D5", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  factGrid: { flexDirection: "row", gap: 9, marginTop: 13 },
  miniFact: { flex: 1, minHeight: 88, borderRadius: 15, padding: 11 },
  miniFactLabel: { fontFamily: "Inter_500Medium", fontSize: 9, marginTop: 8 },
  miniFactValue: { fontFamily: "Inter_700Bold", fontSize: 11, marginTop: 3 },
  competency: { minHeight: 64, borderRadius: 15, padding: 11, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  competencyTitle: { fontFamily: "Inter_700Bold", fontSize: 12 },
  competencyDetail: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 3 },
  verifiedPill: { borderRadius: 9, backgroundColor: "#E8FAF3", paddingHorizontal: 8, paddingVertical: 5 },
  verifiedPillText: { color: "#168B66", fontFamily: "Inter_700Bold", fontSize: 8 },
  qualificationItem: { minHeight: 90, borderRadius: 17, borderWidth: 1, padding: 12, marginBottom: 9, flexDirection: "row", alignItems: "center" },
  qualificationIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  qualificationCopy: { flex: 1, marginHorizontal: 11 },
  qualificationLabel: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 7.5, letterSpacing: 0.55 },
  qualificationTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 12, marginTop: 4 },
  qualificationDetail: { fontFamily: "Inter_400Regular", fontSize: 8.5, lineHeight: 12, marginTop: 4 },
  verificationBanner: { minHeight: 70, borderRadius: 16, backgroundColor: "#EAF9F3", borderWidth: 1, borderColor: "#C8EDDF", padding: 11, marginTop: 5, flexDirection: "row", alignItems: "center" },
  verificationShield: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#D7F3E8", alignItems: "center", justifyContent: "center" },
  verificationCopy: { flex: 1, marginLeft: 10 },
  verificationTitle: { color: "#147B5D", fontFamily: "Inter_700Bold", fontSize: 11 },
  verificationDetail: { color: "#568375", fontFamily: "Inter_400Regular", fontSize: 8.5, lineHeight: 12, marginTop: 3 },
  verificationYear: { color: "#15966E", fontFamily: "Inter_700Bold", fontSize: 9, marginLeft: 6 },
  emptyPanel: { borderRadius: 17, padding: 20, alignItems: "center", justifyContent: "center" },
  emptyPanelIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E7E3FF", alignItems: "center", justifyContent: "center" },
  emptyPanelTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 12, marginTop: 9 },
  emptyPanelDetail: { maxWidth: 250, fontFamily: "Inter_400Regular", fontSize: 9.5, lineHeight: 14, textAlign: "center", marginTop: 4 },
  styleIntro: { borderRadius: 17, padding: 14, borderLeftWidth: 3, borderLeftColor: "#655CF2" },
  styleIntroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  styleEyebrow: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.9 },
  adaptiveBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: "#E8E4FF", flexDirection: "row", alignItems: "center", gap: 4 },
  adaptiveText: { color: "#5148D5", fontFamily: "Inter_700Bold", fontSize: 8 },
  styleIntroText: { fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 17, marginTop: 10 },
  methodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 13 },
  method: {
    width: "48%",
    minHeight: 137,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    overflow: "hidden",
    shadowColor: "#302B59",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  methodTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  methodIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  methodNumber: { fontFamily: "Manrope_800ExtraBold", fontSize: 10, opacity: 0.65 },
  methodTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 11.5, marginTop: 12 },
  methodDetail: { fontFamily: "Inter_400Regular", fontSize: 9, lineHeight: 13.5, marginTop: 5 },
  methodAccent: { position: "absolute", left: 12, right: 12, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3, opacity: 0.7 },
  trackRow: { flexDirection: "row", gap: 7 },
  trackStat: { flex: 1, minHeight: 79, borderRadius: 14, padding: 9, alignItems: "center", justifyContent: "center" },
  trackValue: { color: "#655CF2", fontFamily: "Manrope_800ExtraBold", fontSize: 14, textAlign: "center" },
  trackLabel: { fontFamily: "Inter_500Medium", fontSize: 8, textAlign: "center", marginTop: 4 },
  suitability: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 8 },
  suitabilityText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 14 },
  verificationDate: {
    color: "#168B66",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginLeft: 48,
    marginTop: 3,
  },
  muted: {
    color: "#8A8B9A",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 15,
  },
  info: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  infoCopy: { flex: 1 },
  infoTitle: {
    color: "#242637",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  infoDetail: {
    color: "#858797",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 3,
  },
  reviewTop: { borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  starRow: { flexDirection: "row", gap: 2 },
  breakdown: { marginTop: 14, gap: 6 },
  ratingBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingBarLabel: {
    width: 28,
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  ratingTrack: { flex: 1, height: 7, borderRadius: 4, overflow: "hidden" },
  ratingFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#F0A02A",
  },
  ratingBarCount: {
    width: 30,
    textAlign: "right",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  reviewScore: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 31,
  },
  stars: {
    color: "#F0A02A",
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    letterSpacing: 2,
  },
  reviewCount: {
    color: "#858797",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 3,
  },
  feedbackBadge: { alignSelf: "flex-start", borderRadius: 11, backgroundColor: "#EAF9F3", paddingHorizontal: 9, paddingVertical: 6, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 5 },
  feedbackBadgeText: { color: "#168B66", fontFamily: "Inter_600SemiBold", fontSize: 8.5 },
  review: {
    flexDirection: "row",
    borderRadius: 17,
    marginTop: 15,
    padding: 13,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBE8FF",
  },
  reviewInitial: { color: "#655CF2", fontWeight: "900" },
  reviewCopy: { flex: 1, marginLeft: 9 },
  reviewNameRow: { flexDirection: "row", justifyContent: "space-between" },
  reviewName: { color: "#292B3B", fontFamily: "Inter_700Bold", fontSize: 13 },
  smallStars: {
    color: "#F0A02A",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
  },
  reviewText: {
    color: "#747687",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 14,
    marginTop: 3,
  },
  reviewDate: {
    color: "#999BA9",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 5,
  },
  reviewHint: {
    color: "#77798A",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  ratingPicker: { flexDirection: "row", gap: 5, marginVertical: 12 },
  reviewInput: {
    minHeight: 84,
    borderRadius: 15,
    padding: 12,
    backgroundColor: "#F7F6FB",
    borderWidth: 1,
    borderColor: "#E8E6EF",
    textAlignVertical: "top",
    color: "#242637",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  characterCount: {
    alignSelf: "flex-end",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 4,
  },
  inlineError: {
    color: "#BD4F67",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 8,
  },
  success: {
    color: "#168B66",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    marginTop: 8,
  },
  submit: {
    height: 45,
    borderRadius: 14,
    backgroundColor: "#655CF2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 11,
  },
  submitText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 13 },
  disabled: { opacity: 0.55 },
});
