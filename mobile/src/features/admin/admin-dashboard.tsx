import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppBottomNav, AppTab } from "@/components/app-bottom-nav";
import { AppTopNav } from "@/components/app-top-nav";
import { useAuth } from "@/context/auth-context";
import { apiRequest, apiUrl } from "@/services/api";

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended";
  isVerified: boolean;
  verificationStatus?: "not_requested" | "pending" | "verified" | "rejected";
  verificationNote?: string;
  profile?: {
    qualifications?: string[];
    verificationDocuments?: string[];
    verificationFiles?: {
      id: string;
      name: string;
      mimeType: string;
      size: number;
    }[];
  };
};
type Stats = {
  users: number;
  students: number;
  tutors: number;
  activeUsers: number;
  pendingTutors: number;
  bookings: number;
  payments: number;
  refundPending: number;
  revenue: number;
};
type Payment = {
  _id: string;
  booking?: { _id: string; subject: string; startsAt: string; status: string };
  student?: { name: string; email: string };
  tutor?: { name: string; email: string };
  amount: number;
  status: string;
  method: string;
  last4?: string;
  transactionReference?: string;
  createdAt: string;
};
type RoleFilter = "all" | "student" | "tutor";
const emptyStats: Stats = {
  users: 0,
  students: 0,
  tutors: 0,
  activeUsers: 0,
  pendingTutors: 0,
  bookings: 0,
  payments: 0,
  refundPending: 0,
  revenue: 0,
};

