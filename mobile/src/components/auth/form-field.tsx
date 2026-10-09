import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { palette } from '@/constants/auth-theme';

type Props = TextInputProps & { label: string; icon: keyof typeof Ionicons.glyphMap; secure?: boolean };

export function FormField({ label, icon, secure, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return <View style={styles.group}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrap, focused && styles.inputFocused]}>
      <View style={[styles.iconWrap, focused && styles.iconWrapFocused]}><Ionicons name={icon} size={18} color={focused ? '#FFFFFF' : palette.primary} /></View>
      <TextInput {...props} style={styles.input} placeholderTextColor="#A3A7B8" secureTextEntry={secure && !visible} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} />
      {secure && <Pressable accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible((value) => !value)} hitSlop={10} style={styles.eyeButton}><Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={19} color="#868AA1" /></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 7 }, label: { color: '#292C3D', fontFamily: 'Manrope_700Bold', fontSize: 13, letterSpacing: 0.05 },
  inputWrap: { height: 56, borderRadius: 16, paddingHorizontal: 9, borderWidth: 1, borderColor: '#E2E4ED', backgroundColor: '#F8F8FB', flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputFocused: { borderColor: '#756AF3', backgroundColor: '#FFFFFF', shadowColor: palette.primary, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 2 },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFEDFF' }, iconWrapFocused: { backgroundColor: palette.primary },
  input: { flex: 1, height: '100%', color: palette.ink, fontFamily: 'Inter_500Medium', fontSize: 15 }, eyeButton: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
});
