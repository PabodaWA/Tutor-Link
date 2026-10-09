import { Href, router, Stack, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { AppThemeProvider, useAppTheme } from "@/context/theme-context";
import { BrandSplash } from "@/components/brand-splash";
import { RealtimeMessageBanner } from "@/components/realtime-message-banner";
import "@/services/lesson-reminders";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    SplashScreen.hideAsync();
    const timer = setTimeout(() => setShowSplash(false), 1100);
    return () => clearTimeout(timer);
  }, [fontError, fontsLoaded]);
  useEffect(() => {
    if (Platform.OS === "web") return;
    const openResponse = (
      response: Notifications.NotificationResponse | null,
    ) => {
      const route = response?.notification.request.content.data?.route;
      if (typeof route === "string") router.push(route as Href);
    };
    Notifications.getLastNotificationResponseAsync()
      .then(openResponse)
      .catch(() => undefined);
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => subscription.remove();
  }, []);

  return (
    <AppThemeProvider>
      <AuthProvider>
        <AppNavigator
          minimumSplash={showSplash || (!fontsLoaded && !fontError)}
        />
      </AuthProvider>
    </AppThemeProvider>
  );
}

function AppNavigator({ minimumSplash }: { minimumSplash: boolean }) {
  const { user, isBootstrapping } = useAuth();
  const { isDark, colors } = useAppTheme();
  const pathname = usePathname();

  useEffect(() => {
    if (minimumSplash || isBootstrapping) return;
    const publicRoute = pathname === "/" || pathname === "/register";

    if (!user) {
      if (!publicRoute) router.replace("/");
      return;
    }

    if (user.role === "admin") {
      if (
        !pathname.startsWith("/admin") &&
        pathname !== "/profile" &&
        pathname !== "/notifications"
      )
        router.replace("/admin");
      return;
    }

    if (!user.onboardingCompleted) {
      if (pathname !== "/onboarding") router.replace("/onboarding");
      return;
    }

    if (
      publicRoute ||
      pathname === "/onboarding" ||
      pathname.startsWith("/admin")
    )
      router.replace("/home");
  }, [isBootstrapping, minimumSplash, pathname, user]);

  if (minimumSplash || isBootstrapping) return <BrandSplash />;

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        initialRouteName="index"
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="home" options={{ gestureEnabled: false }} />
        <Stack.Screen name="discover" />
        <Stack.Screen name="find-tutor" />
        <Stack.Screen name="recommended-tutors" />
        <Stack.Screen name="compare" />
        <Stack.Screen name="tutor/[id]" />
        <Stack.Screen name="tutor/[id]/why" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="booking/availability" />
        <Stack.Screen name="booking/details" />
        <Stack.Screen name="booking/confirmation" options={{ gestureEnabled: false }} />
        <Stack.Screen name="booking/my-bookings" />
        <Stack.Screen name="booking/reschedule" />
        <Stack.Screen name="booking/cancel" />
        <Stack.Screen name="booking/requests" />
        <Stack.Screen name="booking/request/[id]" />
        <Stack.Screen name="tutor-requests" />
        <Stack.Screen name="direct-session/[requestId]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="meeting/[bookingId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="meeting/tutor-request/[requestId]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="payments" />
        <Stack.Screen name="credits" />
        <Stack.Screen name="credits/top-up" />
        <Stack.Screen name="credits/payment" />
        <Stack.Screen name="credits/success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="admin" options={{ gestureEnabled: false }} />
      </Stack>
      <RealtimeMessageBanner />
    </>
  );
}
