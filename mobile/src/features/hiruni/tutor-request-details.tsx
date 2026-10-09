import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import {
  requestFullDateLabel,
  requestReceivedLabel,
  requestTimeLabel,
  TutorBookingRequest,
} from '@/features/hiruni/booking-request-types';
import { apiRequest } from '@/services/api';

const purple = '#5D50F4';

export function TutorRequestDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { token } = useAuth();
  const { colors, isDark } = useAppTheme();
  const [booking, setBooking] = useState<TutorBookingRequest | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !id) {
      setError('Booking request information is missing.');
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ bookings: TutorBookingRequest[] }>('/bookings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const match = data.bookings.find((item) => item._id === id) || null;
      setBooking(match);
      setError(match ? '' : 'This booking request could not be found.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this booking request.');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
 /**
 * Handles the tutor's decision to accept or reject a booking request.
 * Sends the selected action to the booking API and updates the
 * request status while managing loading and error feedback.
 */
  async function updateRequest(action: 'confirm' | 'reject') {
    if (!booking || !token || busy) return;
    try {
      setBusy(true);
      setError('');
      await apiRequest(`/bookings/${booking._id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      setMessage(
        action === 'confirm'
          ? `Request accepted. ${booking.student.name} has been notified.`
          : `Request declined. ${booking.student.name} has been notified.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this request.');
    } finally {
      setBusy(false);
    }
  }

  function startLiveSession() {
    if (!booking) return;
    router.push({
      pathname: '/session/[id]',
      params: { id: booking._id },
    });
  }

  const pending = booking ? ['pending', 'reschedule_requested'].includes(booking.status) : false;
  const student = booking?.student;
  const hourlyRate = booking ? Math.round(booking.price * 60 / booking.durationMinutes) : 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: isDark ? colors.background : '#EFEDFF' }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/booking/requests')} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Request Details</Text>
        <View style={styles.headerButton}><Ionicons name="ellipsis-vertical" size={19} color={colors.text} /></View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading && <ActivityIndicator style={{ marginVertical: 32 }} color={purple} />}
        {!!error && <View style={styles.errorCard}><Ionicons name="alert-circle" size={19} color="#B84963" /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable></View>}
        {!!message && <View style={styles.successCard}><Ionicons name="checkmark-circle" size={19} color="#148A67" /><Text style={styles.successText}>{message}</Text></View>}

        {booking && <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.personRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(student?.name || 'Learner')}</Text><View style={styles.onlineDot} /></View>
              <View style={styles.personCopy}>
                <View style={styles.nameRow}><Text style={[styles.personName, { color: colors.text }]}>{student?.name || 'Learner'}</Text>{student?.isVerified && <Ionicons name="checkmark-circle" size={14} color={purple} />}</View>
                <Text style={[styles.personMeta, { color: colors.textMuted }]}>{student?.profile?.studyLevel || 'Student'}{student?.email ? ` • ${student.email}` : ''}</Text>
              </View>
              <View style={styles.shareButton}><Ionicons name="share-social-outline" size={18} color="#707187" /></View>
            </View>
            <View style={styles.requestBadge}><View style={styles.badgeDot} /><Text style={styles.requestBadgeText}>{statusLabel(booking.status)} • Received {requestReceivedLabel(booking.createdAt)}</Text></View>
            <View style={[styles.trustRow, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="sparkles-outline" size={15} color={purple} /><Text style={[styles.trustText, { color: colors.text }]}>Lesson request from a Tutor Link learner</Text></View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeading icon="book-outline" label="SUBJECT & SESSION" />
            <View style={styles.titleRow}><Text style={[styles.subjectTitle, { color: colors.text }]}>{booking.subject}</Text><View style={styles.levelBadge}><Text style={styles.levelBadgeText}>{student?.profile?.studyLevel || 'LEARNER'}</Text></View></View>
            {!!student?.profile?.interests?.length && <View style={[styles.focusBox, { backgroundColor: colors.surfaceMuted }]}><Text style={[styles.focusLabel, { color: colors.textMuted }]}>Learning interests</Text><View style={styles.chipRow}>{student.profile.interests.slice(0, 3).map((interest) => <View key={interest} style={[styles.chip, { backgroundColor: colors.surface }]}><Text style={[styles.chipText, { color: colors.text }]}>{interest}</Text></View>)}</View></View>}

            <View style={styles.grid}>
              <InfoTile icon="calendar-outline" label="DATE & TIME" value={requestFullDateLabel(booking.startsAt)} detail={requestTimeLabel(booking.startsAt)} />
              <InfoTile icon="time-outline" label="DURATION" value={`${booking.durationMinutes} minutes`} detail={booking.durationMinutes === 60 ? '1 hour' : 'Private lesson'} />
            </View>
            <WideInfo
              icon={booking.sessionType === 'in_person' ? 'location-outline' : 'videocam-outline'}
              title={booking.sessionType === 'in_person' ? 'In-person lesson' : 'Online lesson'}
              detail={booking.sessionType === 'in_person' ? 'Location details are shared after confirmation.' : 'Jitsi meeting access is available after confirmation.'}
              onPress={['confirmed', 'paid', 'scheduled', 'live'].includes(booking.status) ? startLiveSession : undefined}
            />
            <View style={[styles.rateRow, { backgroundColor: colors.surfaceMuted }]}><View style={styles.rateIcon}><Ionicons name="wallet-outline" size={17} color={purple} /></View><View style={styles.rateCopy}><Text style={[styles.infoLabel, { color: colors.textMuted }]}>SESSION RATE</Text><Text style={[styles.rateValue, { color: colors.text }]}>Rs. {booking.price.toLocaleString()} <Text style={styles.rateUnit}>• Rs. {hourlyRate.toLocaleString()}/hr</Text></Text></View><View style={styles.protected}><Text style={styles.protectedText}>CREDITS PROTECTED</Text></View></View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SectionHeading icon="bulb-outline" label="STUDENT'S LEARNING GOAL" />
            <View style={[styles.quote, { backgroundColor: colors.surfaceMuted }]}><Text style={[styles.quoteText, { color: colors.textMuted }]}>{student?.profile?.learningGoal ? `“${student.profile.learningGoal}”` : 'The learner has not added a learning goal yet.'}</Text></View>
            <SectionHeading icon="reorder-three-outline" label="ADDITIONAL NOTES" />
            <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="information-circle-outline" size={16} color={purple} /><Text style={[styles.noteText, { color: colors.textMuted }]}>{booking.notes || 'No additional notes were included with this request.'}</Text></View>
          </View>

          {!pending && <View style={[styles.statusCard, { backgroundColor: booking.status === 'cancelled' ? '#FFF0F3' : '#E5F8F0' }]}><Ionicons name={booking.status === 'cancelled' ? 'close-circle' : booking.status === 'live' ? 'videocam' : 'checkmark-circle'} size={21} color={booking.status === 'cancelled' ? '#B84963' : '#148A67'} /><View style={styles.statusCardCopy}><Text style={[styles.statusTitle, { color: colors.text }]}>{statusLabel(booking.status)}</Text><Text style={[styles.statusCopy, { color: colors.textMuted }]}>{booking.status === 'confirmed' ? 'The learner can now complete payment and unlock the lesson.' : booking.status === 'live' ? 'The live classroom is currently active.' : booking.status === 'completed' ? 'This teaching session has been completed.' : 'This request is no longer awaiting a decision.'}</Text></View></View>}
        </>}
      </ScrollView>

      {booking && <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {pending ? <>
          <Pressable disabled={busy} onPress={() => void updateRequest('confirm')} style={[styles.accept, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.acceptText}>Accept Request</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></>}</Pressable>
          <Pressable disabled={busy} onPress={() => void updateRequest('reject')} style={[styles.decline, { borderColor: colors.border }, busy && styles.disabled]}><Ionicons name="close" size={16} color={colors.textMuted} /><Text style={[styles.declineText, { color: colors.text }]}>Decline Request</Text></Pressable>
        </> : ['confirmed', 'paid', 'scheduled', 'live'].includes(booking.status) ? <Pressable onPress={startLiveSession} style={styles.accept}><Text style={styles.acceptText}>{booking.status === 'live' ? 'Continue Live Session' : 'Open Session'}</Text><Ionicons name="videocam-outline" size={17} color="#FFFFFF" /></Pressable> : <Pressable onPress={() => router.replace({ pathname: '/booking/requests', params: { filter: booking.status === 'completed' ? 'accepted' : 'all' } })} style={styles.accept}><Text style={styles.acceptText}>Back to Requests</Text><Ionicons name="arrow-back" size={17} color="#FFFFFF" /></Pressable>}
      </View>}
    </SafeAreaView>
  );
}

