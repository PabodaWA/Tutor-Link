import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type PackageId = "starter" | "study" | "semester";
type PaymentMethod = "card" | "wallet" | "bank";

const validPackages = new Set<PackageId>(["starter", "study", "semester"]);
const methodLabels: Record<PaymentMethod, string> = {
  card: "Credit / Debit Card",
  wallet: "Genie / eZ Cash",
  bank: "Direct Bank Transfer",
};

export function CreditPaymentScreen() {
  const params = useLocalSearchParams<{
    packageId?: string;
    credits?: string;
    amount?: string;
    packageName?: string;
    paymentMethod?: string;
  }>();
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const packageId = validPackages.has(params.packageId as PackageId)
    ? (params.packageId as PackageId)
    : null;
  const paymentMethod = (["card", "wallet", "bank"].includes(params.paymentMethod || "")
    ? params.paymentMethod
    : "card") as PaymentMethod;
  const credits = Math.max(0, Number(params.credits) || 0);
  const amount = Math.max(0, Number(params.amount) || 0);
  const packageName = params.packageName || "Credit package";

  const [cardholder, setCardholder] = useState(user?.name || "");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [saveCard, setSaveCard] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cardDigits = cardNumber.replace(/\D/g, "");
  const mobileDigits = mobileNumber.replace(/\D/g, "");
  const expiryValid = useMemo(() => {
    const match = expiry.match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  }, [expiry]);
  const formValid = useMemo(() => {
    if (!packageId || !credits || !amount) return false;
    if (paymentMethod === "card") {
      return cardholder.trim().length >= 2 && cardDigits.length === 16 && expiryValid && /^\d{3,4}$/.test(cvv);
    }
    if (paymentMethod === "wallet") return mobileDigits.length >= 9;
    return true;
  }, [amount, cardDigits.length, cardholder, credits, cvv, expiryValid, mobileDigits.length, packageId, paymentMethod]);

  const validationMessage = useMemo(() => {
    if (!packageId || !credits || !amount) return "The selected credit package is invalid. Please go back and select it again.";
    if (paymentMethod === "wallet" && mobileDigits.length < 9) return "Enter a valid mobile wallet number.";
    if (paymentMethod !== "card") return "";
    if (cardholder.trim().length < 2) return "Enter the cardholder name.";
    if (cardDigits.length !== 16) return "Card number must contain 16 digits.";
    if (!expiryValid) return "Enter a valid future expiry date in MM/YY format.";
    if (!/^\d{3,4}$/.test(cvv)) return "CVV must contain 3 or 4 digits.";
    return "";
  }, [amount, cardDigits.length, cardholder, credits, cvv, expiryValid, mobileDigits.length, packageId, paymentMethod]);

  function updateCardNumber(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    setCardNumber(digits.replace(/(.{4})/g, "$1 ").trim());
  }

  function updateExpiry(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  }

  function useDemoCard() {
    const demoYear = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");
    setCardholder((current) => current.trim() || "Amal Perera");
    setCardNumber("4532 0000 0000 8821");
    setExpiry(`12/${demoYear}`);
    setCvv("892");
    setError("");
  }

  async function pay() {
    if (busy) return;
    if (!formValid) {
      setError(validationMessage || "Please check the payment details and try again.");
      return;
    }
    if (!token || !packageId) {
      setError("Your session has expired. Please sign in and try again.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const result = await apiRequest<{
        balance: number;
        transaction: { reference?: string; _id?: string };
      }>("/credits/buy", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ packageId, paymentMethod }),
      });
      router.replace({
        pathname: "/credits/success",
        params: {
          credits: String(credits),
          balance: String(result.balance),
          amount: String(amount),
          packageName,
          paymentMethod: methodLabels[paymentMethod],
          last4: paymentMethod === "card" ? cardDigits.slice(-4) : "",
          reference: result.transaction.reference || result.transaction._id || "Completed",
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FeatureShell
      activeTab="home"
      showBack
      fallbackHref="/credits/top-up"
      title={`${methodLabels[paymentMethod]} payment`}
      subtitle={`Complete your ${packageName.toLowerCase()} credit top up.`}
    >
      <LinearGradient colors={["#312776", "#6554E8"]} style={styles.amountCard}>
        <View>
          <Text style={styles.amountLabel}>TOTAL AMOUNT TO PAY</Text>
          <Text style={styles.amount}>Rs. {amount.toLocaleString()}</Text>
        </View>
        <View style={styles.selectedPack}>
          <Text style={styles.selectedPackLabel}>SELECTED PACK</Text>
          <Text style={styles.selectedPackValue}>{packageName}</Text>
        </View>
        <View style={styles.creditLine}>
          <Ionicons name="sparkles" size={13} color="#FFF2A6" />
          <Text style={styles.creditLineText}>{credits} credits</Text>
          <Text style={styles.instantBadge}>INSTANT TOP UP</Text>
        </View>
      </LinearGradient>

      {paymentMethod === "card" && (
        <View style={styles.form}>
          <View style={styles.demoCardRow}>
            <View style={styles.demoCardCopy}>
              <Text style={[styles.demoCardTitle, { color: colors.text }]}>Prototype payment</Text>
              <Text style={[styles.demoCardHint, { color: colors.textMuted }]}>Use safe demo details instead of a real card.</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={useDemoCard} style={styles.demoCardButton}>
              <Ionicons name="flash" size={13} color="#655CF2" />
              <Text style={styles.demoCardButtonText}>Use demo card</Text>
            </Pressable>
          </View>
          <FieldLabel text="Cardholder name" />
          <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput value={cardholder} onChangeText={setCardholder} autoComplete="off" importantForAutofill="no" textContentType="none" placeholder="Name on card" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
            <Ionicons name="person-outline" size={16} color={colors.textMuted} />
          </View>

          <FieldLabel text="Card number" />
          <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="card-outline" size={17} color="#655CF2" />
            <TextInput value={cardNumber} onChangeText={updateCardNumber} keyboardType="number-pad" autoComplete="off" importantForAutofill="no" textContentType="none" maxLength={19} placeholder="0000 0000 0000 0000" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
            {cardDigits.length === 16 && <Ionicons name="checkmark-circle" size={17} color="#13A979" />}
          </View>

          <View style={styles.splitFields}>
            <View style={styles.splitField}>
              <FieldLabel text="Expiry date" />
              <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput value={expiry} onChangeText={updateExpiry} keyboardType="number-pad" autoComplete="off" importantForAutofill="no" textContentType="none" maxLength={5} placeholder="MM/YY" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
                <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
              </View>
            </View>
            <View style={styles.splitField}>
              <FieldLabel text="CVV / CVC" />
              <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput value={cvv} onChangeText={(value) => setCvv(value.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" autoComplete="off" importantForAutofill="no" textContentType="none" secureTextEntry maxLength={4} placeholder="CVV" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
                <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
              </View>
            </View>
          </View>

          <Pressable onPress={() => setSaveCard((value) => !value)} style={styles.saveRow}>
            <View style={[styles.checkbox, saveCard && styles.checkboxActive]}>
              {saveCard && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
            </View>
            <Text style={[styles.saveText, { color: colors.textMuted }]}>Save card securely for faster top-ups</Text>
          </Pressable>
          <View style={[styles.accepted, { backgroundColor: colors.surface }]}>
            <Text style={styles.cardBrand}>VISA</Text>
            <Text style={[styles.cardBrand, styles.mastercard]}>MC</Text>
            <Text style={[styles.acceptedText, { color: colors.textMuted }]}>All major debit and credit cards accepted</Text>
          </View>
        </View>
      )}

      {paymentMethod === "wallet" && (
        <View style={styles.form}>
          <FieldLabel text="Mobile wallet number" />
          <View style={[styles.inputShell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="phone-portrait-outline" size={17} color="#655CF2" />
            <TextInput value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" autoComplete="tel" placeholder="07X XXX XXXX" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text }]} />
          </View>
          <Text style={[styles.methodHelp, { color: colors.textMuted }]}>A wallet confirmation will be simulated after you continue.</Text>
        </View>
      )}

      {paymentMethod === "bank" && (
        <View style={[styles.bankNotice, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.bankIcon}><Ionicons name="business-outline" size={22} color="#655CF2" /></View>
          <View style={styles.bankCopy}>
            <Text style={[styles.bankTitle, { color: colors.text }]}>Direct bank transfer</Text>
            <Text style={[styles.methodHelp, { color: colors.textMuted }]}>Continue to complete a simulated secure bank transfer.</Text>
          </View>
        </View>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pay()} style={[styles.payButton, busy && styles.disabled]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="lock-closed" size={15} color="#FFFFFF" /><Text style={styles.payText}>Pay Rs. {amount.toLocaleString()}</Text><Ionicons name="arrow-forward" size={16} color="#FFFFFF" /></>}
      </Pressable>
      {!formValid && !error && <Text style={[styles.validationHint, { color: colors.textMuted }]}>Complete the payment details above, then tap Pay.</Text>}
      <Pressable disabled={busy} onPress={() => router.back()} style={styles.cancelButton}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></Pressable>
      <View style={styles.securityNote}><Ionicons name="shield-checkmark-outline" size={14} color="#16A075" /><Text style={[styles.securityText, { color: colors.textMuted }]}>Your payment details are used only for this prototype and are not stored.</Text></View>
    </FeatureShell>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.fieldLabel}>{text}</Text>;
}

const styles = StyleSheet.create({
  amountCard: { minHeight: 145, borderRadius: 22, padding: 17, position: "relative" },
  amountLabel: { color: "#CAC4F5", fontFamily: "Inter_700Bold", fontSize: 8.5, letterSpacing: 0.8 },
  amount: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 27, marginTop: 7 },
  selectedPack: { position: "absolute", right: 17, top: 18, alignItems: "flex-end" },
  selectedPackLabel: { color: "#CFC9F7", fontFamily: "Inter_700Bold", fontSize: 7 },
  selectedPackValue: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 11, marginTop: 5 },
  creditLine: { marginTop: 18, flexDirection: "row", alignItems: "center", gap: 6 },
  creditLineText: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold", fontSize: 10 },
  instantBadge: { marginLeft: "auto", color: "#176D55", backgroundColor: "#DDF9EF", borderRadius: 8, overflow: "hidden", paddingHorizontal: 7, paddingVertical: 4, fontFamily: "Inter_700Bold", fontSize: 7 },
  form: { marginTop: 18 },
  demoCardRow: { minHeight: 58, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#EFEDFF", flexDirection: "row", alignItems: "center", gap: 8 },
  demoCardCopy: { flex: 1 },
  demoCardTitle: { fontFamily: "Inter_700Bold", fontSize: 11 },
  demoCardHint: { fontFamily: "Inter_400Regular", fontSize: 8.5, lineHeight: 12, marginTop: 2 },
  demoCardButton: { minHeight: 32, borderRadius: 10, paddingHorizontal: 9, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 5 },
  demoCardButtonText: { color: "#655CF2", fontFamily: "Inter_700Bold", fontSize: 8.5 },
  fieldLabel: { color: "#625E75", fontFamily: "Inter_700Bold", fontSize: 9, marginBottom: 6, marginTop: 10 },
  inputShell: { minHeight: 47, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  input: { flex: 1, minHeight: 45, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  splitFields: { flexDirection: "row", gap: 10 },
  splitField: { flex: 1 },
  saveRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1, borderColor: "#C7C2D8", alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: "#655CF2", borderColor: "#655CF2" },
  saveText: { fontFamily: "Inter_400Regular", fontSize: 10 },
  accepted: { minHeight: 39, borderRadius: 12, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  cardBrand: { color: "#3557B7", backgroundColor: "#EEF3FF", borderRadius: 5, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 3, fontFamily: "Inter_700Bold", fontSize: 7 },
  mastercard: { color: "#C46B22", backgroundColor: "#FFF2E8" },
  acceptedText: { flex: 1, textAlign: "right", fontFamily: "Inter_400Regular", fontSize: 8 },
  methodHelp: { fontFamily: "Inter_400Regular", fontSize: 10, lineHeight: 15, marginTop: 8 },
  bankNotice: { borderWidth: 1, borderRadius: 18, padding: 15, marginTop: 18, flexDirection: "row", alignItems: "center" },
  bankIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: "#ECE9FF", alignItems: "center", justifyContent: "center" },
  bankCopy: { flex: 1, marginLeft: 10 },
  bankTitle: { fontFamily: "Manrope_800ExtraBold", fontSize: 13 },
  error: { color: "#B64D66", backgroundColor: "#FFF0F3", borderRadius: 12, padding: 11, marginTop: 12, fontFamily: "Inter_600SemiBold", fontSize: 11 },
  payButton: { height: 50, borderRadius: 14, backgroundColor: "#655CF2", marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#5144CB", shadowOpacity: 0.25, shadowRadius: 10, elevation: 5 },
  payText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  validationHint: { fontFamily: "Inter_400Regular", fontSize: 9, lineHeight: 14, textAlign: "center", marginTop: 8 },
  disabled: { opacity: 0.45 },
  cancelButton: { height: 40, alignItems: "center", justifyContent: "center" },
  cancelText: { fontFamily: "Inter_700Bold", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 },
  securityNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 18 },
  securityText: { flexShrink: 1, fontFamily: "Inter_400Regular", fontSize: 8.5, lineHeight: 13, textAlign: "center" },
});
