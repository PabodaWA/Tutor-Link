import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/constants/auth-theme';
import { useAuth } from '@/context/auth-context';

const learnerSubjects = ['Programming', 'Mathematics', 'Data Science', 'Business', 'Design', 'Languages'];
const tutorSubjects = ['Java', 'Web Dev', 'Mathematics', 'Databases', 'UI/UX', 'English'];
const studyLevels = ['Foundation', 'Undergraduate', 'Postgraduate'] as const;
const learningGoals = ['Pass exams', 'Build skills', 'Master a subject'] as const;
const experienceLevels = ['New tutor', '1-2 years', '3+ years'] as const;

export default function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const role = user?.role === 'tutor' ? 'tutor' : 'student';
  const isTutor = role === 'tutor';
  const options = isTutor ? tutorSubjects : learnerSubjects;
  const [selected, setSelected] = useState<string[]>([]);
  const [level, setLevel] = useState<(typeof studyLevels)[number]>('Undergraduate');
  const [goal, setGoal] = useState<(typeof learningGoals)[number]>('Build skills');
  const [experience, setExperience] = useState<(typeof experienceLevels)[number]>('1-2 years');
  const [rate, setRate] = useState('1500');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const firstName = useMemo(() => user?.name?.split(' ')[0] || 'there', [user?.name]);

  function toggleSubject(subject: string) {
    setSelected((current) => current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]);
  }

  async function finish() {
    if (!user) return router.replace('/');
    if (!selected.length) return setError(`Choose at least one ${isTutor ? 'subject you teach' : 'subject you like'}.`);
    const numericRate = Number(rate);
    if (isTutor && (!Number.isFinite(numericRate) || numericRate < 500)) return setError('Enter an hourly rate of at least Rs.500.');
    try {
      setLoading(true);
      setError('');
      if (isTutor) await completeOnboarding({ role: 'tutor', subjects: selected, experience, hourlyRate: numericRate });
      else await completeOnboarding({ role: 'student', interests: selected, studyLevel: level, learningGoal: goal });
      router.replace('/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#151536', '#4C38B8', '#7B65FA']} style={styles.screen}>
      <View style={styles.orbOne} /><View style={styles.orbTwo} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            <View style={styles.brand}><View style={styles.brandIcon}><Ionicons name="sparkles" size={15} color="#5849DF" /></View><Text style={styles.brandText}>Tutor Link</Text></View>
            <View style={styles.progress}><View style={styles.progressFill} /></View>
            <Text style={styles.step}>STEP 2 OF 2</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.kicker}>{isTutor ? 'BUILD YOUR TUTOR PROFILE' : 'PERSONALIZE YOUR LEARNING'}</Text>
            <Text style={styles.title}>Great to meet you,{`\n`}{firstName} <Text style={styles.wave}>✦</Text></Text>
            <Text style={styles.subtitle}>{isTutor ? 'Tell us what you teach so the right students can discover you.' : 'Tell us what you want to learn and we’ll shape Tutor Link around you.'}</Text>
            <RoleArtwork tutor={isTutor} />
          </View>

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.roleBanner}>
              <LinearGradient colors={isTutor ? ['#FFF0DB', '#FFF8EE'] : ['#EBE8FF', '#F5F3FF']} style={styles.roleIcon}><Ionicons name={isTutor ? 'school' : 'rocket'} size={20} color={isTutor ? '#D8781D' : palette.primary} /></LinearGradient>
              <View style={styles.roleCopy}><Text style={styles.roleLabel}>YOUR JOURNEY</Text><Text style={styles.roleTitle}>{isTutor ? 'Inspire as a Tutor' : 'Grow as a Learner'}</Text></View>
              <View style={styles.verified}><Ionicons name="checkmark-circle" size={16} color="#16A374" /><Text style={styles.verifiedText}>Selected</Text></View>
            </View>

            <Question title={isTutor ? 'What can you teach?' : 'What do you want to learn?'} hint="Choose one or more">
              <View style={styles.chips}>{options.map((item) => <ChoiceChip key={item} label={item} selected={selected.includes(item)} onPress={() => toggleSubject(item)} />)}</View>
            </Question>

            {isTutor ? <>
              <Question title="Your tutoring experience" hint="Pick the closest match"><View style={styles.segment}>{experienceLevels.map((item) => <Segment key={item} label={item} selected={experience === item} onPress={() => setExperience(item)} />)}</View></Question>
              <Question title="Starting hourly rate" hint="You can change this later">
                <View style={styles.rateInput}><Text style={styles.currency}>Rs.</Text><TextInput value={rate} onChangeText={setRate} keyboardType="number-pad" style={styles.rateText} placeholder="1500" /><Text style={styles.perHour}>/ hour</Text></View>
              </Question>
            </> : <>
              <Question title="Where are you in your studies?" hint="Select your current level"><View style={styles.segment}>{studyLevels.map((item) => <Segment key={item} label={item} selected={level === item} onPress={() => setLevel(item)} />)}</View></Question>
              <Question title="What’s your main goal?" hint="We’ll tune recommendations"><View style={styles.chips}>{learningGoals.map((item) => <ChoiceChip key={item} label={item} selected={goal === item} onPress={() => setGoal(item)} />)}</View></Question>
            </>}

            {!!error && <View style={styles.error}><Ionicons name="alert-circle" size={17} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View>}
            <Pressable disabled={loading} onPress={finish} style={({ pressed }) => [styles.continuePress, pressed && { transform: [{ scale: 0.99 }] }]}>
              <LinearGradient colors={['#7B6DFF', '#5448DF']} style={styles.continueButton}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <><Text style={styles.continueText}>{isTutor ? 'Launch my tutor profile' : 'Build my learning space'}</Text><View style={styles.nextCircle}><Ionicons name="arrow-forward" size={16} color="#5649DF" /></View></>}</LinearGradient>
            </Pressable>
            <Text style={styles.helper}><Ionicons name="shield-checkmark" size={12} />  Your preferences stay private and can be changed anytime</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function RoleArtwork({ tutor }: { tutor: boolean }) {
  return <View style={styles.learningArtworkWrap}><View style={styles.learningArtworkGlow} /><Image source={require('../../assets/images/tutorly-learning-hero.png')} style={styles.learningArtwork} resizeMode="contain" fadeDuration={0} /><View style={styles.artRoleBadge}><Ionicons name={tutor ? 'school' : 'sparkles'} size={14} color="#FFFFFF" /><Text style={styles.artRoleText}>{tutor ? 'TEACH & INSPIRE' : 'LEARN & GROW'}</Text></View></View>;
}

