import { Ionicons } from '@expo/vector-icons';
import { Href, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';

import { useAuth } from '@/context/auth-context';
import { apiOrigin } from '@/services/api';

type MessageNotice = {
  title: string;
  text: string;
  bookingId?: string;
  actionRoute: string;
};

export function RealtimeMessageBanner() {
  const { token } = useAuth();
  const pathname = usePathname();
  const [notice, setNotice] = useState<MessageNotice | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(apiOrigin(), { auth: { token }, forceNew: true, reconnection: true });
    socket.on('message:notification', (nextNotice: MessageNotice) => {
      if (pathname === nextNotice.actionRoute.split('?')[0]) return;
      setNotice(nextNotice);
    });
    return () => {
      socket.disconnect();
    };
  }, [pathname, token]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;

  return (
    <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${notice.title}. Open conversation`} onPress={() => { setNotice(null); router.push(notice.actionRoute as Href); }} style={styles.banner}>
        <View style={styles.icon}><Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" /></View>
        <View style={styles.copy}><Text style={styles.title}>{notice.title}</Text><Text numberOfLines={2} style={styles.text}>{notice.text}</Text></View>
        <Ionicons name="chevron-forward" size={18} color="#655CF2" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 12 },
  banner: { minHeight: 68, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD7FF', padding: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#302866', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#655CF2', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, marginHorizontal: 10 },
  title: { color: '#242638', fontFamily: 'Manrope_800ExtraBold', fontSize: 12 },
  text: { color: '#737587', fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14, marginTop: 2 },
});