function SectionHeading({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return <View style={styles.sectionHeading}><Ionicons name={icon} size={15} color={purple} /><Text style={styles.sectionLabel}>{label}</Text></View>;
}

function InfoTile({ icon, label, value, detail }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; detail: string }) {
  const { colors } = useAppTheme();
  return <View style={[styles.infoTile, { backgroundColor: colors.surfaceMuted }]}><View style={styles.infoLabelRow}><Ionicons name={icon} size={14} color={purple} /><Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text></View><Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text><Text style={[styles.infoDetail, { color: colors.textMuted }]}>{detail}</Text></View>;
}

function WideInfo({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress?: () => void }) {
  const { colors } = useAppTheme();
  const content = <><View style={styles.wideIcon}><Ionicons name={icon} size={17} color="#16956E" /></View><View style={styles.wideCopy}><Text style={[styles.wideTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.wideDetail, { color: colors.textMuted }]}>{detail}</Text></View>{onPress && <Ionicons name="chevron-forward" size={17} color="#655CF2" />}</>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title}`} onPress={onPress} style={[styles.wideInfo, { backgroundColor: colors.surfaceMuted }]}>{content}</Pressable>
    : <View style={[styles.wideInfo, { backgroundColor: colors.surfaceMuted }]}>{content}</View>;
}

function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function statusLabel(status: string) {
  const labels: Record<string, string> = { pending: 'New request', reschedule_requested: 'Reschedule requested', confirmed: 'Request accepted', paid: 'Payment received', scheduled: 'Lesson scheduled', live: 'Live session active', completed: 'Session completed', cancelled: 'Request declined' };
  return labels[status] || status.replaceAll('_', ' ');
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F1FF' }, centerTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, marginTop: 10 },
  header: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E8E4F4' }, headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 17 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 13, paddingBottom: 28, gap: 11 },
  errorCard: { minHeight: 52, borderRadius: 15, backgroundColor: '#FFF0F3', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, errorText: { color: '#A9445B', fontFamily: 'Inter_400Regular', fontSize: 11, flex: 1 }, retry: { color: purple, fontFamily: 'Inter_700Bold', fontSize: 11 },
  successCard: { minHeight: 52, borderRadius: 15, backgroundColor: '#E5F8F0', borderWidth: 1, borderColor: '#C6EDDE', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }, successText: { color: '#176B54', fontFamily: 'Inter_600SemiBold', fontSize: 10, lineHeight: 14, flex: 1 },
  card: { borderRadius: 20, borderWidth: 1, padding: 13, shadowColor: '#302B59', shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 }, personRow: { flexDirection: 'row', alignItems: 'center' }, avatar: { width: 50, height: 50, borderRadius: 17, backgroundColor: '#DAD5FF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: purple, fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, onlineDot: { position: 'absolute', right: -1, bottom: 2, width: 11, height: 11, borderRadius: 6, backgroundColor: '#17A174', borderWidth: 2, borderColor: '#FFFFFF' }, personCopy: { flex: 1, marginLeft: 10 }, nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 }, personName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, personMeta: { fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 3 }, shareButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F0EEFA', alignItems: 'center', justifyContent: 'center' },
  requestBadge: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 9, backgroundColor: '#E9E5FF', paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 }, badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: purple }, requestBadgeText: { color: '#564CD5', fontFamily: 'Inter_700Bold', fontSize: 8 }, trustRow: { minHeight: 39, borderRadius: 11, paddingHorizontal: 10, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }, trustText: { fontFamily: 'Inter_600SemiBold', fontSize: 9 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, marginBottom: 7 }, sectionLabel: { color: '#737386', fontFamily: 'Inter_700Bold', fontSize: 8, letterSpacing: 0.55 }, titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, subjectTitle: { flex: 1, fontFamily: 'Manrope_800ExtraBold', fontSize: 16 }, levelBadge: { borderRadius: 7, backgroundColor: '#E8EAF4', paddingHorizontal: 7, paddingVertical: 5, maxWidth: 115 }, levelBadgeText: { color: '#596079', fontFamily: 'Inter_700Bold', fontSize: 7 },
  focusBox: { borderRadius: 12, padding: 10, marginTop: 10 }, focusLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 8 }, chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 }, chip: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 }, chipText: { fontFamily: 'Inter_500Medium', fontSize: 8 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 11 }, infoTile: { flex: 1, minHeight: 87, borderRadius: 12, padding: 10 }, infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, infoLabel: { fontFamily: 'Inter_700Bold', fontSize: 7, letterSpacing: 0.4 }, infoValue: { fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 8 }, infoDetail: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 3 },
  wideInfo: { minHeight: 66, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', marginTop: 8 }, wideIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#DDF7ED', alignItems: 'center', justifyContent: 'center' }, wideCopy: { flex: 1, marginLeft: 9 }, wideTitle: { fontFamily: 'Inter_700Bold', fontSize: 10 }, wideDetail: { fontFamily: 'Inter_400Regular', fontSize: 8, lineHeight: 12, marginTop: 3 },
  rateRow: { minHeight: 64, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', marginTop: 8 }, rateIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#E7E3FF', alignItems: 'center', justifyContent: 'center' }, rateCopy: { flex: 1, marginLeft: 9 }, rateValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13, marginTop: 4 }, rateUnit: { color: '#777889', fontFamily: 'Inter_400Regular', fontSize: 8 }, protected: { borderRadius: 8, backgroundColor: '#CFF6E7', paddingHorizontal: 7, paddingVertical: 5 }, protectedText: { color: '#148A67', fontFamily: 'Inter_700Bold', fontSize: 6.5 },
  quote: { minHeight: 78, borderRadius: 12, padding: 12, marginBottom: 15 }, quoteText: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 16, fontStyle: 'italic' }, note: { minHeight: 61, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, noteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14 },
  statusCard: { borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }, statusCardCopy: { flex: 1 }, statusTitle: { fontFamily: 'Inter_700Bold', fontSize: 11 }, statusCopy: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 2 },
  footer: { width: '100%', maxWidth: 620, alignSelf: 'center', borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, flexDirection: 'row', gap: 8 }, accept: { flex: 1.35, height: 48, borderRadius: 12, backgroundColor: purple, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, acceptText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 11 }, decline: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, declineText: { fontFamily: 'Inter_700Bold', fontSize: 10 }, disabled: { opacity: 0.55 },
});
