import * as SecureStore from "expo-secure-store";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";
import { AuthUser, authApi, OnboardingPayload } from "@/services/api";

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role: "student" | "tutor";
};
type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  googleLogin: (idToken: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
const tokenKey = "tutor-link-auth-token";
const legacyTokenKey = "tutorly-auth-token";

async function saveToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) localStorage.setItem(tokenKey, token);
    else localStorage.removeItem(tokenKey);
    localStorage.removeItem(legacyTokenKey);
  } else if (token) {
    await SecureStore.setItemAsync(tokenKey, token);
    await SecureStore.deleteItemAsync(legacyTokenKey);
  } else {
    await Promise.all([
      SecureStore.deleteItemAsync(tokenKey),
      SecureStore.deleteItemAsync(legacyTokenKey),
    ]);
  }
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    const currentToken = localStorage.getItem(tokenKey);
    if (currentToken) return currentToken;
    const legacyToken = localStorage.getItem(legacyTokenKey);
    if (legacyToken) {
      localStorage.setItem(tokenKey, legacyToken);
      localStorage.removeItem(legacyTokenKey);
    }
    return legacyToken;
  }
  const currentToken = await SecureStore.getItemAsync(tokenKey);
  if (currentToken) return currentToken;
  const legacyToken = await SecureStore.getItemAsync(legacyTokenKey);
  if (legacyToken) {
    await SecureStore.setItemAsync(tokenKey, legacyToken);
    await SecureStore.deleteItemAsync(legacyTokenKey);
  }
  return legacyToken;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    readToken()
      .then(async (storedToken) => {
        if (!storedToken) return;
        const result = await authApi.profile(storedToken);
        setToken(storedToken);
        setUser(result.user);
      })
      .catch(() => saveToken(null))
      .finally(() => setIsBootstrapping(false));
  }, []);

  async function login(email: string, password: string) {
    const result = await authApi.login(email, password);
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }
  async function googleLogin(idToken: string) {
    const result = await authApi.google(idToken);
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }
  async function register(payload: RegisterPayload) {
    const result = await authApi.register(payload);
    await saveToken(result.token);
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }
  async function completeOnboarding(payload: OnboardingPayload) {
    if (!token)
      throw new Error("Your session is missing. Please register again.");
    await authApi.completeOnboarding(payload, token);
    const profile = await authApi.profile(token);
    setUser(profile.user);
  }
  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const result = await authApi.profile(token);
    setUser(result.user);
    return result.user;
  }, [token]);
  async function logout() {
    await saveToken(null);
    setToken(null);
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isBootstrapping,
        login,
        googleLogin,
        register,
        completeOnboarding,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
