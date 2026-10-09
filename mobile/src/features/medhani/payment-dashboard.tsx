import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FeatureShell } from '@/components/feature-shell';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';

type Person = { _id: string; name: string };
type PaymentBooking = { _id: string; subject: string; startsAt: string; durationMinutes: number; status: string } | null;
type Payment = {
  _id: string;
  booking: PaymentBooking;
  student: Person;
  tutor: Person;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'refund_pending' | 'refunded';
  method: 'demo_card' | 'demo_wallet';
  last4?: string;
  transactionReference?: string;
  paidAt?: string;
  refundedAt?: string;
};
type Summary = { paidAmount: number; refundedAmount: number; transactions: number; currency: 'lkr' };
type Earnings = { total: number; available: number; pending: number; paidSessions: number; currency: 'lkr' };

export function PaymentDashboard() {
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const tutorRole = user?.role === 'tutor';
  const [payments, setPayments] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<Summary>({ paidAmount: 0, refundedAmount: 0, transactions: 0, currency: 'lkr' });
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || !user) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [history, earningsData] = await Promise.all([
        apiRequest<{ payments: Payment[]; summary: Summary }>('/payments/mine', { headers }),
        tutorRole ? apiRequest<{ earnings: Earnings }>('/payments/earnings', { headers }) : Promise.resolve(null),
      ]);
      setPayments(history.payments);
      setSummary(history.summary);
      setEarnings(earningsData?.earnings || null);
      setError('');
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not load demo payments.'); }
    finally { setLoading(false); }
  }, [token, tutorRole, user]);

  useEffect(() => { const request = setTimeout(() => void load(), 0); return () => clearTimeout(request); }, [load]);

  return <FeatureShell activeTab="home" showBack fallbackHref="/home" title="Demo payments" subtitle="Payment history and lesson earnings. No real charges are made.">
    {loading && <ActivityIndicator color="#665CF2" style={styles.loader} />}
    {!loading && !!error && <View style={[styles.notice, { backgroundColor: colors.surface }]}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>}
    {!loading && !error && <>
      <View style={styles.summaryRow}>
        <SummaryCard label={tutorRole ? 'TOTAL EARNED' : 'TOTAL PAID'} value={tutorRole ? earnings?.total || 0 : summary.paidAmount} />
        <SummaryCard label={tutorRole ? 'AVAILABLE' : 'REFUNDED'} value={tutorRole ? earnings?.available || 0 : summary.refundedAmount} />
      </View>
      {tutorRole && <View style={[styles.pending, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="time-outline" size={18} color="#665CF2" /><Text style={[styles.pendingText, { color: colors.text }]}>Rs. {(earnings?.pending || 0).toLocaleString()} pending until lessons are completed</Text></View>}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions ({summary.transactions})</Text>
      {payments.length === 0 && <View style={[styles.empty, { backgroundColor: colors.surface }]}><Ionicons name="receipt-outline" size={30} color="#665CF2" /><Text style={[styles.emptyTitle, { color: colors.text }]}>No demo payments yet</Text><Text style={[styles.emptyCopy, { color: colors.textMuted }]}>{tutorRole ? 'Payments will appear after a learner completes demo checkout.' : 'Once a tutor confirms your booking, you can complete demo checkout from the lesson details.'}</Text><Pressable accessibilityRole="button" onPress={() => router.push('/bookings')} style={styles.retry}><Text style={styles.retryText}>View bookings</Text></Pressable></View>}
      {payments.map((payment) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${payment.booking?.subject || 'lesson'} payment details`} disabled={!payment.booking} key={payment._id} onPress={() => payment.booking && router.push({ pathname: '/session/[id]', params: { id: payment.booking._id } })} style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.paymentTop}><View style={styles.paymentCopy}><Text numberOfLines={1} style={[styles.paymentTitle, { color: colors.text }]}>{payment.booking?.subject || 'Lesson'}</Text><Text style={[styles.paymentPerson, { color: colors.textMuted }]}>{tutorRole ? `Learner: ${payment.student?.name || 'Learner'}` : `Tutor: ${payment.tutor?.name || 'Tutor'}`}</Text></View><Text style={[styles.amount, { color: colors.text }]}>Rs. {payment.amount.toLocaleString()}</Text></View>
        <View style={styles.paymentBottom}><Text style={[styles.detail, { color: colors.textMuted }]}>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'Awaiting payment'} · {payment.method === 'demo_wallet' ? 'Demo wallet' : `Demo card${payment.last4 ? ` ···· ${payment.last4}` : ''}`}</Text><Text style={[styles.status, payment.status === 'refunded' && styles.refunded, payment.status === 'refund_pending' && styles.refundPending]}>{payment.status.replace('_', ' ')}</Text></View>
        {!!payment.transactionReference && <Text numberOfLines={1} style={[styles.reference, { color: colors.textMuted }]}>Ref: {payment.transactionReference}</Text>}
      </Pressable>)}
    </>}
  </FeatureShell>;
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <View style={styles.summaryCard}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryAmount}>Rs. {value.toLocaleString()}</Text></View>;
}

const styles = StyleSheet.create({
  loader: { marginTop: 50 }, summaryRow: { flexDirection: 'row', gap: 10 }, summaryCard: { flex: 1, minHeight: 100, borderRadius: 18, backgroundColor: '#2D256D', padding: 14, justifyContent: 'center' }, summaryLabel: { color: '#CBC5FF', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 }, summaryAmount: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 20, marginTop: 8 }, pending: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 }, pendingText: { fontFamily: 'Inter_400Regular', fontSize: 12, flex: 1 }, sectionTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 18, marginTop: 23, marginBottom: 10 }, empty: { borderRadius: 20, padding: 24, alignItems: 'center' }, emptyTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16, marginTop: 9 }, emptyCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 }, retry: { backgroundColor: '#665CF2', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 13 }, retryText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 }, notice: { padding: 17, borderRadius: 16 }, error: { color: '#BE506A', fontFamily: 'Inter_400Regular', fontSize: 13 }, paymentCard: { borderWidth: 1, borderRadius: 17, padding: 14, marginBottom: 10 }, paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, paymentCopy: { flex: 1 }, paymentTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15 }, paymentPerson: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }, amount: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, paymentBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 7, marginTop: 13 }, detail: { fontFamily: 'Inter_400Regular', fontSize: 10, flex: 1 }, status: { color: '#148466', backgroundColor: '#E8F9F2', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4, fontFamily: 'Inter_700Bold', fontSize: 10, textTransform: 'capitalize' }, refunded: { color: '#6D6890', backgroundColor: '#EFEDFA' }, refundPending: { color: '#A96B10', backgroundColor: '#FFF1DB' }, reference: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 8 },
});
