import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { FormField } from '@/components/auth/form-field';
import { PrimaryButton } from '@/components/auth/primary-button';
import { palette } from '@/constants/auth-theme';
import { useAuth } from '@/context/auth-context';

WebBrowser.maybeCompleteAuthSession();

const missingClientId = 'google-oauth-client-id-not-configured';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const googleLogo = 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg';

export default function LoginScreen() {
  const { googleLogin, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const processedGoogleToken = useRef<string | null>(null);
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId || missingClientId,
    androidClientId: googleAndroidClientId || missingClientId,
    iosClientId: googleIosClientId || missingClientId,
    selectAccount: true,
  }, { scheme: 'mobile', path: 'oauthredirect' });

  const googleConfigured = Platform.select({
    web: Boolean(googleWebClientId),
    android: Boolean(googleAndroidClientId),
    ios: Boolean(googleIosClientId),
    default: false,
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token || googleResponse.authentication?.idToken;
    if (!idToken || processedGoogleToken.current === idToken) return;
    processedGoogleToken.current = idToken;

    Promise.resolve().then(async () => {
      try {
        setGoogleLoading(true);
        setError('');
        const account = await googleLogin(idToken);
        router.replace(account.role === 'admin' ? '/admin' : account.onboardingCompleted ? '/home' : '/onboarding');
      } catch (err) {
        processedGoogleToken.current = null;
        setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      } finally {
        setGoogleLoading(false);
      }
    });
  }, [googleLogin, googleResponse]);

  async function handleGoogleLogin() {
    setError('');
    if (!googleConfigured) {
      setError(`Google sign-in is not configured for ${Platform.OS} yet. Add the Google OAuth client ID to mobile/.env.`);
      return;
    }
    try {
      setGoogleLoading(true);
      const result = await promptGoogleAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') setGoogleLoading(false);
      if (result.type === 'error') {
        setError('Google sign-in was not completed. Please try again.');
        setGoogleLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open Google sign-in.');
      setGoogleLoading(false);
    }
  }

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    try {
      setLoading(true);
      const account = await login(email.trim(), password);
      router.replace(account.role === 'admin' ? '/admin' : account.onboardingCompleted ? '/home' : '/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell eyebrow="YOUR CAMPUS, CONNECTED" title="Welcome back" subtitle="Sign in to learn, teach, and grow with your university community.">
      <View style={styles.form}>
        <View style={styles.cardHeading}>
          <View><Text style={styles.cardTitle}>Sign in to your account</Text><Text style={styles.cardCaption}>Enter your university credentials</Text></View>
          <View style={styles.memberBadge}><Ionicons name="shield-checkmark" size={14} color="#198465" /><Text style={styles.memberBadgeText}>SECURE</Text></View>
        </View>
        <FormField label="University email" icon="mail-outline" placeholder="you@university.edu" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <FormField label="Password" icon="lock-closed-outline" placeholder="Enter your password" value={password} onChangeText={setPassword} secure autoComplete="current-password" />
        <Pressable accessibilityRole="button" onPress={() => Alert.alert('Coming soon', 'Password reset will be enabled with your email provider.')}><Text style={styles.forgot}>Forgot password?</Text></Pressable>
        {!!error && <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View>}
        <PrimaryButton title="Sign in" loading={loading} onPress={handleLogin} />
        <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.dividerText}>or continue with</Text><View style={styles.divider} /></View>
        <Pressable accessibilityRole="button" disabled={!googleRequest || googleLoading || loading} style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, (!googleRequest || googleLoading || loading) && styles.disabled]} onPress={handleGoogleLogin}>
          {googleLoading ? <ActivityIndicator color="#0B57D0" /> : <><View style={styles.googleMark}><Image source={googleLogo} contentFit="contain" style={styles.googleLogo} /></View><Text style={styles.googleText}>Continue with Google</Text></>}
        </Pressable>
        <View style={styles.footerRow}><Text style={styles.footerText}>New to Tutor Link? </Text><Link href="/register" asChild><Pressable><Text style={styles.footerLink}>Create an account</Text></Pressable></Link></View>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: { gap: 15 }, cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }, cardTitle: { color: palette.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 18, letterSpacing: -0.4 }, cardCaption: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 3 }, memberBadge: { height: 29, paddingHorizontal: 9, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EAF8F2' }, memberBadgeText: { color: '#198465', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.5 }, forgot: { color: palette.primary, fontFamily: 'Manrope_700Bold', fontSize: 13, textAlign: 'right', marginTop: -4 },
  errorBox: { backgroundColor: palette.dangerSoft, borderRadius: 13, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FFD9E1' }, errorText: { color: palette.danger, fontFamily: 'Inter_400Regular', fontSize: 13, flex: 1, lineHeight: 18 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 1 }, divider: { height: 1, flex: 1, backgroundColor: palette.border }, dividerText: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 13 },
  googleButton: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#747775', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12 },
  googleMark: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }, googleLogo: { width: 18, height: 18 }, googleText: { color: '#1F1F1F', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }, pressed: { backgroundColor: '#F8FAFD', borderColor: '#5F6368' }, disabled: { opacity: 0.58 },
  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 7 }, footerText: { color: palette.muted, fontFamily: 'Inter_400Regular', fontSize: 14 }, footerLink: { color: palette.primary, fontFamily: 'Manrope_700Bold', fontSize: 14 },
});