function Question({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) { return <View style={styles.question}><View><Text style={styles.questionTitle}>{title}</Text><Text style={styles.questionHint}>{hint}</Text></View>{children}</View>; }
function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>{selected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}<Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>; }
function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.segmentItem, selected && styles.segmentSelected]}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text></Pressable>; }

const styles = StyleSheet.create({
  screen: { flex: 1 }, safe: { flex: 1 }, scroll: { flexGrow: 1 }, orbOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, right: -120, top: -80, backgroundColor: 'rgba(255,255,255,0.08)' }, orbTwo: { position: 'absolute', width: 150, height: 150, borderRadius: 75, left: -85, top: 260, backgroundColor: 'rgba(97,194,255,0.10)' },
  topbar: { paddingHorizontal: 22, height: 58, flexDirection: 'row', alignItems: 'center' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 7 }, brandIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, brandText: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 16 }, progress: { height: 5, flex: 1, marginLeft: 25, marginRight: 10, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }, progressFill: { width: '100%', height: '100%', backgroundColor: '#BFB6FF' }, step: { color: '#D9D4FF', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.8 },
  hero: { paddingHorizontal: 24, paddingTop: 22, alignItems: 'center' }, kicker: { color: '#D4CEFF', fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: 1.4 }, title: { color: '#FFFFFF', fontFamily: 'Manrope_800ExtraBold', fontSize: 31, lineHeight: 37, textAlign: 'center', letterSpacing: -0.9, marginTop: 10 }, wave: { color: '#FFD57F' }, subtitle: { color: '#D9D5F0', fontFamily: 'Manrope_700Bold', fontSize: 16, lineHeight: 20, textAlign: 'center', maxWidth: 370, marginTop: 8 },
  artwork: { width: 180, height: 112, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, artGlow: { position: 'absolute', width: 115, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.10)' }, artCard: { width: 126, height: 68, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', shadowColor: '#110B31', shadowOpacity: 0.3, shadowRadius: 15, elevation: 8 }, artPerson: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6858EC' }, artLines: { flex: 1, marginLeft: 10, gap: 7 }, artLineLong: { width: '90%', height: 6, borderRadius: 3, backgroundColor: '#DCD8F8' }, artLineShort: { width: '60%', height: 6, borderRadius: 3, backgroundColor: '#ECEAF8' }, artCheck: { position: 'absolute', right: -7, top: -7, width: 25, height: 25, borderRadius: 13, backgroundColor: '#1EB88A', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF' }, floatingIcon: { position: 'absolute', width: 37, height: 37, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(31,27,72,0.85)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }, floatingLeft: { left: 3, top: 30, transform: [{ rotate: '-8deg' }] }, floatingRight: { right: 4, bottom: 13, transform: [{ rotate: '8deg' }] },
  learningArtworkWrap: { width: '100%', height: 238, alignItems: 'center', justifyContent: 'center', marginTop: 5 }, learningArtworkGlow: { position: 'absolute', width: 260, height: 170, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.10)', shadowColor: '#A99EFF', shadowOpacity: 0.32, shadowRadius: 30 }, learningArtwork: { width: 260, height: 235 }, artRoleBadge: { position: 'absolute', right: 16, bottom: 16, height: 31, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(28,23,69,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }, artRoleText: { color: '#FFFFFF', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.8 },
  sheet: { backgroundColor: '#FBFAFF', borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 30, shadowColor: '#171238', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.16, shadowRadius: 30, elevation: 15 }, sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D9D6E6', alignSelf: 'center', marginBottom: 16 },
  roleBanner: { minHeight: 68, borderRadius: 19, padding: 11, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEBF4' }, roleIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, roleCopy: { flex: 1, marginLeft: 10 }, roleLabel: { color: '#9997AC', fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1 }, roleTitle: { color: palette.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 17, marginTop: 3 }, verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, height: 27, borderRadius: 10, backgroundColor: '#EAF9F3' }, verifiedText: { color: '#168664', fontFamily: 'Inter_700Bold', fontSize: 12 },
  question: { gap: 11, marginTop: 21 }, questionTitle: { color: palette.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 17 }, questionHint: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 37, paddingHorizontal: 12, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E7E6F0' }, chipSelected: { backgroundColor: palette.primary, borderColor: palette.primary, shadowColor: palette.primary, shadowOpacity: 0.18, shadowRadius: 8, elevation: 2 }, chipText: { color: '#55586B', fontFamily: 'Inter_700Bold', fontSize: 14 }, chipTextSelected: { color: '#FFFFFF' },
  segment: { padding: 4, borderRadius: 15, backgroundColor: '#ECEAF3', flexDirection: 'row' }, segmentItem: { flex: 1, minHeight: 39, paddingHorizontal: 5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, segmentSelected: { backgroundColor: '#FFFFFF', shadowColor: '#2E2859', shadowOpacity: 0.12, shadowRadius: 7, elevation: 2 }, segmentText: { color: '#77798C', fontFamily: 'Inter_700Bold', fontSize: 13, textAlign: 'center' }, segmentTextSelected: { color: palette.primaryDark, fontWeight: '900' },
  rateInput: { height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: '#E4E2EE', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 }, currency: { color: palette.primary, fontFamily: 'Manrope_700Bold', fontSize: 17 }, rateText: { flex: 1, fontFamily: 'Manrope_700Bold', fontSize: 17, color: palette.ink, marginLeft: 8 }, perHour: { color: palette.muted, fontFamily: 'Inter_700Bold', fontSize: 14 },
  error: { marginTop: 17, padding: 11, borderRadius: 13, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: palette.dangerSoft }, errorText: { color: palette.danger, fontFamily: 'Inter_400Regular', fontSize: 14, flex: 1 }, continuePress: { marginTop: 22, borderRadius: 18, shadowColor: palette.primary, shadowOpacity: 0.28, shadowRadius: 17, shadowOffset: { width: 0, height: 9 }, elevation: 7 }, continueButton: { height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, continueText: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 17 }, nextCircle: { position: 'absolute', right: 14, width: 31, height: 31, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }, helper: { color: '#89899A', fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center', marginTop: 14 },
});
