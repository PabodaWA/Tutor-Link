import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

export function BrandLogo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return <View style={styles.row}><LinearGradient colors={['#8D80FF', '#5345D5']} style={[styles.mark, compact && styles.markCompact]}><Ionicons name="school" size={compact ? 17 : 25} color="#FFFFFF" /></LinearGradient><View><Text style={[styles.name, compact && styles.nameCompact, light && styles.light]}>Tutor Link</Text>{!compact && <Text style={[styles.tagline, light && styles.taglineLight]}>LEARN • TEACH • GROW</Text>}</View></View>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, mark: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#5C4DE2', shadowOpacity: 0.35, shadowRadius: 12, elevation: 7 }, markCompact: { width: 36, height: 36, borderRadius: 12 }, name: { color: '#171A2B', fontFamily: 'Manrope_800ExtraBold', fontSize: 24, letterSpacing: -0.8 }, nameCompact: { fontFamily: 'Manrope_700Bold', fontSize: 15, letterSpacing: -0.5 }, light: { color: '#FFFFFF' }, tagline: { color: '#7269DB', fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, marginTop: 2 }, taglineLight: { color: '#D5D0FF' } });