export function AdminDashboard() {
  const { user, token } = useAuth();
  const { view } = useLocalSearchParams<{ view?: string }>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const activeTab: AppTab =
    view === "users" ? "discover" : view === "verify" ? "bookings" : "home";

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [overview, accounts, paymentData] = await Promise.all([
        apiRequest<{ stats: Stats }>("/admin/overview", { headers }),
        apiRequest<{ users: AdminUser[] }>("/admin/users", { headers }),
        apiRequest<{ payments: Payment[] }>("/payments", { headers }),
      ]);
      setStats(overview.stats);
      setUsers(accounts.users);
      setPayments(paymentData.payments);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load admin data.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  const visibleUsers = useMemo(
    () =>
      users.filter((account) => {
        if (
          view === "verify" &&
          !(
            account.role === "tutor" &&
            !account.isVerified &&
            ["not_requested", "pending"].includes(
              account.verificationStatus || "not_requested",
            )
          )
        )
          return false;
        if (
          view === "users" &&
          roleFilter !== "all" &&
          account.role !== roleFilter
        )
          return false;
        const needle = query.trim().toLowerCase();
        return (
          !needle ||
          account.name.toLowerCase().includes(needle) ||
          account.email.toLowerCase().includes(needle)
        );
      }),
    [query, roleFilter, users, view],
  );

  async function updateAccount(
    account: AdminUser,
    update: {
      status?: "active" | "suspended";
      isVerified?: boolean;
      verificationNote?: string;
    },
    success: string,
  ) {
    if (!token) return;
    try {
      setBusyId(account._id);
      setError("");
      await apiRequest(`/admin/users/${account._id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(update),
      });
      await load();
      Alert.alert("Updated", success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account update failed.");
    } finally {
      setBusyId("");
    }
  }

  async function previewFile(account: AdminUser, fileId: string) {
    if (!token) return;
    const previewWindow =
      Platform.OS === "web" ? window.open("about:blank", "_blank") : null;
    try {
      setBusyId(account._id);
      setError("");
      const result = await apiRequest<{ path: string }>(
        `/admin/users/${account._id}/verification-files/${fileId}/preview`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (Platform.OS === "web") {
        if (!previewWindow)
          throw new Error("Allow pop-ups to preview this document.");
        previewWindow.location.href = apiUrl(result.path);
      } else {
        await WebBrowser.openBrowserAsync(apiUrl(result.path));
      }
    } catch (err) {
      previewWindow?.close();
      setError(
        err instanceof Error ? err.message : "Could not open this document.",
      );
    } finally {
      setBusyId("");
    }
  }

  function toggleStatus(account: AdminUser) {
    const suspending = account.status === "active";
    Alert.alert(
      suspending ? "Suspend account?" : "Restore account?",
      suspending
        ? `${account.name} will immediately lose app access.`
        : `${account.name} will regain app access.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: suspending ? "Suspend" : "Restore",
          style: suspending ? "destructive" : "default",
          onPress: () =>
            void updateAccount(
              account,
              { status: suspending ? "suspended" : "active" },
              suspending ? "Account suspended." : "Account restored.",
            ),
        },
      ],
    );
  }

  async function refund(payment: Payment) {
    if (!token || !payment.booking?._id) return;
    try {
      setBusyId(payment._id);
      setError("");
      await apiRequest(`/payments/${payment.booking._id}/refund`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
      Alert.alert(
        "Demo refund complete",
        "The booking and payment records were updated.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refund failed.");
    } finally {
      setBusyId("");
    }
  }

  if (user?.role !== "admin")
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="lock-closed" size={28} color="#655CF2" />
        <Text style={styles.accessTitle}>Admin access required</Text>
      </SafeAreaView>
    );
  const title =
    view === "users" ? (
      "Manage every user."
    ) : view === "verify" ? (
      "Tutor approvals."
    ) : (
      <>Platform at a{`\n`}glance.</>
    );
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <AppTopNav />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.kicker}>PLATFORM CONTROL CENTER</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {view === "verify"
            ? "Review qualifications and approve trusted tutors."
            : view === "users"
              ? "Search, filter and control account access."
              : "Live users, bookings and demo payment operations."}
        </Text>
        {!!error && (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={17} color="#BE506A" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        {view === undefined && (
          <Dashboard
            stats={stats}
            payments={payments}
            busyId={busyId}
            onRefund={(payment) =>
              Alert.alert(
                "Approve demo refund?",
                `Return Rs.${payment.amount.toLocaleString()} for ${payment.booking?.subject || "this lesson"}?`,
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Refund", onPress: () => void refund(payment) },
                ],
              )
            }
          />
        )}
        {(view === "users" || view === "verify") && (
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color="#77798C" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search name or email"
                placeholderTextColor="#9B9CAB"
                style={styles.searchInput}
              />
            </View>
            {view === "users" && (
              <View style={styles.filters}>
                {(["all", "student", "tutor"] as RoleFilter[]).map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => setRoleFilter(role)}
                    style={[
                      styles.filter,
                      roleFilter === role && styles.filterActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        roleFilter === role && styles.filterTextActive,
                      ]}
                    >
                      {role === "all" ? "All accounts" : `${role}s`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {view === "verify" ? "Pending applications" : "User directory"}
              </Text>
              <View style={styles.count}>
                <Text style={styles.countText}>{visibleUsers.length}</Text>
              </View>
            </View>
            {loading ? (
              <ActivityIndicator color="#655CF2" />
            ) : (
              visibleUsers.map((account) =>
                view === "verify" ? (
                  <VerificationCard
                    key={account._id}
                    account={account}
                    busy={busyId === account._id}
                    onPreview={(fileId) => void previewFile(account, fileId)}
                    onDecision={(approved, verificationNote) =>
                      void updateAccount(
                        account,
                        { isVerified: approved, verificationNote },
                        approved
                          ? "Tutor approved."
                          : "Tutor application rejected.",
                      )
                    }
                  />
                ) : (
                  <UserCard
                    key={account._id}
                    account={account}
                    busy={busyId === account._id}
                    onToggle={() => toggleStatus(account)}
                    onReview={() =>
                      router.replace({ pathname: "/admin", params: { view: "verify" } })
                    }
                  />
                ),
              )
            )}
            {!loading && !visibleUsers.length && (
              <Empty
                icon={view === "verify" ? "shield-checkmark" : "people"}
                title={
                  view === "verify"
                    ? "Approval queue is clear"
                    : "No accounts found"
                }
                text={
                  view === "verify"
                    ? "New tutor verification requests will appear here."
                    : "Try another search or role filter."
                }
              />
            )}
          </>
        )}
      </ScrollView>
      <AppBottomNav active={activeTab} />
    </SafeAreaView>
  );
}

function Dashboard({
  stats,
  payments,
  busyId,
  onRefund,
}: {
  stats: Stats;
  payments: Payment[];
  busyId: string;
  onRefund: (payment: Payment) => void;
}) {
  return (
    <>
      <LinearGradient
        colors={["#171536", "#4D3BC1", "#7361F4"]}
        style={styles.health}
      >
        <View>
          <Text style={styles.healthLabel}>DEMO REVENUE</Text>
          <Text style={styles.revenue}>
            Rs. {stats.revenue.toLocaleString()}
          </Text>
          <Text style={styles.healthSub}>
            {stats.payments} successful demo payments
          </Text>
        </View>
        <View style={styles.healthIcon}>
          <Ionicons name="analytics" size={26} color="#FFFFFF" />
        </View>
      </LinearGradient>
      <View style={styles.stats}>
        {[
          {
            icon: "people",
            value: stats.users,
            label: "Users",
            color: "#655CF2",
          },
          {
            icon: "pulse",
            value: stats.activeUsers,
            label: "Active",
            color: "#1B9D75",
          },
          {
            icon: "shield",
            value: stats.pendingTutors,
            label: "Verify",
            color: "#E0922E",
          },
          {
            icon: "return-down-back",
            value: stats.refundPending,
            label: "Refunds",
            color: "#CF5B76",
          },
        ].map((item) => (
          <View key={item.label} style={styles.stat}>
            <View
              style={[styles.statIcon, { backgroundColor: `${item.color}18` }]}
            >
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={item.color}
              />
            </View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.insight}>
        <View style={styles.insightIcon}>
          <Ionicons name="calendar" size={20} color="#655CF2" />
        </View>
        <View>
          <Text style={styles.insightValue}>
            {stats.bookings} total bookings
          </Text>
          <Text style={styles.insightText}>
            {stats.students} learners • {stats.tutors} tutors registered
          </Text>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment oversight</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{payments.length}</Text>
        </View>
      </View>
      {payments.slice(0, 20).map((payment) => (
        <View key={payment._id} style={styles.paymentCard}>
          <View
            style={[
              styles.paymentIcon,
              payment.status === "refund_pending" && styles.paymentIconWarn,
            ]}
          >
            <Ionicons
              name={
                payment.status === "refund_pending"
                  ? "return-down-back"
                  : "card"
              }
              size={18}
              color={
                payment.status === "refund_pending" ? "#C77B20" : "#655CF2"
              }
            />
          </View>
          <View style={styles.paymentCopy}>
            <Text style={styles.paymentTitle}>
              {payment.booking?.subject || "Tutoring session"}
            </Text>
            <Text style={styles.paymentPeople}>
              {payment.student?.name || "Learner"} →{" "}
              {payment.tutor?.name || "Tutor"}
            </Text>
            <Text style={styles.paymentRef}>
              {payment.transactionReference || "DEMO"} •{" "}
              {payment.status.replace("_", " ")}
            </Text>
          </View>
          <View style={styles.paymentRight}>
            <Text style={styles.paymentAmount}>
              Rs.{payment.amount.toLocaleString()}
            </Text>
            {payment.status === "refund_pending" && (
              <Pressable
                disabled={busyId === payment._id}
                onPress={() => onRefund(payment)}
                style={styles.refund}
              >
                {busyId === payment._id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.refundText}>Refund</Text>
                )}
              </Pressable>
            )}
          </View>
        </View>
      ))}
      {!payments.length && (
        <Empty
          icon="receipt-outline"
          title="No demo payments yet"
          text="Completed demo checkouts will appear here."
        />
      )}
    </>
  );
}

function UserCard({
  account,
  busy,
  onToggle,
  onReview,
}: {
  account: AdminUser;
  busy: boolean;
  onToggle: () => void;
  onReview: () => void;
}) {
  const awaitingApproval = account.role === "tutor" && !account.isVerified;
  return (
    <View style={styles.userCard}>
      <Avatar name={account.name} />
      <View style={styles.userCopy}>
        <Text style={styles.userName}>{account.name}</Text>
        <Text style={styles.email}>{account.email}</Text>
        <View style={styles.labels}>
          <Badge text={account.role} />
          <Badge
            text={account.status}
            danger={account.status === "suspended"}
            success={account.status === "active"}
          />
          {account.role === "tutor" && (
            <Badge
              text={account.isVerified ? "verified" : "pending"}
              success={account.isVerified}
            />
          )}
        </View>
      </View>
      {account.role !== "admin" && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={awaitingApproval ? `Review ${account.name}` : `${account.status === "active" ? "Suspend" : "Restore"} ${account.name}`}
          disabled={busy}
          onPress={awaitingApproval ? onReview : onToggle}
          style={[styles.more, awaitingApproval && styles.reviewMore]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#655CF2" />
          ) : (
            <Ionicons
              name={awaitingApproval ? "shield-checkmark-outline" : account.status === "active" ? "pause" : "play"}
              size={awaitingApproval ? 18 : 15}
              color={awaitingApproval ? "#D8852A" : "#655CF2"}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}
function VerificationCard({
  account,
  busy,
  onPreview,
  onDecision,
}: {
  account: AdminUser;
  busy: boolean;
  onPreview: (fileId: string) => void;
  onDecision: (approved: boolean, verificationNote?: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const qualifications =
    account.profile?.qualifications?.join(" • ") ||
    "No qualifications supplied";
  return (
    <View style={styles.verifyCard}>
      <View style={styles.verifyTop}>
        <Avatar name={account.name} />
        <View style={styles.userCopy}>
          <Text style={styles.userName}>{account.name}</Text>
          <Text style={styles.email}>{account.email}</Text>
        </View>
        <Badge
          text={account.verificationStatus === "pending" ? "pending" : "new tutor"}
        />
      </View>
      <Text style={styles.qualificationLabel}>QUALIFICATIONS</Text>
      <Text style={styles.qualification}>{qualifications}</Text>
      <Text style={styles.qualificationLabel}>SUPPORTING DOCUMENTS</Text>
      {account.profile?.verificationFiles?.length ? (
        account.profile.verificationFiles.map((document) => (
          <Pressable
            key={document.id}
            onPress={() => onPreview(document.id)}
            style={styles.documentRow}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${document.name}`}
          >
            <Ionicons name="document-text-outline" size={15} color="#655CF2" />
            <Text style={styles.documents}>{document.name} · Preview</Text>
          </Pressable>
        ))
      ) : (
        <Text style={styles.documents}>
          No supporting documents were provided. Review the account details
          before making a decision.
        </Text>
      )}
      {rejecting && (
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Explain what must be corrected (optional)"
          multiline
          maxLength={300}
          style={styles.rejectionInput}
        />
      )}
      <View style={styles.decisions}>
        <Pressable
          disabled={busy}
          onPress={() =>
            rejecting
              ? onDecision(
                  false,
                  reason.trim() ||
                    "Tutor application did not meet the current verification requirements.",
                )
              : setRejecting(true)
          }
          style={styles.reject}
        >
          <Ionicons name="close" size={16} color="#B94E67" />
          <Text style={styles.rejectText}>
            {rejecting ? "Confirm rejection" : "Reject"}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() =>
            onDecision(
              true,
              "Approved after reviewing qualifications and documents.",
            )
          }
          style={styles.approve}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              <Text style={styles.approveText}>Approve tutor</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
function Avatar({ name }: { name: string }) {
  return (
    <LinearGradient colors={["#8375FF", "#5748DB"]} style={styles.userAvatar}>
      <Text style={styles.initial}>
        {name
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)}
      </Text>
    </LinearGradient>
  );
}
function Badge({
  text,
  danger,
  success,
}: {
  text: string;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <Text
      style={[
        styles.badge,
        danger && styles.badgeDanger,
        success && styles.badgeSuccess,
      ]}
    >
      {text.toUpperCase()}
    </Text>
  );
}
function Empty({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={25} color="#655CF2" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F5FC" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#F4F2FC",
  },
  accessTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 18,
  },
  scroll: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 125 },
  kicker: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.45,
    marginTop: 5,
  },
  title: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -1,
    marginTop: 9,
  },
  subtitle: {
    color: "#77798C",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  error: {
    minHeight: 45,
    padding: 11,
    borderRadius: 15,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#FFD7E0",
  },
  errorText: {
    color: "#B94E67",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    flex: 1,
  },
  health: {
    minHeight: 150,
    borderRadius: 28,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    shadowColor: "#302767",
    shadowOpacity: 0.26,
    shadowRadius: 22,
    elevation: 9,
  },
  healthLabel: {
    color: "#C9C3F0",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  revenue: {
    color: "#FFFFFF",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 31,
    marginTop: 8,
  },
  healthSub: {
    color: "#D0CBE9",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 5,
  },
  healthIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  stats: { flexDirection: "row", gap: 8, marginTop: 14 },
  stat: {
    flex: 1,
    minHeight: 108,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECEAF4",
    shadowColor: "#302B59",
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 2,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
    marginTop: 6,
  },
  statLabel: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 1,
  },
  insight: {
    minHeight: 78,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    gap: 11,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ECEAF4",
    shadowColor: "#302B59",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  insightIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  insightValue: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
  },
  insightText: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 4,
  },
  search: {
    height: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 9,
    marginTop: 21,
    borderWidth: 1,
    borderColor: "#E8E6F0",
    shadowColor: "#302B5D",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  searchInput: {
    color: "#202233",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    flex: 1,
  },
  filters: { flexDirection: "row", gap: 8, marginTop: 12 },
  filter: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#EDEBF5",
    justifyContent: "center",
  },
  filterActive: { backgroundColor: "#655CF2" },
  filterText: { color: "#66687A", fontFamily: "Inter_700Bold", fontSize: 12 },
  filterTextActive: { color: "#FFFFFF" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 27,
    marginBottom: 13,
  },
  sectionTitle: {
    color: "#171A2B",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 17,
  },
  count: {
    minWidth: 25,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8E5FF",
    marginLeft: 7,
  },
  countText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 11 },
  userCard: {
    minHeight: 94,
    borderRadius: 21,
    padding: 13,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ECEAF3",
    shadowColor: "#302B59",
    shadowOpacity: 0.045,
    shadowRadius: 9,
    elevation: 2,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: "#FFFFFF", fontFamily: "Manrope_700Bold", fontSize: 16 },
  userCopy: { flex: 1, marginLeft: 10 },
  userName: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 15,
  },
  email: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  labels: { flexDirection: "row", gap: 5, marginTop: 6 },
  badge: {
    color: "#655CF2",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    backgroundColor: "#EFEDFF",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    overflow: "hidden",
  },
  badgeDanger: { color: "#B44D65", backgroundColor: "#FFF0F3" },
  badgeSuccess: { color: "#168B66", backgroundColor: "#E8F8F1" },
  more: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 5,
  },
  reviewMore: { backgroundColor: "#FFF4E4" },
  verifyCard: {
    borderRadius: 23,
    padding: 15,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ECEAF3",
    shadowColor: "#302B59",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  verifyTop: { flexDirection: "row", alignItems: "center" },
  qualificationLabel: {
    color: "#9697A5",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 15,
  },
  qualification: {
    color: "#363849",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    lineHeight: 16,
    marginTop: 5,
  },
  documents: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 5,
  },
  documentRow: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: "#F5F3FA",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 9,
    marginTop: 6,
  },
  rejectionInput: {
    minHeight: 72,
    borderRadius: 13,
    backgroundColor: "#FFF7F8",
    borderWidth: 1,
    borderColor: "#F1CCD5",
    color: "#292B3B",
    padding: 10,
    marginTop: 11,
    textAlignVertical: "top",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
  decisions: { flexDirection: "row", gap: 9, marginTop: 14 },
  reject: {
    flex: 1,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFF0F3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  rejectText: { color: "#B94E67", fontFamily: "Inter_700Bold", fontSize: 12 },
  approve: {
    flex: 1.4,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#1DA979",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  approveText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  paymentCard: {
    minHeight: 94,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ECEAF3",
    shadowColor: "#302B59",
    shadowOpacity: 0.045,
    shadowRadius: 9,
    elevation: 2,
  },
  paymentIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentIconWarn: { backgroundColor: "#FFF2DC" },
  paymentCopy: { flex: 1, marginLeft: 10 },
  paymentTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 14,
  },
  paymentPeople: {
    color: "#6F7183",
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    marginTop: 3,
  },
  paymentRef: {
    color: "#A0A1AF",
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    marginTop: 4,
    textTransform: "uppercase",
  },
  paymentRight: { alignItems: "flex-end", gap: 7 },
  paymentAmount: {
    color: "#202233",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  refund: {
    height: 28,
    minWidth: 55,
    borderRadius: 9,
    backgroundColor: "#D88724",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  refundText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 11 },
  empty: {
    minHeight: 172,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: "#ECEAF3",
    shadowColor: "#302B59",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: "#EFEDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#202233",
    fontFamily: "Manrope_800ExtraBold",
    fontSize: 16,
    marginTop: 11,
  },
  emptyText: {
    color: "#858697",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 5,
  },
});
