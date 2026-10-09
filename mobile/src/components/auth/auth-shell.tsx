import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/context/theme-context';

type Props = PropsWithChildren<{ title: string; subtitle: string; eyebrow: string; canGoBack?: boolean }>;

export function AuthShell({ title, subtitle, eyebrow, canGoBack, children }: Props) {
  const { isDark, toggleMode } = useAppTheme();
  const { height } = useWindowDimensions();
  const compact = height < 780;
  return (
    <LinearGradient
      colors={['#11142F', '#30256F', '#705CF4', '#F2F0FF']}
      locations={[0, 0.29, 0.57, 0.9]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.background}>
      <View style={[styles.orb, styles.orbOne]} />
      <View style={[styles.orb, styles.orbTwo]} />
      <View style={[styles.orb, styles.orbThree]} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.page}>
              <View style={[styles.topbar, compact && styles.topbarCompact]}>
                {canGoBack ? <Pressable accessibilityLabel="Go back" onPress={() => router.replace('/')} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#FFFFFF" /></Pressable> : <View style={styles.backSpace} />}
                <View style={styles.brandRow}>
                  <LinearGradient colors={['#FFFFFF', '#DCD6FF']} style={styles.brandMark}><Ionicons name="sparkles" size={16} color="#5C4DE5" /></LinearGradient>
                  <Text style={styles.brand}>Tutor Link</Text><View style={styles.brandDot} />
                </View>
                <Pressable accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} mode`} onPress={toggleMode} style={styles.topPill}><Ionicons name={isDark ? 'sunny' : 'moon'} size={14} color={isDark ? '#FFD166' : '#DCD7FF'} /><Text style={styles.topPillText}>{isDark ? 'LIGHT' : 'DARK'}</Text></Pressable>
              </View>
              <View style={[styles.intro, compact && styles.introCompact]}>
                <View style={styles.eyebrowPill}><View style={styles.liveDot} /><Text style={styles.eyebrow}>{eyebrow}</Text></View>
                <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
                <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>{subtitle}</Text>
                <View style={styles.benefits}>
                  <View style={styles.benefit}><Ionicons name="checkmark-circle" size={16} color="#CFC9FF" /><Text style={styles.benefitText}>Verified community</Text></View>
                  <View style={styles.benefit}><Ionicons name="flash" size={15} color="#FFD68A" /><Text style={styles.benefitText}>Learn faster</Text></View>
                </View>
              </View>
              <View style={[styles.card, compact && styles.cardCompact]}>{children}</View>
              <View style={[styles.secureRow, compact && styles.secureRowCompact]}><View style={styles.secureIcon}><Ionicons name="shield-checkmark" size={12} color="#5A51DC" /></View><Text style={styles.secure}>Your information is encrypted and secure</Text></View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, background: { flex: 1 }, safe: { flex: 1 },
  orb: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  orbOne: { width: 280, height: 280, right: -105, top: -95, backgroundColor: 'rgba(139,123,255,0.18)' },
  orbTwo: { width: 180, height: 180, left: -95, top: 210, backgroundColor: 'rgba(92,183,255,0.10)' },
  orbThree: { width: 90, height: 90, right: 18, top: 248, backgroundColor: 'rgba(255,204,135,0.10)' },
  scrollContent: { flexGrow: 1, paddingVertical: 8 }, scrollContentCompact: { paddingVertical: 3 }, page: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 20 },
  topbar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topbarCompact: { height: 46 },
  backButton: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }, backSpace: { width: 52 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, brandMark: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 8 }, brand: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 18, letterSpacing: -0.5 }, brandDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#AFA4FF', marginLeft: -3 },
  topPill: { minWidth: 52, height: 29, borderRadius: 15, paddingHorizontal: 8, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' }, topPillText: { color: '#E8E5FF', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  intro: { marginTop: 24, marginBottom: 22 }, introCompact: { marginTop: 14, marginBottom: 16 }, eyebrowPill: { alignSelf: 'flex-start', height: 25, paddingHorizontal: 10, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' }, liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#7EF0BD', shadowColor: '#7EF0BD', shadowOpacity: 0.8, shadowRadius: 5 }, eyebrow: { color: '#EEEAFE', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.35 },
  title: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 34, lineHeight: 41, letterSpacing: -1.15, marginTop: 13 }, subtitle: { color: '#D9D5F2', fontFamily: 'Manrope_700Bold', fontSize: 17, lineHeight: 21, marginTop: 7, maxWidth: 420 },
  titleCompact: { fontSize: 30, lineHeight: 35, marginTop: 10 }, subtitleCompact: { fontSize: 15, lineHeight: 19, marginTop: 5 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 14 }, benefit: { flexDirection: 'row', alignItems: 'center', gap: 5 }, benefitText: { color: '#F0EEFF', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, paddingHorizontal: 21, paddingVertical: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#16103B', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.23, shadowRadius: 34, elevation: 14 }, cardCompact: { borderRadius: 25, paddingHorizontal: 17, paddingVertical: 18 },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, marginBottom: 22 }, secureRowCompact: { marginTop: 12, marginBottom: 14 }, secureIcon: { width: 22, height: 22, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center' }, secure: { color: '#595D73', fontFamily: 'Inter_600SemiBold', fontSize: 11 },
});
