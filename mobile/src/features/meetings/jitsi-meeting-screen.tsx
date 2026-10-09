import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';

const JitsiMeetingView = lazy(() => import('./jitsi-meeting-view'));

type JoinResponse = {
  meeting: {
    room: string;
    serverURL: string;
  };
};

export function JitsiMeetingScreen({ kind = 'booking' }: { kind?: 'booking' | 'tutor-request' } = {}) {
  const { bookingId, requestId } = useLocalSearchParams<{ bookingId?: string; requestId?: string }>();
  const sessionId = kind === 'booking' ? bookingId : requestId;
  const { user, token } = useAuth();
  const { colors } = useAppTheme();
  const [meeting, setMeeting] = useState<JoinResponse['meeting'] | null>(null);
  const [error, setError] = useState('');
  const closed = useRef(false);
  const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const isWeb = Platform.OS === 'web';
  const useExternalMeeting = isExpoGo || isWeb;

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (router.canGoBack()) router.back();
    else if (kind === 'booking') router.replace({ pathname: '/session/[id]', params: { id: sessionId || '' } });
    else router.replace({ pathname: '/direct-session/[requestId]', params: { requestId: sessionId || '' } });
  }, [kind, sessionId]);

  const join = useCallback(async () => {
    if (!sessionId || !token) {
      setError('Session information is missing. Return to the session and try again.');
      return;
    }
    try {
      setError('');
      const endpoint = kind === 'booking'
        ? `/sessions/${sessionId}/join`
        : `/tutor-requests/${sessionId}/join`;
      const result = await apiRequest<JoinResponse>(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setMeeting(result.meeting);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not join this meeting.');
    }
  }, [kind, sessionId, token]);

  const openExternalMeeting = useCallback(async () => {
    if (!meeting) return;
    const meetingUrl = `${meeting.serverURL.replace(/\/+$/, '')}/${encodeURIComponent(meeting.room)}`;
    try {
      await Linking.openURL(meetingUrl);
    } catch {
      setError('Could not open Jitsi. Check that your browser allows external links and try again.');
    }
  }, [meeting]);

  useEffect(() => {
    const request = setTimeout(() => void join(), 0);
    return () => clearTimeout(request);
  }, [join]);

  if (error) {
    return (
      <MeetingNotice
        icon="alert-circle-outline"
        title="Unable to join meeting"
        message={error}
        action="Try again"
        onAction={() => void join()}
        secondaryAction={close}
      />
    );
  }

  if (useExternalMeeting && meeting) {
    return (
      <MeetingNotice
        icon="videocam-outline"
        title="Your Jitsi room is ready"
        message={isWeb
          ? 'Open the secure meeting in Jitsi from this browser. Embedded meetings remain available in the Android and iOS development builds.'
          : 'Expo Go cannot embed the native Jitsi SDK, but you can open this secure room in Jitsi or your browser.'}
        action="Open Jitsi Meeting"
        onAction={() => void openExternalMeeting()}
        secondaryAction={close}
      />
    );
  }

  if (!meeting) {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#655CF2" />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Connecting to your tutoring meeting…</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.meeting}>
      <Suspense fallback={<ActivityIndicator size="large" color="#655CF2" style={styles.suspenseLoader} />}>
        <JitsiMeetingView
          room={meeting.room}
          serverURL={meeting.serverURL}
          displayName={user?.name || 'Tutor Link participant'}
          email={user?.email || ''}
          onClose={close}
        />
      </Suspense>
    </View>
  );
}

function MeetingNotice({
  icon,
  title,
  message,
  action,
  onAction,
  secondaryAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action: string;
  onAction: () => void;
  secondaryAction?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.noticePage, { backgroundColor: colors.background }]}>
      <View style={[styles.noticeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.noticeIcon}><Ionicons name={icon} size={30} color="#655CF2" /></View>
        <Text style={[styles.noticeTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.noticeMessage, { color: colors.textMuted }]}>{message}</Text>
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.primaryAction}>
          <Text style={styles.primaryActionText}>{action}</Text>
        </Pressable>
        {secondaryAction && (
          <Pressable accessibilityRole="button" onPress={secondaryAction} style={styles.secondaryAction}>
            <Text style={[styles.secondaryActionText, { color: colors.textMuted }]}>Back to session</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  meeting: { flex: 1, backgroundColor: '#000000' },
  suspenseLoader: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  noticePage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  noticeCard: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center' },
  noticeIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#EFEDFF', alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, marginTop: 18, textAlign: 'center' },
  noticeMessage: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 9, textAlign: 'center' },
  primaryAction: { width: '100%', minHeight: 48, borderRadius: 14, backgroundColor: '#655CF2', alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryActionText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 13 },
  secondaryAction: { minHeight: 42, justifyContent: 'center', marginTop: 4 },
  secondaryActionText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
