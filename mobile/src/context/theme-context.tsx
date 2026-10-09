import * as SecureStore from "expo-secure-store";
import { Appearance, Platform, useColorScheme } from "react-native";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AppThemeMode = "light" | "dark";

const STORAGE_KEY = "tutor-link-theme-mode";
const LEGACY_STORAGE_KEY = "tutorly-theme-mode";

const lightColors = {
  background: "#F4F2FA",
  surface: "#FFFEFF",
  surfaceMuted: "#F2EFF8",
  surfaceElevated: "#FFFEFF",
  text: "#211D35",
  textMuted: "#746F88",
  border: "#E5DFF0",
  softPurple: "#ECE8FF",
  icon: "#302A49",
  inactive: "#8B869D",
} as const;

const darkColors = {
  background: "#0E1020",
  surface: "#171A2D",
  surfaceMuted: "#20243B",
  surfaceElevated: "#1D2038",
  text: "#F8F8FC",
  textMuted: "#AEB2C7",
  border: "#2B304D",
  softPurple: "#292653",
  icon: "#F1F1FA",
  inactive: "#989DB7",
} as const;

type ThemeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  colors: typeof lightColors | typeof darkColors;
  setMode: (mode: AppThemeMode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readStoredMode() {
  if (Platform.OS === "web") {
    const currentMode = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (currentMode) return currentMode;
    const legacyMode = globalThis.localStorage?.getItem(LEGACY_STORAGE_KEY);
    if (legacyMode) {
      globalThis.localStorage?.setItem(STORAGE_KEY, legacyMode);
      globalThis.localStorage?.removeItem(LEGACY_STORAGE_KEY);
    }
    return legacyMode;
  }
  const currentMode = await SecureStore.getItemAsync(STORAGE_KEY);
  if (currentMode) return currentMode;
  const legacyMode = await SecureStore.getItemAsync(LEGACY_STORAGE_KEY);
  if (legacyMode) {
    await SecureStore.setItemAsync(STORAGE_KEY, legacyMode);
    await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
  }
  return legacyMode;
}

async function storeMode(mode: AppThemeMode) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode);
    globalThis.localStorage?.removeItem(LEGACY_STORAGE_KEY);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, mode);
  await SecureStore.deleteItemAsync(LEGACY_STORAGE_KEY);
}

function syncNativeColorScheme(mode: AppThemeMode) {
  // React Native Web does not implement Appearance.setColorScheme even though
  // it is present in the shared React Native TypeScript definition.
  if (
    Platform.OS !== "web" &&
    typeof Appearance.setColorScheme === "function"
  ) {
    Appearance.setColorScheme(mode);
  }
}

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<AppThemeMode>(
    systemScheme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    readStoredMode()
      .then((stored) => {
        if (stored === "light" || stored === "dark") {
          setModeState(stored);
          syncNativeColorScheme(stored);
        }
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((nextMode: AppThemeMode) => {
    setModeState(nextMode);
    syncNativeColorScheme(nextMode);
    storeMode(nextMode).catch(() => undefined);
  }, []);

  const toggleMode = useCallback(
    () => setMode(mode === "dark" ? "light" : "dark"),
    [mode, setMode],
  );
  const value = useMemo(
    () => ({
      mode,
      isDark: mode === "dark",
      colors: mode === "dark" ? darkColors : lightColors,
      setMode,
      toggleMode,
    }),
    [mode, setMode, toggleMode],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const value = useContext(ThemeContext);
  if (!value)
    throw new Error("useAppTheme must be used inside AppThemeProvider");
  return value;
}
