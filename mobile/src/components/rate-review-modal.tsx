import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/context/auth-context';
import { useAppTheme } from '@/context/theme-context';
import { apiRequest } from '@/services/api';

type RateReviewModalProps = {
  visible: boolean;
  tutorId?: string;
  tutorName?: string;
  subject?: string;
  onClose: () => void;
  onSubmitted: (message: string) => void;
};

export function RateReviewModal({ visible, tutorId, tutorName, subject, onClose, onSubmitted }: RateReviewModalProps) {
  const { token } = useAuth();
  const { colors } = useAppTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [existing, setExisting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !token || !tutorId) return;
    let active = true;
    const request = setTimeout(() => {
      setRating(0);
      setComment('');
      setEligible(false);
      setExisting(false);
      setError('');
      setLoading(true);
      void apiRequest<{
        canReview: boolean;
        review: { rating: number; comment?: string } | null;
      }>(`/tutors/${tutorId}/review-eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((data) => {
          if (!active) return;
          if (!data.canReview) {
            setError('Complete a lesson with this tutor before rating them.');
            return;
          }
          setEligible(true);
          if (data.review) {
            setRating(data.review.rating);
            setComment(data.review.comment || '');
            setExisting(true);
          }
        })
        .catch((reason: unknown) => {
          if (!active) return;
          setError(reason instanceof Error ? reason.message : 'Could not load your review.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => { active = false; clearTimeout(request); };
  }, [token, tutorId, visible]);

  async function submit() {
    if (!token || !tutorId || !rating) return;
    try {
      setSaving(true);
      setError('');
      await apiRequest(`/tutors/${tutorId}/reviews`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      onSubmitted(existing ? 'Your rating and review were updated.' : 'Thanks! Your rating was submitted.');
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your rating.');
    } finally {
      setSaving(false);
    }
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!saving) onClose(); }}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.icon}><Ionicons name="star" size={24} color="#F0A02A" /></View>
        <Text style={[styles.title, { color: colors.text }]}>{existing ? 'Update your rating' : 'Rate your lesson'}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>How was your {subject || 'lesson'} session with {tutorName || 'your tutor'}?</Text>

        {loading ? <ActivityIndicator style={styles.loader} color="#655CF2" /> : eligible ? <>
          <View style={styles.ratingPicker}>
            {[1, 2, 3, 4, 5].map((value) => <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`${value} star rating`}
              accessibilityState={{ selected: rating === value }}
              disabled={saving}
              onPress={() => { setRating(value); setError(''); }}
              hitSlop={5}
            ><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={35} color="#F0A02A" /></Pressable>)}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>Review <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            accessibilityLabel="Optional written review"
            value={comment}
            onChangeText={setComment}
            editable={!saving}
            multiline
            maxLength={500}
            placeholder="What did you like about the lesson?"
            placeholderTextColor="#999BA9"
            style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          />
          <Text style={[styles.count, { color: colors.textMuted }]}>{comment.length}/500</Text>
        </> : null}

        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={onClose} style={styles.cancel}><Text style={styles.cancelText}>Not now</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={loading || saving || !eligible || !rating} onPress={submit} style={[styles.submit, (loading || saving || !eligible || !rating) && styles.disabled]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{existing ? 'Update' : 'Submit'}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(18,16,39,0.58)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 430, borderRadius: 25, padding: 20 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#EFEDFF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  title: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, textAlign: 'center', marginTop: 11 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  loader: { marginVertical: 30 },
  ratingPicker: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 22, marginBottom: 18 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 12, marginBottom: 7 },
  optional: { color: '#8B8D9E', fontFamily: 'Inter_400Regular' },
  input: { minHeight: 104, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, textAlignVertical: 'top' },
  count: { alignSelf: 'flex-end', fontFamily: 'Inter_400Regular', fontSize: 9, marginTop: 4 },
  error: { color: '#B64660', fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 17 },
  cancel: { flex: 1, height: 45, borderRadius: 14, backgroundColor: '#F0EEF6', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#606273', fontFamily: 'Inter_700Bold', fontSize: 12 },
  submit: { flex: 1, height: 45, borderRadius: 14, backgroundColor: '#655CF2', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 12 },
  disabled: { opacity: 0.48 },
});
