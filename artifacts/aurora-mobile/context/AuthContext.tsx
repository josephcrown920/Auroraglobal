import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
import { supabase } from "@/lib/supabase";

const BIOMETRIC_PREFERENCE_KEY = "aurora.biometric.preference";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLocked: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: (options?: { preserveBiometrics?: boolean }) => Promise<void>;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
  unlockWithBiometrics: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLocked, setBiometricLocked] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const biometricEnabledRef = useRef(false);
  const biometricPromptRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let mounted = true;

    const restoreAuth = async () => {
      try {
        const [{ data: { session } }, preferenceRaw, hasHardware, isEnrolled] = await Promise.all([
          supabase.auth.getSession(),
          AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY),
          Platform.OS !== "web" ? LocalAuthentication.hasHardwareAsync() : Promise.resolve(false),
          Platform.OS !== "web" ? LocalAuthentication.isEnrolledAsync() : Promise.resolve(false),
        ]);
        if (!mounted) return;

        const preference = preferenceRaw ? JSON.parse(preferenceRaw) as { userId?: string } : null;
        const available = Platform.OS !== "web" && hasHardware && isEnrolled;
        const enabledForSession = Boolean(
          session &&
          preference?.userId === session.user.id &&
          available,
        );
        setBiometricAvailable(available);
        setBiometricEnabled(Boolean(session && preference?.userId === session.user.id));
        setBiometricLocked(enabledForSession);
        setSession(session);
      } catch (error) {
        // A storage/read failure here (e.g. corrupted AsyncStorage) must not
        // leave the app stuck on a loading screen forever — fall back to a
        // signed-out state so the user can still reach the sign-in flow.
        console.error("[auth] session restore failed:", error instanceof Error ? error.message : "unknown error");
        if (mounted) {
          setSession(null);
          setBiometricLocked(false);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void restoreAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionRef.current = session;
      setSession(session);
      if (!session) {
        setBiometricLocked(false);
        setBiometricEnabled(false);
        return;
      }
      void AsyncStorage.getItem(BIOMETRIC_PREFERENCE_KEY).then((preferenceRaw) => {
        const preference = preferenceRaw ? JSON.parse(preferenceRaw) as { userId?: string } : null;
        if (mounted) setBiometricEnabled(preference?.userId === session.user.id);
      }).catch(() => {
        if (mounted) setBiometricEnabled(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    biometricEnabledRef.current = biometricEnabled;
  }, [biometricEnabled]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const wasProtectedState = appStateRef.current === "inactive" || appStateRef.current === "background";
      appStateRef.current = nextState;
      const isProtectedState = nextState === "inactive" || nextState === "background";

      // Native biometric prompts briefly move the app to inactive. Do not
      // lock as a side effect of the enrollment or unlock prompt itself.
      if (
        isProtectedState &&
        !wasProtectedState &&
        sessionRef.current &&
        biometricEnabledRef.current &&
        !biometricPromptRef.current
      ) {
        setBiometricLocked(true);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name ?? "" } },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async (options?: { preserveBiometrics?: boolean }) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (!options?.preserveBiometrics) {
      await AsyncStorage.removeItem(BIOMETRIC_PREFERENCE_KEY);
      setBiometricEnabled(false);
    }
    setBiometricLocked(false);
  }, []);

  const enableBiometrics = useCallback(async () => {
    if (!session || !biometricAvailable) {
      Alert.alert("Face ID unavailable", "Set up Face ID or a fingerprint on this device, then try again.");
      return false;
    }

    biometricPromptRef.current = true;
    let result: LocalAuthentication.LocalAuthenticationResult;
    try {
      result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirm to enable Aurora unlock",
        cancelLabel: "Not now",
        disableDeviceFallback: false,
      });
    } finally {
      biometricPromptRef.current = false;
    }
    if (!result.success) return false;

    await AsyncStorage.setItem(
      BIOMETRIC_PREFERENCE_KEY,
      JSON.stringify({ userId: session.user.id }),
    );
    setBiometricEnabled(true);
    return true;
  }, [biometricAvailable, session]);

  const disableBiometrics = useCallback(async () => {
    await AsyncStorage.removeItem(BIOMETRIC_PREFERENCE_KEY);
    setBiometricEnabled(false);
    setBiometricLocked(false);
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    if (!biometricAvailable) return false;
    biometricPromptRef.current = true;
    let result: LocalAuthentication.LocalAuthenticationResult;
    try {
      result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Aurora Performance Studio",
        cancelLabel: "Use password",
        disableDeviceFallback: false,
      });
    } finally {
      biometricPromptRef.current = false;
    }
    if (!result.success) return false;
    setBiometricLocked(false);
    return true;
  }, [biometricAvailable]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    biometricAvailable,
    biometricEnabled,
    biometricLocked,
    signIn,
    signUp,
    signOut,
    enableBiometrics,
    disableBiometrics,
    unlockWithBiometrics,
  }), [
    biometricAvailable,
    biometricEnabled,
    biometricLocked,
    disableBiometrics,
    enableBiometrics,
    loading,
    session,
    signIn,
    signOut,
    signUp,
    unlockWithBiometrics,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
