import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = { title: string; loading?: boolean; onPress: () => void };

export function PrimaryButton({ title, loading, onPress }: Props) {
  return <Pressable disabled={loading} onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed, loading && styles.disabled]}>
    <LinearGradient colors={['#766CF9', '#554CE8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <View style={styles.content}><Text style={styles.text}>{title}</Text><View style={styles.arrow}><Ionicons name="arrow-forward" size={15} color="#5146D8" /></View></View>}
    </LinearGradient>
  </Pressable>;
}

const styles = StyleSheet.create({ pressable: { borderRadius: 16, shadowColor: '#554CE8', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 18, elevation: 7 }, gradient: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, content: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, text: { color: '#FFFFFF', fontFamily: 'Manrope_700Bold', fontSize: 16, letterSpacing: 0.1 }, arrow: { position: 'absolute', right: 12, width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }, pressed: { transform: [{ scale: 0.986 }], opacity: 0.94 }, disabled: { opacity: 0.7 } });
