import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function LoginScreen() {
  const C = useColors();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert("Required", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (needsConfirmation) {
          Alert.alert(
            "Check your email",
            "We sent you a confirmation link. Verify your email, then sign in.",
          );
          setMode("signin");
        }
      }
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.container}>
          {/* Logo + wordmark */}
          <View style={styles.hero}>
            <LinearGradient
              colors={[...colors.dark.gradientHero]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoRing}
            >
              <Text style={styles.logoLetter}>A</Text>
            </LinearGradient>
            <Text style={[styles.wordmark, { color: C.foreground }]}>Aurora</Text>
            <Text style={[styles.tagline, { color: C.mutedForeground }]}>
              {mode === "signin" ? "Sign in to your account" : "Create a new account"}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={[styles.label, { color: C.mutedForeground }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.secondary, color: C.foreground, borderColor: C.border }]}
              placeholder="you@example.com"
              placeholderTextColor={C.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <Text style={[styles.label, { color: C.mutedForeground }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: C.secondary, color: C.foreground, borderColor: C.border }]}
              placeholder="••••••••"
              placeholderTextColor={C.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType={mode === "signup" ? "newPassword" : "password"}
            />

            <Pressable
              style={({ pressed }) => [styles.submitWrap, { opacity: pressed || loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <LinearGradient
                colors={[...colors.dark.gradientHero]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === "signin" ? "Sign In" : "Create Account"}
                  </Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.toggleWrap, { opacity: pressed ? 0.5 : 1 }]}
              onPress={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
            >
              <Text style={[styles.toggleText, { color: C.mutedForeground }]}>
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <Text style={{ color: C.primary }}>
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  hero: { alignItems: "center", marginBottom: 44 },
  logoRing: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoLetter: { fontSize: 38, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  wordmark: { fontSize: 30, fontWeight: "700", fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginTop: 8, fontFamily: "Inter_400Regular" },
  form: { gap: 0 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  submitWrap: { marginTop: 8 },
  submitGradient: {
    height: 54,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  toggleWrap: { marginTop: 24, alignItems: "center" },
  toggleText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
