import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type PackageId = "starter" | "study" | "semester";
type CreditPackage = { id: PackageId; credits: number };
type PaymentMethod = "card" | "wallet" | "bank";

const packagePresentation: Record<PackageId, { name: string; price: number; badge?: string }> = {
  starter: { name: "Starter", price: 750 },
  study: { name: "Popular", price: 1350, badge: "BEST VALUE" },
  semester: { name: "Master", price: 2500 },
};

const paymentMethods: { id: PaymentMethod; title: string; caption: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "card", title: "Credit / Debit Card", caption: "Mastercard · Visa", icon: "card-outline" },
  { id: "wallet", title: "Genie / eZ Cash", caption: "Mobile wallet", icon: "phone-portrait-outline" },
  { id: "bank", title: "Direct Bank Transfer", caption: "Online banking", icon: "business-outline" },
];

export function TopUpCreditsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [selectedId, setSelectedId] = useState<PackageId | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await apiRequest<{ balance: number; packages: CreditPackage[] }>("/credits", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBalance(data.balance);
      setPackages(data.packages);
      setSelectedId((current) => current || data.packages[1]?.id || data.packages[0]?.id || null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load top-up options.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedId) || null,
    [packages, selectedId],
  );
  const selectedPresentation = selectedId ? packagePresentation[selectedId] : null;

  function openPayment() {
    if (!selectedPackage || !selectedPresentation) return;
    router.push({
      pathname: "/credits/payment",
      params: {
        packageId: selectedPackage.id,
        credits: String(selectedPackage.credits),
        amount: String(selectedPresentation.price),
        packageName: selectedPresentation.name,
        paymentMethod,
      },
    });
  }

  return (
    <FeatureShell
      activeTab="home"
      showBack
      fallbackHref="/credits"
      title="Top up credits"
      subtitle="Choose a credit package and your preferred payment method."
    >
      <View style={styles.balanceStrip}>
        <View style={styles.balanceIcon}>
          <Ionicons name="sparkles" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.balanceCopy}>
          <Text style={styles.balanceLabel}>CURRENT BALANCE</Text>
          <Text style={styles.balanceValue}>{balance} credits</Text>
        </View>
        <View style={styles.secureBadge}>
          <Ionicons name="shield-checkmark" size={13} color="#16845F" />
          <Text style={styles.secureBadgeText}>Secure</Text>
        </View>
      </View>

      <SectionTitle label="SELECT PACKAGE" />
      {loading ? (
        <ActivityIndicator color="#655CF2" style={styles.loader} />
      ) : (
        <View style={styles.packageRow}>
          {packages.map((item) => {
            const presentation = packagePresentation[item.id];
            const selected = selectedId === item.id;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={item.id}
                onPress={() => setSelectedId(item.id)}
                style={[
                  styles.packageCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selected && styles.packageCardSelected,
                ]}
              >
                {!!presentation.badge && (
                  <Text style={[styles.packageBadge, selected && styles.packageBadgeSelected]}>
                    {presentation.badge}
                  </Text>
                )}
                <Text style={[styles.packageName, { color: selected ? "#FFFFFF" : colors.textMuted }]}>
                  {presentation.name.toUpperCase()}
                </Text>
                <Text style={[styles.packageCredits, { color: selected ? "#FFFFFF" : colors.text }]}>
                  {item.credits}
                </Text>
                <Text style={[styles.packageUnit, { color: selected ? "#D9D5FF" : colors.textMuted }]}>credits</Text>
                <Text style={[styles.packagePrice, { color: selected ? "#FFFFFF" : "#655CF2" }]}>
                  Rs. {presentation.price.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <SectionTitle label="PAYMENT METHOD" />
      <View style={styles.methodList}>
        {paymentMethods.map((method) => {
          const selected = paymentMethod === method.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={method.id}
              onPress={() => setPaymentMethod(method.id)}
              style={[
                styles.methodCard,
                { backgroundColor: colors.surface, borderColor: selected ? "#655CF2" : colors.border },
              ]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioCenter} />}
              </View>
              <View style={[styles.methodIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={method.icon} size={17} color="#655CF2" />
              </View>
              <View style={styles.methodCopy}>
                <Text style={[styles.methodTitle, { color: colors.text }]}>{method.title}</Text>
                <Text style={[styles.methodCaption, { color: colors.textMuted }]}>{method.caption}</Text>
              </View>
              {method.id === "card" && <Text style={styles.defaultBadge}>DEFAULT</Text>}
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>

      {!!selectedPackage && !!selectedPresentation && (
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Credit package</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedPackage.credits} credits</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Processing fee</Text>
            <Text style={styles.freeValue}>FREE</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <View>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total payable amount</Text>
              <Text style={[styles.totalSub, { color: colors.textMuted }]}>Includes all applicable charges</Text>
            </View>
            <Text style={styles.totalValue}>Rs. {selectedPresentation.price.toLocaleString()}</Text>
          </View>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        disabled={!selectedPackage || loading}
        onPress={openPayment}
        style={[styles.confirmButton, (!selectedPackage || loading) && styles.disabled]}
      >
        <Ionicons name="lock-closed" size={15} color="#FFFFFF" />
        <Text style={styles.confirmText}>Confirm & Pay</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </Pressable>
      <Pressable onPress={() => router.back()} style={styles.cancelButton}>
        <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
      </Pressable>
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>No real payment is collected in this prototype checkout.</Text>
    </FeatureShell>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

const styles = StyleSheet.create({
  balanceStrip: { minHeight: 76, borderRadius: 20, padding: 14, backgroundColor: "#302777", flexDirection: "row", alignItems: "center" },
  balanceIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#655CF2", alignItems: "center", justifyContent: "center" },
  balanceCopy: { flex: 1, marginLeft: 10 },
  balanceLabel: { color: "#C9C4F4", fontFamily: "Inter_700Bold", fontSize: 8.5, letterSpacing: 0.8 },
  balanceValue: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 18, marginTop: 3 },
  secureBadge: { minHeight: 27, borderRadius: 10, paddingHorizontal: 8, backgroundColor: "#E8FAF3", flexDirection: "row", alignItems: "center", gap: 4 },
  secureBadgeText: { color: "#16845F", fontFamily: "Inter_700Bold", fontSize: 8.5 },
  sectionTitle: { color: "#78748E", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 1, marginTop: 20, marginBottom: 9 },
  loader: { marginVertical: 25 },
  packageRow: { flexDirection: "row", gap: 8 },
  packageCard: { flex: 1, minHeight: 146, borderWidth: 1, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  packageCardSelected: { backgroundColor: "#655CF2", borderColor: "#655CF2", shadowColor: "#4A3CC5", shadowOpacity: 0.25, shadowRadius: 12, elevation: 5 },
  packageBadge: { position: "absolute", top: 7, color: "#655CF2", backgroundColor: "#ECE9FF", borderRadius: 7, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 3, fontFamily: "Inter_700Bold", fontSize: 6.5 },
  packageBadgeSelected: { color: "#4F43BD", backgroundColor: "#FFFFFF" },
  packageName: { fontFamily: "Inter_700Bold", fontSize: 8, letterSpacing: 0.6 },
  packageCredits: { fontFamily: "Manrope_800ExtraBold", fontSize: 25, marginTop: 5 },
  packageUnit: { fontFamily: "Inter_400Regular", fontSize: 9 },
  packagePrice: { fontFamily: "Inter_700Bold", fontSize: 9.5, marginTop: 8 },
  methodList: { gap: 8 },
  methodCard: { minHeight: 58, borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, flexDirection: "row", alignItems: "center" },
  radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: "#C9C5D8", alignItems: "center", justifyContent: "center" },
  radioSelected: { borderColor: "#655CF2" },
  radioCenter: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#655CF2" },
  methodIcon: { width: 34, height: 34, borderRadius: 11, marginLeft: 9, alignItems: "center", justifyContent: "center" },
  methodCopy: { flex: 1, marginLeft: 9 },
  methodTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  methodCaption: { fontFamily: "Inter_400Regular", fontSize: 8.5, marginTop: 2 },
  defaultBadge: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 7, marginRight: 7 },
  summaryCard: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 18 },
  summaryRow: { minHeight: 27, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontFamily: "Inter_400Regular", fontSize: 10 },
  summaryValue: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  freeValue: { color: "#16845F", fontFamily: "Inter_700Bold", fontSize: 9 },
  summaryDivider: { height: 1, backgroundColor: "#ECE9F3", marginVertical: 9 },
  totalLabel: { fontFamily: "Inter_700Bold", fontSize: 11 },
  totalSub: { fontFamily: "Inter_400Regular", fontSize: 8, marginTop: 2 },
  totalValue: { color: "#655CF2", fontFamily: "Manrope_800ExtraBold", fontSize: 17 },
  error: { color: "#B64D66", backgroundColor: "#FFF0F3", borderRadius: 12, padding: 11, marginTop: 12, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  confirmButton: { height: 50, borderRadius: 14, marginTop: 18, backgroundColor: "#655CF2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#5144CB", shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  confirmText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  disabled: { opacity: 0.5 },
  cancelButton: { height: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: "Inter_700Bold", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  disclaimer: { fontFamily: "Inter_400Regular", fontSize: 8.5, lineHeight: 13, textAlign: "center", paddingHorizontal: 20 },
});
