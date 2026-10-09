import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FeatureShell } from '@/components/feature-shell';
import { RateReviewModal } from '@/components/rate-review-modal';
import { palette } from '@/constants/auth-theme';
import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';
import { createDemoSessionNote, deleteDemoSessionNote, getDemoBookingRequest, updateDemoBookingRequest, updateDemoSessionNote } from '@/features/hiruni/demo-booking-requests';
import { LiveTeachingSession, type SharedSessionNote } from './live-teaching-session';

type Person = { _id: string; name: string };
type Booking = { _id: string; student: Person; tutor: Person; subject: string; sessionType?: 'online' | 'in_person'; startsAt: string; durationMinutes: number; status: string; price: number; creditCost?: number; creditsCharged?: boolean };
type ApiSharedNote = { _id?: string; id?: string; text: string; createdAt?: string; updatedAt?: string };
type Session = { _id: string; booking: Booking; status: string; paymentStatus: string; paymentReference?: string; notes?: string; sharedNotes?: ApiSharedNote[] };
type Payment = { _id: string; amount: number; status: string; method: 'demo_card' | 'demo_wallet'; last4?: string; transactionReference: string; paidAt: string };
const demoSessionStartedAt = new Date(Date.now() - 10 * 60_000).toISOString();

export function SessionPayment() {
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const demoRequestId = id?.startsWith('demo-live-') ? id.slice('demo-live-'.length) : undefined;
  const demoRequest = getDemoBookingRequest(demoRequestId);
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const tutorRole = user?.role === 'tutor';
  const [session, setSession] = useState<Session | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [canJoin, setCanJoin] = useState(false);
  const [creditBalance, setCreditBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (demoRequestId) return;
    if (!token || !id) return;
    try {
      const [sessionData, paymentData] = await Promise.all([
        apiRequest<{ session: Session; canJoin: boolean }>(`/sessions/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        apiRequest<{ payment: Payment | null }>(`/payments/booking/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setSession(sessionData.session); setCanJoin(sessionData.canJoin); setPayment(paymentData.payment); setNotesDraft(sessionData.session.notes || ''); setError('');
      if (!tutorRole) {
        const creditData = await apiRequest<{ balance: number }>('/credits', { headers: { Authorization: `Bearer ${token}` } });
        setCreditBalance(creditData.balance);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load this session.'); }
    finally { setLoading(false); }
  }, [demoRequestId, id, token, tutorRole]);

  useEffect(() => { const request = setTimeout(() => void load(), 0); return () => clearTimeout(request); }, [load]);

  const booking = session?.booking;
  const otherPerson = tutorRole ? booking?.student : booking?.tutor;
  const initials = otherPerson?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'TL';
  const paid = session?.paymentStatus === 'paid';
  const online = (booking?.sessionType || 'online') === 'online';
  const creditCost = booking?.creditCost || Math.max(1, Math.ceil((booking?.price || 0) / 100));
  const startsAt = useMemo(() => booking ? new Date(booking.startsAt) : null, [booking]);
  const endsAt = useMemo(() => startsAt && booking ? new Date(startsAt.getTime() + booking.durationMinutes * 60_000) : null, [booking, startsAt]);
  const sessionReference = booking?._id.slice(-6).toUpperCase();

  async function unlock() {
    if (!token || !booking) return;
    try {
      setBusy(true); setError(''); setMessage('');
      const result = await apiRequest<{ message: string }>(`/sessions/${booking._id}/unlock`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setMessage(result.message); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not unlock this meeting.'); }
    finally { setBusy(false); }
  }

  function join() {
    if (!booking) return;
    router.push({ pathname: '/meeting/[bookingId]', params: { bookingId: booking._id } });
  }

  async function complete() {
    if (!token || !booking) return;
    try {
      setBusy(true); setError('');
      const result = await apiRequest<{ message: string }>(`/sessions/${booking._id}/complete`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      setMessage(result.message); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not complete the session.'); }
    finally { setBusy(false); }
  }

  async function saveNotes() {
    if (!token || !booking) return;
    try {
      setBusy(true); setError('');
      const result = await apiRequest<{ message: string }>(`/sessions/${booking._id}/notes`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ notes: notesDraft.trim() }) });
      setEditingNotes(false); setMessage(result.message); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save lesson notes.'); }
    finally { setBusy(false); }
  }

  async function createLiveNote(text: string) {
    if (!token || !booking) throw new Error('Session information is missing.');
    const result = await apiRequest<{ note: SharedSessionNote }>(`/sessions/${booking._id}/shared-notes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    setSession((current) => current ? { ...current, sharedNotes: [...(current.sharedNotes || []), result.note] } : current);
    return result.note;
  }

  async function updateLiveNote(noteId: string, text: string) {
    if (!token || !booking) throw new Error('Session information is missing.');
    const result = await apiRequest<{ note: SharedSessionNote }>(`/sessions/${booking._id}/shared-notes/${noteId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text }),
    });
    setSession((current) => current ? { ...current, sharedNotes: (current.sharedNotes || []).map((note) => (note.id || note._id) === noteId ? result.note : note) } : current);
    return result.note;
  }

  async function deleteLiveNote(noteId: string) {
    if (!token || !booking) throw new Error('Session information is missing.');
    await apiRequest(`/sessions/${booking._id}/shared-notes/${noteId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setSession((current) => current ? { ...current, sharedNotes: (current.sharedNotes || []).filter((note) => (note.id || note._id) !== noteId) } : current);
  }

  function completeDemoSession() {
    if (!demoRequest) return;
    updateDemoBookingRequest(demoRequest._id, 'completed');
    router.replace({ pathname: '/booking/requests', params: { filter: 'accepted' } });
  }

  if (demoRequest && tutorRole) {
    return (
      <LiveTeachingSession
        booking={{
          student: { name: demoRequest.student.name },
          tutor: { name: user?.name || 'Tutor' },
          subject: `${demoRequest.subject} • ${demoRequest.topic}`,
          startsAt: demoSessionStartedAt,
          durationMinutes: demoRequest.durationMinutes,
        }}
        tutorRole
        initialNotes={demoRequest.sessionNotes}
        busy={false}
        onComplete={completeDemoSession}
        onCreateNote={async (text) => createDemoSessionNote(demoRequest._id, text)}
        onUpdateNote={async (noteId, text) => {
          const updated = updateDemoSessionNote(demoRequest._id, noteId, text);
          if (!updated) throw new Error('Short note not found.');
          return updated;
        }}
        onDeleteNote={async (noteId) => deleteDemoSessionNote(demoRequest._id, noteId)}
      />
    );
  }

  if (!loading && booking && online && session?.status === 'live' && mode === 'workspace') {
    return <LiveTeachingSession booking={booking} bookingId={booking._id} authToken={token} currentUserId={user?.id} tutorRole={tutorRole} initialNotes={normalizeSharedNotes(session.sharedNotes)} busy={busy} onJoinMeeting={join} onComplete={() => void complete()} onCreateNote={createLiveNote} onUpdateNote={updateLiveNote} onDeleteNote={deleteLiveNote} />;
  }

  return <FeatureShell activeTab="bookings" showBack fallbackHref="/bookings" title="Session details" subtitle="Review your lesson, tutor and meeting access.">
    {loading && <ActivityIndicator size="large" color={palette.primary} style={styles.loader} />}
    {!loading && booking && <>
      <View style={[styles.sessionHero, { backgroundColor: colors.surface }]}>
        <View style={styles.sessionHeroTop}>
          <View style={[styles.statusPill, booking.status === 'completed' && styles.statusPillCompleted]}>
            <View style={[styles.statusPillDot, booking.status === 'completed' && styles.statusPillDotCompleted]} />
            <Text style={[styles.statusPillText, booking.status === 'completed' && styles.statusPillTextCompleted]}>
              {booking.status === 'completed' ? 'Completed' : session?.status === 'live' ? 'Live now' : paid ? 'Confirmed' : 'Scheduled'}
            </Text>
          </View>
          <Text style={styles.sessionReference}>#TL-{sessionReference}</Text>
        </View>
        <Text style={[styles.sessionSubject, { color: colors.text }]}>{booking.subject}</Text>
        <Text style={[styles.sessionDescription, { color: colors.textMuted }]}>Private tutoring session with {otherPerson?.name}</Text>
        <View style={[styles.sessionHeroFooter, { borderTopColor: colors.border }]}>
          <View style={styles.sessionMeta}>
            <Ionicons name={online ? 'videocam-outline' : 'people-outline'} size={16} color={palette.primary} />
            <Text style={[styles.sessionMetaText, { color: colors.textMuted }]}>{online ? '1-on-1 live class' : 'In-person class'}</Text>
          </View>
          <Text style={[styles.sessionFee, { color: colors.text }]}>{creditCost} credits</Text>
        </View>
      </View>

      <View style={[styles.assignedCard, { backgroundColor: colors.surface }]}>
        <SectionLabel text={tutorRole ? 'ASSIGNED LEARNER' : 'ASSIGNED TUTOR'} />
        <View style={styles.assignedRow}>
          <LinearGradient colors={['#342A72', '#6554E8']} style={styles.assignedAvatar}><Text style={styles.assignedInitials}>{initials}</Text></LinearGradient>
          <View style={styles.assignedCopy}>
            <Text style={[styles.assignedName, { color: colors.text }]}>{otherPerson?.name}</Text>
            <Text style={[styles.assignedRole, { color: colors.textMuted }]}>{tutorRole ? 'Learner' : `${booking.subject} tutor`}</Text>
          </View>
          <View style={[styles.messageButton, { backgroundColor: colors.softPurple }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={palette.primary} /></View>
        </View>
        {!tutorRole && booking.status === 'completed' && <Pressable accessibilityRole="button" accessibilityLabel={`Rate and review ${booking.tutor?.name || 'this tutor'}`} onPress={() => setReviewOpen(true)} style={styles.rateReviewButton}>
          <Ionicons name="star-outline" size={17} color="#655CF2" />
          <Text style={styles.rateReviewText}>Rate &amp; Review</Text>
          <Ionicons name="arrow-forward" size={16} color="#655CF2" />
        </Pressable>}
      </View>

      <View style={[styles.scheduleCard, { backgroundColor: colors.surface }]}>
        <SectionLabel text="SCHEDULE & PLATFORM" />
        <View style={styles.scheduleGrid}>
          <View style={[styles.scheduleItem, { backgroundColor: colors.surfaceMuted }]}>
            <View style={styles.scheduleIcon}><Ionicons name="calendar-outline" size={17} color={palette.primary} /></View>
            <Text style={styles.scheduleItemLabel}>DATE</Text>
            <Text style={[styles.scheduleItemValue, { color: colors.text }]}>{startsAt?.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
          <View style={[styles.scheduleItem, { backgroundColor: colors.surfaceMuted }]}>
            <View style={styles.scheduleIcon}><Ionicons name="time-outline" size={17} color={palette.primary} /></View>
            <Text style={styles.scheduleItemLabel}>TIME</Text>
            <Text style={[styles.scheduleItemValue, { color: colors.text }]}>{startsAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {endsAt?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={styles.durationText}>{booking.durationMinutes} minutes</Text>
          </View>
        </View>
        <View style={[styles.platformPanel, { borderColor: online ? '#8CB9FF' : colors.border, backgroundColor: online ? '#EFF7FF' : colors.surfaceMuted }]}>
          <View style={styles.platformIcon}><Ionicons name={online ? 'videocam' : 'location'} size={20} color="#FFFFFF" /></View>
          <View style={styles.platformCopy}>
            <Text style={styles.platformTitle}>{online ? 'Jitsi Video Meeting' : 'In-person lesson'}</Text>
            <Text style={styles.platformText}>{online ? (paid ? 'Secure meeting access is ready' : 'Unlock meeting access with credits') : 'Location arranged with your tutor'}</Text>
          </View>
          {online && paid && <Pressable accessibilityRole="button" accessibilityLabel="Join meeting" disabled={!canJoin} onPress={join} style={[styles.platformAction, !canJoin && styles.disabled]}><Ionicons name="videocam" size={16} color="#FFFFFF" /><Text style={styles.platformActionText}>Join Meeting</Text></Pressable>}
        </View>
        {online && paid && !canJoin && <Text style={[styles.joinAvailability, { color: colors.textMuted }]}>The classroom opens 10 minutes before the session.</Text>}
        {online && session?.status === 'live' && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/session/[id]', params: { id: booking._id, mode: 'workspace' } })} style={styles.workspaceAction}><Ionicons name="document-text-outline" size={16} color="#655CF2" /><Text style={styles.workspaceActionText}>Open lesson workspace</Text></Pressable>}
      </View>

      {!tutorRole && online && !paid && booking.status === 'confirmed' && <View style={styles.portal}>
        <View style={styles.portalHeader}><View><SectionLabel text="MEETING ACCESS" /><Text style={styles.portalTitle}>Unlock with credits</Text></View><View style={styles.demoBadge}><Text style={styles.demoBadgeText}>{creditBalance} AVAILABLE</Text></View></View>
        <View style={styles.walletPanel}><LinearGradient colors={['#1C1947', '#6554E8']} style={styles.walletIcon}><Ionicons name="sparkles" size={26} color="#FFFFFF" /></LinearGradient><View style={styles.creditCopy}><Text style={styles.walletTitle}>{creditCost} credits required</Text><Text style={styles.walletCopy}>Credits were only checked when you booked. They will be charged now.</Text></View></View>
        <Pressable disabled={busy || creditBalance < creditCost} onPress={unlock} style={[styles.payButton, creditBalance < creditCost && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="lock-open" size={16} color="#FFFFFF" /><Text style={styles.payText}>Use {creditCost} credits</Text><Ionicons name="arrow-forward" size={17} color="#FFFFFF" /></>}</Pressable>
        {creditBalance < creditCost && <Pressable onPress={() => router.push('/credits')} style={styles.historyLink}><Text style={styles.historyLinkText}>Top up or redeem credits</Text><Ionicons name="arrow-forward" size={15} color="#655CF2" /></Pressable>}
      </View>}

      {(paid || payment) && <View style={styles.receipt}><View style={styles.receiptIcon}><Ionicons name={payment?.status === 'refunded' || payment?.status === 'refund_pending' ? 'return-down-back' : 'checkmark-circle'} size={24} color="#17966E" /></View><View style={styles.receiptCopy}><SectionLabel text={payment ? "DEMO RECEIPT" : "CREDIT RECEIPT"} /><Text style={styles.receiptTitle}>{payment?.status === 'refunded' ? 'Payment refunded' : payment?.status === 'refund_pending' ? 'Refund pending' : payment ? 'Payment approved' : 'Meeting unlocked'}</Text><Text style={styles.reference}>{payment?.transactionReference || session?.paymentReference}{payment?.last4 ? ` •••• ${payment.last4}` : ''}</Text></View><Text style={styles.receiptAmount}>{payment ? `Rs.${payment.amount.toLocaleString()}` : `${creditCost} cr`}</Text></View>}
      {!tutorRole && <Pressable accessibilityRole="button" onPress={() => router.push('/credits')} style={styles.historyLink}><Ionicons name="sparkles-outline" size={16} color="#655CF2" /><Text style={styles.historyLinkText}>View credit activity</Text><Ionicons name="arrow-forward" size={15} color="#655CF2" /></Pressable>}
      {!!payment && <Pressable accessibilityRole="button" onPress={() => router.push('/payments')} style={styles.historyLink}><Ionicons name="receipt-outline" size={16} color="#655CF2" /><Text style={styles.historyLinkText}>View payment history</Text><Ionicons name="arrow-forward" size={15} color="#655CF2" /></Pressable>}
      {tutorRole && paid && session?.status !== 'completed' && booking.status !== 'completed' && <Pressable disabled={busy} onPress={complete} style={styles.complete}><Ionicons name="checkmark-done" size={18} color="#17966E" /><Text style={styles.completeText}>Mark lesson complete</Text></Pressable>}
      {booking.status === 'completed' && <View style={styles.notesCard}><SectionLabel text="LESSON SUMMARY" /><Text style={styles.notesHeading}>Tutor notes</Text>{editingNotes ? <><TextInput accessibilityLabel="Lesson notes" multiline maxLength={1000} value={notesDraft} onChangeText={setNotesDraft} placeholder="Add a short lesson summary for the learner" placeholderTextColor="#9293A2" style={styles.notesInput} /><Text style={styles.notesCount}>{notesDraft.length}/1000</Text><View style={styles.notesActions}><Pressable accessibilityRole="button" onPress={() => { setEditingNotes(false); setNotesDraft(session?.notes || ''); }} style={styles.cancelNotes}><Text style={styles.cancelNotesText}>Cancel</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={saveNotes} style={[styles.saveNotes, busy && styles.disabled]}><Text style={styles.saveNotesText}>{busy ? 'Saving...' : 'Save notes'}</Text></Pressable></View></> : <><Text style={styles.notesText}>{session?.notes || (tutorRole ? 'Add a summary of what was covered in this lesson.' : 'The tutor has not added lesson notes yet.')}</Text>{tutorRole && paid && <Pressable accessibilityRole="button" onPress={() => setEditingNotes(true)} style={styles.editNotes}><Ionicons name="create-outline" size={15} color="#655CF2" /><Text style={styles.editNotesText}>{session?.notes ? 'Edit notes' : 'Add notes'}</Text></Pressable>}</>}</View>}
      <RateReviewModal visible={reviewOpen} tutorId={booking.tutor?._id} tutorName={booking.tutor?.name} subject={booking.subject} onClose={() => setReviewOpen(false)} onSubmitted={setMessage} />
    </>}
    {!!error && <Notice error text={error} />}{!loading && !session && <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.saveNotes}><Text style={styles.saveNotesText}>Try again</Text></Pressable>}{!!message && <Notice text={message} />}
  </FeatureShell>;
}

function SectionLabel({ text }: { text: string }) { return <Text style={styles.label}>{text}</Text>; }
function Notice({ text, error }: { text: string; error?: boolean }) { return <View style={[styles.notice, error && styles.noticeError]}><Ionicons name={error ? 'alert-circle' : 'checkmark-circle'} size={17} color={error ? '#BE506A' : '#168B66'} /><Text style={[styles.noticeText, error && styles.noticeErrorText]}>{text}</Text></View>; }

function normalizeSharedNotes(notes: ApiSharedNote[] = []): SharedSessionNote[] {
  return notes.flatMap((note) => {
    const id = note.id || note._id;
    return id ? [{ id, text: note.text, createdAt: note.createdAt, updatedAt: note.updatedAt }] : [];
  });
}

const styles = StyleSheet.create({
  sessionHero: { borderRadius: 24, padding: 17, borderWidth: 1, borderColor: '#E8E4F5', shadowColor: '#302B5D', shadowOpacity: 0.08, shadowRadius: 15, elevation: 3 },
  sessionHeroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { minHeight: 27, borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#E8F9F2', flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusPillCompleted: { backgroundColor: '#ECE9FF' },
  statusPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#20B987' },
  statusPillDotCompleted: { backgroundColor: '#655CF2' },
  statusPillText: { color: '#168B66', fontFamily: 'Inter_700Bold', fontSize: 11 },
  statusPillTextCompleted: { color: '#655CF2' },
  sessionReference: { color: '#A4A0B3', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.7 },
  sessionSubject: { fontFamily: 'Manrope_800ExtraBold', fontSize: 21, lineHeight: 27, marginTop: 15 },
  sessionDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  sessionHeroFooter: { minHeight: 39, borderTopWidth: 1, marginTop: 15, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sessionMetaText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  sessionFee: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  assignedCard: { borderRadius: 22, padding: 17, marginTop: 13, borderWidth: 1, borderColor: '#E8E4F5' },
  assignedRow: { flexDirection: 'row', alignItems: 'center', marginTop: 13 },
  assignedAvatar: { width: 51, height: 51, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  assignedInitials: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
  assignedCopy: { flex: 1, marginLeft: 11 },
  assignedName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15 },
  assignedRole: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  messageButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rateReviewButton: { height: 43, borderRadius: 13, backgroundColor: '#EFEDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13 },
  rateReviewText: { flex: 1, color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 12, textAlign: 'center' },
  scheduleCard: { borderRadius: 22, padding: 17, marginTop: 13, borderWidth: 1, borderColor: '#E8E4F5' },
  scheduleGrid: { flexDirection: 'row', gap: 9, marginTop: 13 },
  scheduleItem: { flex: 1, minHeight: 112, borderRadius: 16, padding: 12 },
  scheduleIcon: { width: 31, height: 31, borderRadius: 10, backgroundColor: '#E8E4FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  scheduleItemLabel: { color: '#9692A8', fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.7 },
  scheduleItemValue: { fontFamily: 'Manrope_700Bold', fontSize: 12, lineHeight: 17, marginTop: 4 },
  durationText: { color: '#17966E', fontFamily: 'Inter_700Bold', fontSize: 10, marginTop: 4 },
  platformPanel: { minHeight: 82, borderRadius: 16, borderWidth: 1.5, padding: 11, marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  platformIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#4C91F2', alignItems: 'center', justifyContent: 'center' },
  platformCopy: { flex: 1, marginLeft: 10 },
  platformTitle: { color: '#21243A', fontFamily: 'Manrope_800ExtraBold', fontSize: 12 },
  platformText: { color: '#748093', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14, marginTop: 3 },
  platformAction: { minHeight: 38, borderRadius: 12, backgroundColor: '#655CF2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 11, marginLeft: 7 },
  platformActionText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 10 },
  joinAvailability: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, marginTop: 8, textAlign: 'center' },
  workspaceAction: { minHeight: 42, borderRadius: 12, backgroundColor: '#EFEDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 9 },
  workspaceActionText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 11 },
  historyLink: { height: 44, borderRadius: 13, backgroundColor: '#EFEDFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 }, historyLinkText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 12 },
  notesCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 17, marginTop: 13 }, notesHeading: { color: '#171A2B', fontFamily: 'Manrope_800ExtraBold', fontSize: 17, marginTop: 6 }, notesText: { color: '#666879', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 9 }, notesInput: { minHeight: 95, borderWidth: 1, borderColor: '#E6E3F3', borderRadius: 13, padding: 12, marginTop: 10, textAlignVertical: 'top', color: '#242638', fontFamily: 'Inter_400Regular', fontSize: 13 }, notesCount: { color: '#9293A2', fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'right', marginTop: 4 }, notesActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 }, cancelNotes: { height: 39, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }, cancelNotesText: { color: '#55576B', fontFamily: 'Inter_700Bold', fontSize: 12 }, saveNotes: { height: 39, borderRadius: 10, paddingHorizontal: 15, backgroundColor: '#655CF2', alignItems: 'center', justifyContent: 'center' }, saveNotesText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 }, editNotes: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, marginTop: 6 }, editNotesText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 12 },
  loader: { marginTop: 70 }, hero: { minHeight: 315, borderRadius: 30, padding: 18, alignItems: 'center', shadowColor: '#171331', shadowOpacity: 0.3, shadowRadius: 20, elevation: 9 }, heroTop: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, live: { height: 27, paddingHorizontal: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', gap: 6 }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFB34E' }, liveDotPaid: { backgroundColor: '#32D79A' }, liveText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.7 }, avatar: { width: 82, height: 82, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.17)', marginTop: 15 }, initials: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 24 }, person: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 18, marginTop: 11 }, waiting: { color: '#D3CFEB', fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 5 }, joinButton: { minWidth: 180, height: 48, paddingHorizontal: 18, borderRadius: 16, backgroundColor: '#7A68FF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 }, disabled: { opacity: 0.42 }, joinText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 14 }, room: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }, roomText: { color: '#BFFFE5', fontFamily: 'Inter_700Bold', fontSize: 12 },
  details: { padding: 18, borderRadius: 23, backgroundColor: '#FFFFFF', marginTop: 15 }, label: { color: '#898A9B', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 }, title: { color: '#171A2B', fontFamily: 'Manrope_800ExtraBold', fontSize: 18, marginTop: 7, marginBottom: 11 }, row: { flexDirection: 'row', alignItems: 'center', marginTop: 8 }, rowIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#EFEDFF', alignItems: 'center', justifyContent: 'center' }, rowText: { color: '#606274', fontFamily: 'Inter_700Bold', fontSize: 13, marginLeft: 9, flex: 1 },
  portal: { padding: 18, borderRadius: 25, backgroundColor: '#FFFFFF', marginTop: 14, shadowColor: '#302B5D', shadowOpacity: 0.09, shadowRadius: 16, elevation: 4 }, portalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }, portalTitle: { color: '#171A2B', fontFamily: 'Manrope_800ExtraBold', fontSize: 18, marginTop: 6 }, demoBadge: { paddingHorizontal: 8, height: 24, borderRadius: 8, backgroundColor: '#FFF2DC', justifyContent: 'center' }, demoBadgeText: { color: '#B87012', fontFamily: 'Inter_700Bold', fontSize: 10 }, walletPanel: { minHeight: 82, borderRadius: 17, backgroundColor: '#F5F3FD', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginTop: 15 }, walletIcon: { width: 51, height: 51, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, creditCopy: { flex: 1 }, walletTitle: { color: '#232538', fontFamily: 'Manrope_800ExtraBold', fontSize: 15 }, walletCopy: { color: '#818293', fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 15, marginTop: 4 }, payButton: { height: 52, borderRadius: 16, backgroundColor: '#655CF2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 13, shadowColor: '#655CF2', shadowOpacity: 0.26, shadowRadius: 10, elevation: 5 }, payText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 14 },
  receipt: { minHeight: 87, padding: 14, borderRadius: 22, backgroundColor: '#FFFFFF', marginTop: 14, flexDirection: 'row', alignItems: 'center' }, receiptIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#E8F9F2', alignItems: 'center', justifyContent: 'center' }, receiptCopy: { flex: 1, marginLeft: 11 }, receiptTitle: { color: '#242638', fontFamily: 'Manrope_800ExtraBold', fontSize: 15, marginTop: 4 }, reference: { color: '#8B8C9C', fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 4 }, receiptAmount: { color: '#17966E', fontFamily: 'Manrope_700Bold', fontSize: 15 }, complete: { height: 50, borderRadius: 16, backgroundColor: '#E8F9F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 }, completeText: { color: '#168B66', fontFamily: 'Manrope_700Bold', fontSize: 14 }, notice: { minHeight: 46, borderRadius: 14, backgroundColor: '#E9F9F2', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 12 }, noticeError: { backgroundColor: '#FFF0F3' }, noticeText: { color: '#168B66', fontFamily: 'Inter_700Bold', fontSize: 13, flex: 1 }, noticeErrorText: { color: '#BE506A' },
});
