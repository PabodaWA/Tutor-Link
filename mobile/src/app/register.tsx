import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { FormField } from '@/components/auth/form-field';
import { PrimaryButton } from '@/components/auth/primary-button';
import { palette } from '@/constants/auth-theme';
import { useAuth } from '@/context/auth-context';

type Role = 'student' | 'tutor';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setError('');
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid university email.');
    if (password.length < 8) return setError('Password must contain at least 8 characters.');
    if (!agreed) return setError('Please accept the Terms and Privacy Policy.');
    try {
      setLoading(true);
      await register({ name: name.trim(), email: email.trim(), password, role });
      router.replace('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell canGoBack eyebrow="JOIN THE COMMUNITY" title="Create your account" subtitle="A few details and your next study connection is one step closer.">
      <View style={styles.form}>
        <View style={styles.cardHeading}>
          <View><Text style={styles.cardTitle}>Let’s get you started</Text><Text style={styles.cardCaption}>It only takes a minute</Text></View>
          <View style={styles.stepBadge}><Text style={styles.stepText}>01</Text><View style={styles.stepDivider} /><Text style={styles.stepTotal}>01</Text></View>
        </View>
        <FormField label="Full name" icon="person-outline" placeholder="Alex Morgan" value={name} onChangeText={setName} autoComplete="name" />
        <FormField label="University email" icon="mail-outline" placeholder="alex@university.edu" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <FormField label="Password" icon="lock-closed-outline" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secure autoComplete="new-password" />
        <View style={styles.roleSection}>
          <Text style={styles.label}>I want to join as</Text>
          <View style={styles.roleRow}>
            <RoleCard active={role === 'student'} icon="school-outline" title="Learner" caption="Find tutors & grow" onPress={() => setRole('student')} />
            <RoleCard active={role === 'tutor'} icon="sparkles-outline" title="Tutor" caption="Share skills & earn" onPress={() => setRole('tutor')} />
          </View>
        </View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={styles.termsRow} onPress={() => setAgreed((value) => !value)}>
          <View style={[styles.checkbox, agreed && styles.checkboxActive]}>{agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}</View>
          <Text style={styles.termsText}>I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text></Text>
        </Pressable>
        {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View>}
        <PrimaryButton title="Create account" loading={loading} onPress={handleRegister} />
        <View style={styles.footerRow}><Text style={styles.footerText}>Already a member? </Text><Link href="/" asChild><Pressable><Text style={styles.footerLink}>Sign in</Text></Pressable></Link></View>
      </View>
    </AuthShell>
  );
}

function RoleCard({ active, icon, title, caption, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; title: string; caption: string; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.roleCard, active && styles.roleCardActive, pressed && { opacity: 0.8 }]}>
    <View style={[styles.roleIcon, active && styles.roleIconActive]}><Ionicons name={active ? 'checkmark' : icon} size={17} color={active ? '#FFFFFF' : palette.primary} /></View>
    <View style={styles.roleCopy}><Text style={styles.roleTitle}>{title}</Text><Text style={styles.roleCaption}>{caption}</Text></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  form: { gap: 13 }, cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }, cardTitle: { color: palette.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 18, letterSpacing: -0.4 }, cardCaption: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 }, stepBadge: { height: 29, borderRadius: 10, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primarySoft }, stepText: { color: palette.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 11 }, stepDivider: { width: 11, height: 1, backgroundColor: '#BBB5F7', marginHorizontal: 4 }, stepTotal: { color: '#9995BC', fontFamily: 'Inter_700Bold', fontSize: 11 }, roleSection: { gap: 8 }, label: { color: '#292C3D', fontFamily: 'Manrope_700Bold', fontSize: 13 }, roleRow: { flexDirection: 'row', gap: 9 },
  roleCard: { flex: 1, minHeight: 72, borderWidth: 1, borderColor: '#E2E4ED', borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FAFAFC' }, roleCardActive: { borderWidth: 1.5, borderColor: '#756AF3', backgroundColor: '#F2F0FF', shadowColor: palette.primary, shadowOpacity: 0.1, shadowRadius: 9, elevation: 2 },
  roleIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEDFF' }, roleIconActive: { backgroundColor: palette.primary }, roleCopy: { flex: 1, gap: 2 }, roleTitle: { color: palette.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, roleCaption: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 13 },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 1 }, checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#C9CDE2', alignItems: 'center', justifyContent: 'center', marginTop: 1 }, checkboxActive: { backgroundColor: palette.primary, borderColor: palette.primary }, termsText: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 17, flex: 1 }, termsLink: { color: palette.primary, fontFamily: 'Inter_700Bold' },
  errorBox: { backgroundColor: palette.dangerSoft, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FFD9E1' }, errorText: { color: palette.danger, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18, flex: 1 }, footerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 }, footerText: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 14 }, footerLink: { color: palette.primary, fontFamily: 'Manrope_700Bold', fontSize: 14 },
});
