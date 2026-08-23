import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGate() {
  const { session, loading, biometricLocked } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading || biometricLocked) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)" as any);
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)" as any);
    }
  }, [session, loading, biometricLocked, segments]);

  if (!loading && session && biometricLocked) {
    return <BiometricLockScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function BiometricLockScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut, unlockWithBiometrics } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const unlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlockWithBiometrics();
    } finally {
      setBusy(false);
    }
  };

  const usePassword = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOut({ preserveBiometrics: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[lockStyles.root, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[lockStyles.icon, { backgroundColor: colors.muted, borderColor: colors.primary }]}>
        <Feather name="lock" size={28} color={colors.primary} />
      </View>
      <Text style={[lockStyles.title, { color: colors.foreground }]}>Unlock Aurora</Text>
      <Text style={[lockStyles.copy, { color: colors.mutedForeground }]}>
        Use Face ID, Touch ID, or your device fingerprint to continue.
      </Text>
      <Pressable
        testID="biometric-unlock"
        accessibilityRole="button"
        accessibilityLabel="Unlock Aurora with biometrics"
        onPress={unlock}
        disabled={busy}
        style={({ pressed }) => [
          lockStyles.button,
          { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed || busy ? 0.75 : 1 },
        ]}
      >
        {busy ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="unlock" size={18} color={colors.primaryForeground} />}
        <Text style={[lockStyles.buttonText, { color: colors.primaryForeground }]}>
          {busy ? "Waiting for verification…" : "Unlock with Face ID"}
        </Text>
      </Pressable>
      <Pressable
        testID="use-password"
        accessibilityRole="button"
        accessibilityLabel="Use password instead"
        onPress={usePassword}
        disabled={busy}
        style={lockStyles.passwordButton}
      >
        <Text style={[lockStyles.passwordText, { color: colors.mutedForeground }]}>Use password instead</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <AuthGate />
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const lockStyles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  icon: { width: 72, height: 72, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  copy: { maxWidth: 300, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8, fontFamily: "Inter_400Regular" },
  button: { width: "100%", minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 28, paddingHorizontal: 18 },
  buttonText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  passwordButton: { paddingVertical: 16, paddingHorizontal: 20 },
  passwordText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
