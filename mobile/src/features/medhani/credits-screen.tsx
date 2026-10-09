import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { FeatureShell } from "@/components/feature-shell";
import { useAuth } from "@/context/auth-context";
import { useAppTheme } from "@/context/theme-context";
import { apiRequest } from "@/services/api";

type Transaction = { _id: string; type: string; amount: number; balanceAfter: number; description: string; createdAt: string; booking?: { subject?: string } };

export function CreditsScreen() {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ balance: number; transactions: Transaction[] }>("/credits", { headers: { Authorization: `Bearer ${token}` } });
      setBalance(data.balance);
      setTransactions(data.transactions);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load credits.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const request = setTimeout(() => void load(), 0);
    return () => clearTimeout(request);
  }, [load]);

  async function redeemCode() {
    if (!token) return;
    try {
      setBusy("redeem");
      setError("");
      setMessage("");
      const result = await apiRequest<{ message: string }>("/credits/redeem", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ code }) });
      setMessage(result.message);
      setCode("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credit operation failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <FeatureShell activeTab="home" showBack fallbackHref="/home" title="Tutor Link credits" subtitle="Keep enough credits to book lessons and unlock online meetings.">
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <View style={styles.balanceRow}>
            <Ionicons name="sparkles" size={27} color="#FFF4A8" />
            <Text style={styles.balance}>{balance}</Text>
            <Text style={styles.creditWord}>credits</Text>
          </View>
          <Text style={styles.balanceHint}>Booking checks your balance. Credits are charged only when you unlock the meeting.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Top up credits" disabled={!!busy} onPress={() => router.push("/credits/top-up")} style={styles.topUpButton}>
            <View style={styles.topUpIcon}><Ionicons name="add" size={17} color="#4F40C5" /></View>
            <Text style={styles.topUpText}>Top up credits</Text>
            <Ionicons name="arrow-forward" size={16} color="#4F40C5" />
          </Pressable>
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>Redeem a code</Text>
        <View style={[styles.redeem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput accessibilityLabel="Credit redeem code" autoCapitalize="characters" value={code} onChangeText={setCode} placeholder="Enter code" placeholderTextColor="#999AAC" style={[styles.input, { color: colors.text }]} />
          <Pressable disabled={!code.trim() || !!busy} onPress={() => void redeemCode()} style={[styles.redeemButton, (!code.trim() || !!busy) && styles.disabled]}>
            {busy === "redeem" ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.redeemText}>Redeem</Text>}
          </Pressable>
        </View>
        <Text style={[styles.codeHint, { color: colors.textMuted }]}>Prototype codes: TUTORLINK25 or STUDY50 (one use each)</Text>
        {!!message && <Text style={styles.success}>{message}</Text>}
        {!!error && <Text style={styles.error}>{error}</Text>}

        <Text style={[styles.heading, { color: colors.text }]}>Credit activity</Text>
        {loading && <ActivityIndicator color="#655CF2" />}
        {!loading && !transactions.length && (
          <View style={[styles.empty, { backgroundColor: colors.surface }]}>
            <Ionicons name="receipt-outline" size={25} color="#655CF2" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Your credit activity will appear here.</Text>
          </View>
        )}
        {transactions.map((item) => (
          <View key={item._id} style={[styles.transaction, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.transactionIcon, item.amount < 0 && styles.transactionIconDebit]}>
              <Ionicons name={item.amount < 0 ? "arrow-up" : "arrow-down"} size={15} color={item.amount < 0 ? "#B64D66" : "#148466"} />
            </View>
            <View style={styles.transactionCopy}>
              <Text style={[styles.transactionTitle, { color: colors.text }]}>{item.description}</Text>
              <Text style={[styles.transactionDate, { color: colors.textMuted }]}>{new Date(item.createdAt).toLocaleString()} · Balance {item.balanceAfter}</Text>
            </View>
            <Text style={[styles.transactionAmount, item.amount < 0 && styles.debit]}>{item.amount > 0 ? "+" : ""}{item.amount}</Text>
          </View>
        ))}
      </FeatureShell>
    </>
  );
}

const styles = StyleSheet.create({
  balanceCard: { borderRadius: 26, padding: 20, backgroundColor: "#342B82", marginBottom: 8 },
  balanceLabel: { color: "#CBC6FF", fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 1 },
  balanceRow: { flexDirection: "row", alignItems: "baseline", gap: 7, marginTop: 8 },
  balance: { color: "#FFFFFF", fontFamily: "Manrope_800ExtraBold", fontSize: 42 },
  creditWord: { color: "#DCD8FF", fontFamily: "Inter_700Bold", fontSize: 14 },
  balanceHint: { color: "#D4D0F5", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16, marginTop: 8 },
  topUpButton: { width: 230, height: 45, borderRadius: 14, marginTop: 16, alignSelf: "center", paddingHorizontal: 10, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 9 },
  topUpIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: "#ECE9FF", alignItems: "center", justifyContent: "center" },
  topUpText: { flex: 1, color: "#4F40C5", fontFamily: "Inter_700Bold", fontSize: 12 },
  heading: { fontFamily: "Manrope_800ExtraBold", fontSize: 17, marginTop: 20, marginBottom: 10 },
  redeem: { borderWidth: 1, borderRadius: 16, padding: 6, flexDirection: "row" },
  input: { flex: 1, height: 44, paddingHorizontal: 10, fontFamily: "Inter_700Bold", fontSize: 13 },
  redeemButton: { minWidth: 90, borderRadius: 12, backgroundColor: "#655CF2", alignItems: "center", justifyContent: "center" },
  redeemText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 12 },
  disabled: { opacity: 0.45 },
  codeHint: { fontFamily: "Inter_400Regular", fontSize: 10, marginTop: 7 },
  success: { color: "#148466", backgroundColor: "#E8F9F2", padding: 11, borderRadius: 12, marginTop: 10, fontFamily: "Inter_700Bold", fontSize: 12 },
  error: { color: "#B64D66", backgroundColor: "#FFF0F3", padding: 11, borderRadius: 12, marginTop: 10, fontFamily: "Inter_700Bold", fontSize: 12 },
  empty: { borderRadius: 17, padding: 20, alignItems: "center" },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 7 },
  transaction: { minHeight: 70, borderWidth: 1, borderRadius: 16, padding: 11, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  transactionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#E8F9F2" },
  transactionIconDebit: { backgroundColor: "#FFF0F3" },
  transactionCopy: { flex: 1, marginLeft: 9 },
  transactionTitle: { fontFamily: "Inter_700Bold", fontSize: 12 },
  transactionDate: { fontFamily: "Inter_400Regular", fontSize: 9, marginTop: 4 },
  transactionAmount: { color: "#148466", fontFamily: "Manrope_800ExtraBold", fontSize: 14 },
  debit: { color: "#B64D66" },
});
