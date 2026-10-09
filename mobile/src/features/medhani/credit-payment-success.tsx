import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View, Pressable } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";

export function CreditPaymentSuccessScreen() {
  const params = useLocalSearchParams<{
    credits?: string;
    balance?: string;
    amount?: string;
    packageName?: string;
    paymentMethod?: string;
    last4?: string;
    reference?: string;
  }>();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const credits = Math.max(0, Number(params.credits) || 0);
  const balance = Math.max(0, Number(params.balance) || 0);
  const amount = Math.max(0, Number(params.amount) || 0);
  const method = params.last4 ? `${params.paymentMethod || "Card"} ···· ${params.last4}` : params.paymentMethod || "Payment";

  return (
    <FeatureShell activeTab="home" title="Payment status" subtitle={`Hi, ${user?.name?.split(" ")[0] || "Learner"}. Your credit top up is complete.`}>
      <View style={styles.hero}>
        <View style={styles.confettiLeft} />
        <View style={styles.confettiRight} />
        <View style={styles.successRing}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={34} color="#FFFFFF" /></View>
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Payment successful</Text>
        <Text style={[styles.reference, { color: colors.textMuted }]}>Transaction ID: {params.reference || "Completed"}</Text>
      </View>

      <View style={[styles.creditCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.creditIcon}><Ionicons name="sparkles" size={20} color="#FFFFFF" /></View>
        <View style={styles.creditCopy}>
          <Text style={[styles.creditLabel, { color: colors.textMuted }]}>CREDITS ADDED TO WALLET</Text>
          <Text style={[styles.creditValue, { color: colors.text }]}>+{credits} credits</Text>
        </View>
        <Text style={styles.completedBadge}>Credited</Text>
      </View>

      <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <DetailRow label="Updated wallet balance" value={`${balance} credits`} colors={colors} />
        <DetailRow label="Amount paid" value={`Rs. ${amount.toLocaleString()}`} colors={colors} />
        <DetailRow label="Selected package" value={params.packageName || "Credit package"} colors={colors} />
        <DetailRow label="Payment method" value={method} colors={colors} />
        <DetailRow label="Status" value="Completed" success colors={colors} />
      </View>

      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={17} color="#655CF2" />
        <Text style={styles.noticeText}>Your wallet was credited immediately. You can now use these credits to unlock lessons.</Text>
      </View>

      <Pressable onPress={() => router.replace("/credits")} style={styles.primaryButton}>
        <Text style={styles.primaryText}>View credit balance</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </Pressable>
      <Pressable onPress={() => router.replace("/home")} style={[styles.secondaryButton, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="home-outline" size={15} color="#655CF2" />
        <Text style={styles.secondaryText}>Go to dashboard</Text>
      </Pressable>
      <Text style={[styles.support, { color: colors.textMuted }]}>Need help with this transaction? Contact support.</Text>
    </FeatureShell>
  );
}

function DetailRow({ label, value, success, colors }: { label: string; value: string; success?: boolean; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return <View style={styles.detailRow}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text><Text numberOfLines={1} style={[styles.detailValue, { color: success ? "#16845F" : colors.text }, success && styles.statusValue]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  hero: { minHeight: 194, alignItems: "center", justifyContent: "center", position: "relative" },
  successRing: { width: 86, height: 86, borderRadius: 43, backgroundColor: "#DFF9F1", alignItems: "center", justifyContent: "center" },
  successIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#13B88A", alignItems: "center", justifyContent: "center", shadowColor: "#13B88A", shadowOpacity: 0.28, shadowRadius: 12, elevation: 5 },
  confettiLeft: { position: "absolute", left: 52, top: 50, width: 7, height: 7, borderRadius: 2, backgroundColor: "#8A7CFF", transform: [{ rotate: "22deg" }] },
  confettiRight: { position: "absolute", right: 55, top: 69, width: 8, height: 5, borderRadius: 2, backgroundColor: "#F2B63F", transform: [{ rotate: "-24deg" }] },
  successTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 20, textTransform: "uppercase", marginTop: 15 },
  reference: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 5 },
  creditCard: { minHeight: 74, borderWidth: 1, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center" },
  creditIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#655CF2", alignItems: "center", justifyContent: "center" },
  creditCopy: { flex: 1, marginLeft: 10 },
  creditLabel: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.6 },
  creditValue: { fontFamily: "Manrope_800ExtraBold", fontSize: 18, marginTop: 3 },
  completedBadge: { color: "#16845F", backgroundColor: "#E8FAF3", borderRadius: 9, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 5, fontFamily: "Inter_700Bold", fontSize: 8 },
  detailsCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 12 },
  detailRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  detailLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
  detailValue: { maxWidth: "60%", textAlign: "right", fontFamily: "Inter_700Bold", fontSize: 10 },
  statusValue: { backgroundColor: "#E8FAF3", borderRadius: 8, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 4 },
  notice: { minHeight: 60, borderRadius: 16, padding: 12, backgroundColor: "#EFEDFF", marginTop: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noticeText: { flex: 1, color: "#615A8A", fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 15 },
  primaryButton: { height: 50, borderRadius: 14, marginTop: 16, backgroundColor: "#655CF2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#5144CB", shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  primaryText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  secondaryButton: { height: 46, borderWidth: 1, borderRadius: 14, marginTop: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  secondaryText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 11 },
  support: { fontFamily: "Inter_400Regular", fontSize: 8.5, textAlign: "center", marginTop: 12 },
});
