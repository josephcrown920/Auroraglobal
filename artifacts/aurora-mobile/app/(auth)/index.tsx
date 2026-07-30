import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong";
      setError(
        msg.includes("Invalid login") ? "Invalid email or password." :
        msg.includes("already registered") ? "This email is already registered. Try signing in." :
        msg.includes("password") ? "Password must be at least 6 characters." :
        msg
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(168,85,247,0.18)", "transparent"]}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInUp.duration(500)} style={styles.header}>
            <View style={[styles.logoRing, { borderColor: colors.primary, backgroundColor: colors.muted }]}>
              <Feather name="zap" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.logoText, { color: colors.foreground }]}>Aurora Studio</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              AI-powered creative studio
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(500).delay(100)} style={styles.card}>
            <View style={[styles.cardInner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.fields}>
                <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Feather name="mail" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Email address"
                    placeholderTextColor={colors.mutedForeground}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                  />
                </View>

                <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Feather name="lock" size={16} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="Password"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <Pressable onPress={() => setShowPass(v => !v)} hitSlop={8}>
                    <Feather name={showPass ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              </View>

              {error ? (
                <View style={[styles.errorBox, { backgroundColor: "rgba(232,64,64,0.12)", borderColor: "rgba(232,64,64,0.3)" }]}>
                  <Feather name="alert-circle" size={14} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                </View>
              ) : null}

              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                style={({ pressed }) => [
                  styles.submitBtn,
                  { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: pressed || loading ? 0.8 : 1 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                    Sign In
                  </Text>
                )}
              </Pressable>

              <Text style={[styles.legal, { color: colors.mutedForeground }]}>
                Sign in with your Aurora account.
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 300 },
  scroll: { paddingHorizontal: 20, flexGrow: 1 },
  header: { alignItems: "center", marginBottom: 32 },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5, fontFamily: "Inter_700Bold" },
  tagline: { fontSize: 14, marginTop: 4, fontFamily: "Inter_400Regular" },
  card: { width: "100%" },
  cardInner: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 16 },
  tabs: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 3,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  fields: { gap: 12 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  submitBtn: {
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  submitText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  legal: { fontSize: 11, textAlign: "center", lineHeight: 16 },
  footer: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 24, alignItems: "center" },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});
