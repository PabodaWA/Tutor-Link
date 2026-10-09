import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBottomNav } from '@/components/app-bottom-nav';
import { useAppTheme } from '@/context/theme-context';
import { ConversationType, useBookingChat } from '@/features/meetings/use-booking-chat';

type ClassroomBooking = {
  student: { name: string };
  tutor: { name: string };
  subject: string;
  startsAt: string;
  durationMinutes: number;
};

type DisplayChatMessage = { id: string; author: string; text: string; mine: boolean; time: string };

export type SharedSessionNote = { id: string; text: string; createdAt?: string; updatedAt?: string };

export function LiveTeachingSession({ booking, bookingId, conversationType = 'booking', authToken, currentUserId, tutorRole, initialNotes, busy, canComplete = true, onJoinMeeting, onComplete, onCreateNote, onUpdateNote, onDeleteNote }: {
  booking: ClassroomBooking;
  bookingId?: string;
  conversationType?: ConversationType;
  authToken?: string | null;
  currentUserId?: string;
  tutorRole: boolean;
  initialNotes?: SharedSessionNote[];
  busy: boolean;
  canComplete?: boolean;
  onJoinMeeting?: () => void;
  onComplete: () => void;
  onCreateNote: (text: string) => Promise<SharedSessionNote>;
  onUpdateNote: (id: string, text: string) => Promise<SharedSessionNote>;
  onDeleteNote: (id: string) => Promise<void>;
}) {
  const { colors, isDark } = useAppTheme();
  const learnerName = booking.student?.name || 'Learner';
  const tutorName = booking.tutor?.name || 'Tutor';
  const myName = tutorRole ? tutorName : learnerName;
  const otherName = tutorRole ? learnerName : tutorName;
  const liveChat = useBookingChat(bookingId, authToken, conversationType);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState<SharedSessionNote[]>(initialNotes || []);
  const [newNote, setNewNote] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [notesFeedback, setNotesFeedback] = useState('Synced');
  const [demoMessages, setDemoMessages] = useState<DisplayChatMessage[]>([
    { id: 'welcome', author: learnerName, text: `I’d like some help understanding today’s ${booking.subject} topic.`, mine: !tutorRole, time: 'Now' },
    { id: 'reply', author: tutorName, text: 'No problem — we’ll work through it step by step and check each answer together.', mine: tutorRole, time: 'Now' },
  ]);
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const end = new Date(booking.startsAt).getTime() + booking.durationMinutes * 60_000;
    return Math.max(0, Math.round((end - Date.now()) / 1000));
  });

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const timerText = useMemo(() => {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.floor((secondsLeft % 3600) / 60);
    const seconds = secondsLeft % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }, [secondsLeft]);

  const messages = useMemo<DisplayChatMessage[]>(() => {
    if (!bookingId) return demoMessages;
    return liveChat.messages.map((message) => ({
      id: message.id,
      author: message.sender.name,
      text: message.text,
      mine: message.sender.id === currentUserId,
      time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
  }, [bookingId, currentUserId, demoMessages, liveChat.messages]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || liveChat.sending) return;
    if (!bookingId) {
      setDemoMessages((items) => [...items, { id: `${Date.now()}`, author: myName, text, mine: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      setDraft('');
      return;
    }
    try {
      await liveChat.sendMessage(text);
      setDraft('');
    } catch {
      // Preserve the draft so the user can retry after a network error.
    }
  }

  async function addShortNote() {
    const text = newNote.trim();
    if (!text || noteBusyId) return;
    try {
      setNoteBusyId('new');
      setNotesFeedback('Adding...');
      const created = await onCreateNote(text);
      setNotes((items) => [...items, created]);
      setNewNote('');
      setNotesFeedback('Note added');
    } catch (error) {
      setNotesFeedback(error instanceof Error ? error.message : 'Could not add note');
    } finally {
      setNoteBusyId(null);
    }
  }

  async function saveEditedNote(id: string) {
    const text = editingText.trim();
    if (!text || noteBusyId) return;
    try {
      setNoteBusyId(id);
      setNotesFeedback('Saving...');
      const updated = await onUpdateNote(id, text);
      setNotes((items) => items.map((item) => item.id === id ? updated : item));
      setEditingId(null);
      setEditingText('');
      setNotesFeedback('Changes saved');
    } catch (error) {
      setNotesFeedback(error instanceof Error ? error.message : 'Could not update note');
    } finally {
      setNoteBusyId(null);
    }
  }

  async function deleteShortNote(id: string) {
    if (noteBusyId) return;
    try {
      setNoteBusyId(id);
      setNotesFeedback('Deleting...');
      await onDeleteNote(id);
      setNotes((items) => items.filter((item) => item.id !== id));
      if (editingId === id) setEditingId(null);
      setNotesFeedback('Note deleted');
    } catch (error) {
      setNotesFeedback(error instanceof Error ? error.message : 'Could not delete note');
    } finally {
      setNoteBusyId(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: isDark ? colors.background : '#F4F2FF' }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Pressable accessibilityLabel="Leave classroom" onPress={() => router.back()} style={styles.headerButton}><Ionicons name="arrow-back" size={21} color={colors.text} /></Pressable>
        <View style={styles.headerCopy}><Text style={[styles.headerTitle, { color: colors.text }]}>Live Teaching Session</Text><Text style={[styles.headerSub, { color: colors.textMuted }]}>Secure Tutor Link classroom</Text></View>
        <Ionicons name="ellipsis-vertical" size={19} color={colors.textMuted} />
        <View style={styles.profilePill}><Ionicons name="person" size={15} color="#FFFFFF" /></View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.learnerRow}>
          <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{initials(otherName)}</Text><View style={styles.online} /></View>
          <View style={styles.learnerCopy}><Text style={[styles.learnerName, { color: colors.text }]}>{otherName}</Text><Text style={[styles.learnerMeta, { color: colors.textMuted }]}>{booking.subject} • {booking.durationMinutes} minute lesson</Text></View>
          <View style={styles.timer}><View style={styles.recordDot} /><Text style={styles.timerText}>{timerText}</Text></View>
        </View>

        <LinearGradient colors={['#17243B', '#445873', '#CFD6DB']} style={styles.videoStage}>
          <View style={styles.studentVideo}>
            <View style={styles.videoLabel}><View style={styles.liveDot} /><Text style={styles.videoLabelText}>{otherName}</Text></View>
            <View style={styles.personSilhouette}><View style={styles.head} /><View style={styles.body} /></View>
            <View style={styles.board}><Text style={styles.boardText}>{booking.subject}</Text><View style={styles.boardLine} /><View style={[styles.boardLine, { width: '62%' }]} /></View>
          </View>
          <View style={styles.selfVideo}>
            <LinearGradient colors={['#C9B89E', '#F1E6D7']} style={StyleSheet.absoluteFill} />
            <View style={styles.selfHead} /><View style={styles.selfBody} />
            <View style={styles.selfLabel}><Text style={styles.selfLabelText}>You</Text></View>
          </View>
          <View style={styles.controls}>
            <Control icon="mic" />
            <Control icon="videocam" />
            <Control icon="volume-high" />
            <Control icon="desktop" active />
            <Control icon="call" danger />
          </View>
        </LinearGradient>

          {!!onJoinMeeting && <View style={[styles.meetingInvite, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.meetingInviteIcon}><Ionicons name="videocam" size={18} color="#FFFFFF" /></View><View style={styles.meetingInviteCopy}><Text style={[styles.meetingInviteTitle, { color: colors.text }]}>Jitsi tutoring meeting</Text><Text style={[styles.meetingInviteText, { color: colors.textMuted }]}>{conversationType === 'tutor-request' ? 'Secure room for this accepted tutor request' : 'Secure room for this confirmed booking'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Join Jitsi meeting" onPress={onJoinMeeting} style={styles.meetingInviteAction}><Text style={styles.meetingInviteActionText}>Join Meeting</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></Pressable></View>}

          <View style={styles.chatHeading}><View><Text style={[styles.sectionTitle, { color: colors.text }]}>Chat <Text style={styles.messageCount}>• {messages.length} messages</Text></Text><Text style={[styles.chatMeta, { color: colors.textMuted }]}>Classroom discussion</Text></View><View style={styles.sync}><View style={[styles.syncDot, bookingId && liveChat.connectionState !== 'live' && styles.syncDotOffline]} /><Text style={[styles.syncText, bookingId && liveChat.connectionState !== 'live' && styles.syncTextOffline]}>{!bookingId ? 'Demo' : liveChat.connectionState === 'live' ? 'Live' : liveChat.connectionState === 'connecting' ? 'Connecting' : 'Reconnecting'}</Text></View></View>
          {bookingId && messages.length === 0 && !liveChat.error && <View style={[styles.chatEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name="chatbubbles-outline" size={20} color="#655CF2" /><Text style={[styles.chatEmptyTitle, { color: colors.text }]}>Start the conversation</Text><Text style={[styles.chatEmptyText, { color: colors.textMuted }]}>Messages are visible only to the learner and tutor in this session.</Text></View>}
          <View style={styles.messages}>{messages.map((item) => <View key={item.id} style={[styles.messageWrap, item.mine && styles.messageWrapMine]}><View style={styles.messageMeta}><Text style={[styles.messageAuthor, { color: colors.text }]}>{item.mine ? 'You' : item.author}</Text><Text style={[styles.messageTime, { color: colors.textMuted }]}>{item.time}</Text></View><View style={[styles.messageBubble, { backgroundColor: colors.surface }, item.mine && styles.messageMine]}><Text style={[styles.messageText, { color: colors.text }, item.mine && styles.messageTextMine]}>{item.text}</Text></View></View>)}</View>
          {!!liveChat.error && bookingId && <View style={styles.chatError}><Ionicons name="alert-circle-outline" size={14} color="#B54862" /><Text style={styles.chatErrorText}>{liveChat.error}</Text></View>}
          <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}><TextInput accessibilityLabel="Classroom message" editable={!liveChat.sending} maxLength={1000} value={draft} onChangeText={setDraft} onSubmitEditing={() => void sendMessage()} placeholder="Type a message or formula..." placeholderTextColor={colors.textMuted} style={[styles.composerInput, { color: colors.text }]} /><Pressable accessibilityLabel="Send message" disabled={!draft.trim() || liveChat.sending} onPress={() => void sendMessage()} style={[styles.send, (!draft.trim() || liveChat.sending) && styles.sendDisabled]}>{liveChat.sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}</Pressable></View>

          <View style={styles.notesHeader}><View style={styles.notesTitleRow}><Ionicons name="create-outline" size={16} color="#C47718" /><Text style={[styles.sectionTitle, { color: colors.text }]}>Shared Session Notes</Text></View><View style={styles.collaborative}><Text style={styles.collaborativeText}>Live Collaborative</Text></View></View>
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toolbar}>
              <Text style={styles.noteTotal}>{notes.length} short {notes.length === 1 ? 'note' : 'notes'}</Text>
              <Text style={styles.autosave}>{notesFeedback}</Text>
            </View>
            {tutorRole && (
              <View style={styles.noteComposer}>
                <TextInput accessibilityLabel="New short session note" editable={!noteBusyId} multiline maxLength={280} value={newNote} onChangeText={setNewNote} placeholder="Add a small note..." placeholderTextColor={colors.textMuted} style={[styles.newNoteInput, { color: colors.text, borderColor: colors.border }]} />
                <View style={styles.noteComposerFooter}>
                  <Text style={[styles.noteCount, { color: colors.textMuted }]}>{newNote.length}/280</Text>
                  <Pressable disabled={!newNote.trim() || !!noteBusyId || notes.length >= 20} onPress={() => void addShortNote()} style={[styles.addNote, (!newNote.trim() || !!noteBusyId || notes.length >= 20) && styles.noteActionDisabled]}>
                    {noteBusyId === 'new' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="add" size={14} color="#FFFFFF" />}
                    <Text style={styles.addNoteText}>Add Note</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <View style={styles.noteList}>
              {notes.length === 0 && <View style={styles.notesEmpty}><Ionicons name="document-text-outline" size={22} color="#8C84F6" /><Text style={[styles.notesEmptyTitle, { color: colors.text }]}>No short notes yet</Text><Text style={[styles.notesEmptyText, { color: colors.textMuted }]}>{tutorRole ? 'Add the first note for this lesson.' : 'Your tutor’s notes will appear here.'}</Text></View>}
              {notes.map((note, index) => {
                const editing = editingId === note.id;
                const noteBusy = noteBusyId === note.id;
                return <View key={note.id} style={[styles.shortNoteCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <View style={styles.shortNoteHeader}>
                    <View style={styles.noteNumber}><Text style={styles.noteNumberText}>{index + 1}</Text></View>
                    <Text style={[styles.noteTime, { color: colors.textMuted }]}>{formatNoteTime(note.updatedAt || note.createdAt)}</Text>
                    {tutorRole && !editing && <View style={styles.noteIconActions}>
                      <Pressable accessibilityLabel={`Edit note ${index + 1}`} disabled={!!noteBusyId} onPress={() => { setEditingId(note.id); setEditingText(note.text); }} style={styles.noteIconButton}><Ionicons name="create-outline" size={15} color="#655CF2" /></Pressable>
                      <Pressable accessibilityLabel={`Delete note ${index + 1}`} disabled={!!noteBusyId} onPress={() => void deleteShortNote(note.id)} style={[styles.noteIconButton, styles.deleteIconButton]}>{noteBusy ? <ActivityIndicator size="small" color="#B94E67" /> : <Ionicons name="trash-outline" size={14} color="#B94E67" />}</Pressable>
                    </View>}
                  </View>
                  {editing ? <>
                    <TextInput accessibilityLabel={`Edit note ${index + 1}`} editable={!noteBusy} multiline maxLength={280} value={editingText} onChangeText={setEditingText} style={[styles.editNoteInput, { color: colors.text, borderColor: colors.border }]} />
                    <View style={styles.editNoteFooter}><Text style={[styles.noteCount, { color: colors.textMuted }]}>{editingText.length}/280</Text><Pressable disabled={noteBusy} onPress={() => { setEditingId(null); setEditingText(''); }} style={styles.cancelEdit}><Text style={styles.cancelEditText}>Cancel</Text></Pressable><Pressable disabled={!editingText.trim() || editingText.trim() === note.text.trim() || noteBusy} onPress={() => void saveEditedNote(note.id)} style={[styles.saveEdit, (!editingText.trim() || editingText.trim() === note.text.trim() || noteBusy) && styles.noteActionDisabled]}>{noteBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="save-outline" size={13} color="#FFFFFF" />}<Text style={styles.saveEditText}>Save</Text></Pressable></View>
                  </> : <Text style={[styles.shortNoteText, { color: colors.text }]}>{note.text}</Text>}
                </View>;
              })}
            </View>
            <View style={styles.notesFooter}><View style={styles.collaborators}><View style={[styles.collaborator, { backgroundColor: '#655CF2' }]}><Text style={styles.collaboratorText}>{initials(tutorName)}</Text></View><View style={[styles.collaborator, { backgroundColor: '#13A778', marginLeft: -5 }]}><Text style={styles.collaboratorText}>{initials(learnerName)}</Text></View></View><Text style={[styles.syncedText, { color: colors.textMuted }]}>Synced with lesson notebook</Text></View>
          </View>
        {tutorRole && canComplete && <Pressable disabled={busy} onPress={onComplete} style={[styles.complete, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" /><Text style={styles.completeText}>Mark Session Complete</Text></>}</Pressable>}
      </ScrollView>
      <AppBottomNav active={conversationType === 'tutor-request' ? 'discover' : 'bookings'} />
    </SafeAreaView>
  );
}

function Control({ icon, active, danger }: { icon: keyof typeof Ionicons.glyphMap; active?: boolean; danger?: boolean }) {
  return <View style={[styles.control, active && styles.controlActive, danger && styles.controlDanger]}><Ionicons name={icon} size={16} color="#FFFFFF" /></View>;
}

function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

function formatNoteTime(value?: string) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, scroll: { flex: 1 }, content: { width: '100%', maxWidth: 620, alignSelf: 'center', padding: 12, paddingBottom: 22 },
  header: { minHeight: 58, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#E7E4F3' }, headerButton: { width: 35, height: 40, alignItems: 'center', justifyContent: 'center' }, headerCopy: { flex: 1 }, headerTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 16 }, headerSub: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 2 }, profilePill: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#4E45DD', alignItems: 'center', justifyContent: 'center' },
  learnerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, smallAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#DAD5FF', alignItems: 'center', justifyContent: 'center' }, smallAvatarText: { color: '#5148D7', fontFamily: 'Manrope_800ExtraBold', fontSize: 12 }, online: { position: 'absolute', right: -1, bottom: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#11A271', borderWidth: 2, borderColor: '#FFFFFF' }, learnerCopy: { flex: 1, marginLeft: 9 }, learnerName: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13 }, learnerMeta: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 3 }, timer: { height: 25, borderRadius: 8, backgroundColor: '#FFE4E6', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }, recordDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E44858' }, timerText: { color: '#BE3546', fontFamily: 'Inter_700Bold', fontSize: 8 },
  videoStage: { height: 230, borderRadius: 18, overflow: 'hidden', borderWidth: 3, borderColor: '#BEC8BA' }, studentVideo: { flex: 1 }, videoLabel: { position: 'absolute', left: 8, top: 8, zIndex: 2, borderRadius: 7, backgroundColor: 'rgba(12,35,37,0.72)', paddingHorizontal: 7, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }, liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#33D89B' }, videoLabelText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 7 }, personSilhouette: { position: 'absolute', left: 42, bottom: 33, alignItems: 'center' }, head: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#C99A72' }, body: { width: 77, height: 74, marginTop: -2, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#244754' }, board: { position: 'absolute', right: 18, top: 30, width: 120, height: 85, borderRadius: 5, backgroundColor: '#F5F0DB', padding: 10, transform: [{ rotate: '-2deg' }] }, boardText: { color: '#414655', fontFamily: 'Manrope_800ExtraBold', fontSize: 10 }, boardLine: { height: 4, borderRadius: 2, backgroundColor: '#8A8D91', width: '82%', marginTop: 12 }, selfVideo: { position: 'absolute', right: 8, bottom: 40, width: 105, height: 85, borderRadius: 11, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center' }, selfHead: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#9A694C', marginTop: 13 }, selfBody: { width: 60, height: 48, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#172B3E', marginTop: -1 }, selfLabel: { position: 'absolute', left: 5, bottom: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' }, selfLabelText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 7 }, controls: { position: 'absolute', left: 0, right: 0, bottom: 7, flexDirection: 'row', justifyContent: 'center', gap: 6 }, control: { width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(20,24,43,0.88)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }, controlActive: { backgroundColor: '#5C50ED' }, controlDanger: { backgroundColor: '#D83148' },
  meetingInvite: { minHeight: 66, borderRadius: 15, borderWidth: 1, padding: 9, marginTop: 10, flexDirection: 'row', alignItems: 'center' }, meetingInviteIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: '#655CF2', alignItems: 'center', justifyContent: 'center' }, meetingInviteCopy: { flex: 1, marginLeft: 9 }, meetingInviteTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 11 }, meetingInviteText: { fontFamily: 'Inter_400Regular', fontSize: 8, lineHeight: 12, marginTop: 2 }, meetingInviteAction: { minHeight: 35, borderRadius: 10, backgroundColor: '#16A779', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9 }, meetingInviteActionText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 8 },
  chatHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }, sectionTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 13 }, messageCount: { color: '#6B6D7E', fontFamily: 'Inter_400Regular', fontSize: 8 }, chatMeta: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 3 }, sync: { flexDirection: 'row', alignItems: 'center', gap: 4 }, syncDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10A16F' }, syncDotOffline: { backgroundColor: '#E09A31' }, syncText: { color: '#12835F', fontFamily: 'Inter_700Bold', fontSize: 7 }, syncTextOffline: { color: '#A76B16' },
  chatEmpty: { minHeight: 92, borderRadius: 13, borderWidth: 1, marginTop: 8, alignItems: 'center', justifyContent: 'center', padding: 12 }, chatEmptyTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 10, marginTop: 4 }, chatEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 3 }, chatError: { minHeight: 36, borderRadius: 10, backgroundColor: '#FFF0F3', paddingHorizontal: 9, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, chatErrorText: { flex: 1, color: '#A9435A', fontFamily: 'Inter_400Regular', fontSize: 8, lineHeight: 12 },
  messages: { marginTop: 8, gap: 7 }, messageWrap: { alignItems: 'flex-start', maxWidth: '88%' }, messageWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' }, messageMeta: { flexDirection: 'row', gap: 5, alignItems: 'center', marginBottom: 3 }, messageAuthor: { fontFamily: 'Inter_700Bold', fontSize: 7 }, messageTime: { fontFamily: 'Inter_400Regular', fontSize: 7 }, messageBubble: { borderRadius: 11, borderTopLeftRadius: 3, paddingHorizontal: 10, paddingVertical: 8 }, messageMine: { backgroundColor: '#5D50ED', borderTopLeftRadius: 11, borderTopRightRadius: 3 }, messageText: { fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 13 }, messageTextMine: { color: '#FFFFFF' },
  composer: { height: 44, borderWidth: 1, borderRadius: 12, paddingLeft: 10, paddingRight: 5, marginTop: 9, flexDirection: 'row', alignItems: 'center' }, composerInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 9 }, send: { width: 33, height: 33, borderRadius: 9, backgroundColor: '#5D50ED', alignItems: 'center', justifyContent: 'center' }, sendDisabled: { opacity: 0.38 },
  notesHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, marginBottom: 7 }, notesTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, collaborative: { borderRadius: 7, backgroundColor: '#BEF8DA', paddingHorizontal: 7, paddingVertical: 4 }, collaborativeText: { color: '#138A61', fontFamily: 'Inter_700Bold', fontSize: 6.5 }, notesCard: { borderWidth: 1, borderRadius: 13, padding: 10 }, toolbar: { height: 27, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#ECE9F5' }, noteTotal: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 8 }, autosave: { marginLeft: 'auto', color: '#138A61', fontFamily: 'Inter_700Bold', fontSize: 7 }, noteComposer: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#ECE9F5' }, newNoteInput: { minHeight: 58, maxHeight: 100, borderWidth: 1, borderRadius: 10, padding: 9, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14 }, noteComposerFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, noteCount: { marginLeft: 'auto', fontFamily: 'Inter_400Regular', fontSize: 7 }, addNote: { height: 29, borderRadius: 8, backgroundColor: '#5D50ED', paddingHorizontal: 10, marginLeft: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, addNoteText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 8 }, noteActionDisabled: { opacity: 0.38 }, noteList: { gap: 7, paddingVertical: 8 }, notesEmpty: { minHeight: 88, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }, notesEmptyTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 10, marginTop: 5 }, notesEmptyText: { fontFamily: 'Inter_400Regular', fontSize: 8, marginTop: 3 }, shortNoteCard: { borderWidth: 1, borderRadius: 11, padding: 9 }, shortNoteHeader: { minHeight: 23, flexDirection: 'row', alignItems: 'center' }, noteNumber: { width: 21, height: 21, borderRadius: 7, backgroundColor: '#E9E5FF', alignItems: 'center', justifyContent: 'center' }, noteNumberText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 8 }, noteTime: { fontFamily: 'Inter_400Regular', fontSize: 7, marginLeft: 7 }, noteIconActions: { flexDirection: 'row', gap: 5, marginLeft: 'auto' }, noteIconButton: { width: 27, height: 27, borderRadius: 8, backgroundColor: '#ECE9FF', alignItems: 'center', justifyContent: 'center' }, deleteIconButton: { backgroundColor: '#FFF0F3' }, shortNoteText: { fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14, marginTop: 6 }, editNoteInput: { minHeight: 55, borderWidth: 1, borderRadius: 9, padding: 8, marginTop: 6, textAlignVertical: 'top', fontFamily: 'Inter_400Regular', fontSize: 9, lineHeight: 14 }, editNoteFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 6 }, cancelEdit: { height: 28, paddingHorizontal: 9, marginLeft: 7, justifyContent: 'center' }, cancelEditText: { color: '#77788A', fontFamily: 'Inter_700Bold', fontSize: 8 }, saveEdit: { height: 28, borderRadius: 8, backgroundColor: '#5D50ED', paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }, saveEditText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 8 }, notesFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 2 }, collaborators: { flexDirection: 'row' }, collaborator: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFFFFF' }, collaboratorText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 5 }, syncedText: { fontFamily: 'Inter_400Regular', fontSize: 7 },
  complete: { height: 48, borderRadius: 12, backgroundColor: '#5D50ED', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 13 }, completeText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 11 }, disabled: { opacity: 0.5 },
});
