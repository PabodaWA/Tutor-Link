import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FeatureShell } from '@/components/feature-shell';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';
import { Tutor } from './types';

function availableText(value?: string) {
  if (!value) return 'No open slots';
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TutorComparison() {
  const { ids = '' } = useLocalSearchParams<{ ids?: string }>();
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestedIds = useMemo(() => ids.split(',').filter(Boolean), [ids]);

  useEffect(() => {
    let active = true;
    apiRequest<{ tutors: Tutor[] }>(`/tutors/compare?ids=${encodeURIComponent(ids)}`)
      .then((data) => { if (active) setTutors([...data.tutors].sort((left, right) => requestedIds.indexOf(left._id) - requestedIds.indexOf(right._id))); })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Could not compare tutors.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ids, refreshKey, requestedIds]);

  function retry() {
    setLoading(true);
    setError('');
    setRefreshKey((value) => value + 1);
  }

  const bestRating = Math.max(...tutors.map((tutor) => tutor.averageRating || 0));
  const lowestRate = Math.min(...tutors.map((tutor) => tutor.profile?.hourlyRate ?? Number.POSITIVE_INFINITY));
  const comparisonWidth = Math.max(280, windowWidth - 40);
  const cardWidth = tutors.length === 2
    ? Math.max(142, (comparisonWidth - 11) / 2)
    : Math.min(205, comparisonWidth * 0.58);

  return <FeatureShell activeTab="discover" showBack fallbackHref="/discover" title="Compare tutors" subtitle="Review expertise, availability, ratings and rates side by side.">
    {loading && <ActivityIndicator color="#655CF2" />}
    {!loading && !!error && <View style={[styles.state, { backgroundColor: colors.surface }]}><Ionicons name="alert-circle-outline" size={28} color="#C6536C" /><Text style={styles.error}>{error}</Text><Pressable onPress={retry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>}
    {!loading && !error && tutors.length < 2 && <View style={[styles.state, { backgroundColor: colors.surface }]}><Ionicons name="git-compare-outline" size={30} color="#655CF2" /><Text style={[styles.emptyTitle, { color: colors.text }]}>Choose at least two tutors</Text><Pressable onPress={() => router.replace('/discover')} style={styles.retry}><Text style={styles.retryText}>Back to discovery</Text></Pressable></View>}
    {!loading && tutors.length >= 2 && <ScrollView horizontal showsHorizontalScrollIndicator={tutors.length > 2} scrollEnabled={tutors.length > 2} contentContainerStyle={styles.row}>{tutors.map((tutor, index) => {
      const badges = [tutor.averageRating > 0 && tutor.averageRating === bestRating ? 'Highest rated' : '', tutor.profile?.hourlyRate === lowestRate ? 'Lowest price' : ''].filter(Boolean);
      return <View key={tutor._id} style={[styles.card, { width: cardWidth, backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${tutor.name} from comparison`} onPress={() => setTutors((items) => items.filter((item) => item._id !== tutor._id))} style={[styles.remove, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="close" size={16} color={colors.textMuted} /></Pressable>
        <View style={[styles.avatar, { backgroundColor: ['#6558E8', '#D76789', '#238D80'][index % 3] }]}><Text style={styles.initials}>{tutor.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text><View style={styles.check}><Ionicons name="checkmark" size={10} color="#FFFFFF" /></View></View>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{tutor.name}</Text>
        <Text numberOfLines={2} style={[styles.subject, { color: colors.textMuted }]}>{tutor.profile?.subjects?.slice(0, 3).join(' • ') || 'University Tutor'}</Text>
        {!!badges.length && <View style={styles.badgeRow}>{badges.map((badge) => <View key={badge} style={styles.badge}><Ionicons name="sparkles" size={10} color="#5B4ED2" /><Text style={styles.badgeText}>{badge}</Text></View>)}</View>}
        <Metric icon="star" label="Rating" value={tutor.averageRating ? tutor.averageRating.toFixed(1) : 'New'} />
        <Metric icon="chatbubble" label="Reviews" value={String(tutor.reviewCount)} />
        <Metric icon="time" label="Experience" value={tutor.profile?.experience || '—'} />
        <Metric icon="cash" label="Hourly rate" value={`Rs.${tutor.profile?.hourlyRate?.toLocaleString() || '—'}`} />
        <Metric icon="calendar" label="Next slot" value={availableText(tutor.nextAvailableAt)} compact />
        <Metric icon="school" label="Qualification" value={tutor.profile?.qualifications?.[0] || 'Not listed'} compact />
        <Pressable onPress={() => router.push({ pathname: '/tutor/[id]', params: { id: tutor._id } })} style={styles.view}><Text style={styles.viewText}>View profile</Text><Ionicons name="arrow-forward" size={14} color="#FFFFFF" /></Pressable>
        <Pressable onPress={() => router.push({ pathname: '/booking/availability', params: { tutorId: tutor._id } })} style={[styles.book, { borderColor: '#655CF2' }]}><Ionicons name="calendar-outline" size={14} color="#655CF2" /><Text style={styles.bookText}>Book now</Text></Pressable>
      </View>;
    })}</ScrollView>}
  </FeatureShell>;
}

function Metric({ icon, label, value, compact = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; compact?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={[styles.metric, { borderTopColor: colors.border }]}><View style={styles.metricLabel}><Ionicons name={icon} size={12} color="#655CF2" /><Text style={[styles.metricLabelText, { color: colors.textMuted }]}>{label}</Text></View><Text numberOfLines={compact ? 2 : 1} style={[styles.metricValue, compact && styles.metricCompact, { color: colors.text }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  row: { gap: 11, paddingRight: 1, alignItems: 'stretch' }, card: { paddingHorizontal: 10, paddingVertical: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', shadowColor: '#302B59', shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 }, remove: { position: 'absolute', right: 8, top: 8, width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', zIndex: 1 }, avatar: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, initials: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 16 }, check: { position: 'absolute', right: -2, bottom: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#1AAE7D', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, name: { fontFamily: 'Manrope_800ExtraBold', fontSize: 14, lineHeight: 18, textAlign: 'center', marginTop: 10, minHeight: 36 }, subject: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 3, marginBottom: 8, minHeight: 28 }, badgeRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: 7, minHeight: 22 }, badge: { backgroundColor: '#E9E5FF', borderRadius: 7, paddingHorizontal: 5, minHeight: 21, flexDirection: 'row', alignItems: 'center', gap: 2 }, badgeText: { color: '#5B4ED2', fontFamily: 'Inter_700Bold', fontSize: 8 }, metric: { width: '100%', minHeight: 51, paddingVertical: 6, borderTopWidth: 1, justifyContent: 'center' }, metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 }, metricLabelText: { fontFamily: 'Inter_400Regular', fontSize: 9 }, metricValue: { width: '100%', textAlign: 'left', fontFamily: 'Inter_700Bold', fontSize: 11, marginTop: 4 }, metricCompact: { fontSize: 9, lineHeight: 12 }, view: { width: '100%', height: 40, borderRadius: 12, backgroundColor: '#655CF2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 9 }, viewText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 11 }, book: { width: '100%', height: 39, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 7 }, bookText: { color: '#655CF2', fontFamily: 'Inter_700Bold', fontSize: 11 }, state: { padding: 25, borderRadius: 22, alignItems: 'center' }, error: { color: '#B84D64', fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 8, textAlign: 'center' }, emptyTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, marginTop: 9 }, retry: { backgroundColor: '#655CF2', height: 39, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', marginTop: 14 }, retryText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 },
});
