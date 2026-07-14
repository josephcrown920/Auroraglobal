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
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getUserProfile } from "@/lib/api";

const ENGINES = [
  { id: "seedance", label: "Seedance 2.0", icon: "aperture", desc: "Hyper-real motion · identity-preserving", badge: "BEST" },
  { id: "kling",    label: "Kling 3.0",    icon: "film",     desc: "Cinematic · 5s / 10s clips",            badge: null },
  { id: "heygen",   label: "HeyGen Avatar", icon: "user",    desc: "Talking-head · lip-sync built-in",       badge: null },
] as const;
type EngineId = (typeof ENGINES)[number]["id"];

const DURATIONS = ["5s", "10s", "15s", "30s"] as const;

const STYLES = [
  { id: "direct",    label: "Direct-to-camera", icon: "camera" },
  { id: "cinematic", label: "Cinematic",         icon: "video" },
  { id: "ugc",       label: "UGC / Creator",     icon: "trending-up" },
  { id: "product",   label: "Product showcase",  icon: "package" },
] as const;

export default function VideoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [engine,   setEngine]   = useState<EngineId>("seedance");
  const [duration, setDuration] = useState<string>("10s");
  const [style,    setStyle]    = useState<string>("cinematic");
  const [prompt,   setPrompt]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 10_000,
  });
  const credits = profile?.credits_balance ?? 0;

  async function handleGenerate() {
    if (!prompt.trim()) { setError("Enter a video idea or script."); return; }
    setLoading(true); setError(null); setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // Placeholder — real integration wires to /api/ugc-line/videos or /api/orchestrate
      await new Promise((r) => setTimeout(r, 1200));
      setError("Video generation from mobile is coming soon — use Aurora web for now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(99,60,200,0.18)", "transparent"]}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Video</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>AI video generation</Text>
            </View>
            <View style={[styles.creditBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.creditText, { color: colors.foreground }]}>{credits}</Text>
            </View>
          </View>

          {/* Engine picker */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Engine</Text>
          <View style={styles.engineList}>
            {ENGINES.map((e) => {
              const active = engine === e.id;
              return (
                <Pressable
                  key={e.id}
                  onPress={() => { setEngine(e.id); Haptics.selectionAsync(); }}
                  style={[
                    styles.engineCard,
                    {
                      backgroundColor: active ? `${colors.primary}1a` : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View style={styles.engineTop}>
                    <View style={[styles.engineIcon, { backgroundColor: active ? `${colors.primary}22` : colors.muted }]}>
                      <Feather name={e.icon as any} size={16} color={active ? colors.primary : colors.mutedForeground} />
                    </View>
                    {e.badge && (
                      <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.badgeText}>{e.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.engineLabel, { color: active ? colors.primary : colors.foreground }]}>{e.label}</Text>
                  <Text style={[styles.engineDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{e.desc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Style */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Style</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {STYLES.map((s) => {
              const active = style === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => { setStyle(s.id); Haptics.selectionAsync(); }}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Feather name={s.icon as any} size={13} color={active ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.pillText, { color: active ? colors.primaryForeground : colors.foreground }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Duration */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Duration</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => { setDuration(d); Haptics.selectionAsync(); }}
                  style={[
                    styles.durationBtn,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[styles.durationText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{d}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Prompt */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Script / Idea</Text>
          <View style={[styles.promptWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput
              style={[styles.promptInput, { color: colors.foreground }]}
              placeholder="Describe your video idea, scene, or paste a script…"
              placeholderTextColor={colors.mutedForeground}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={800}
            />
          </View>

          {error && (
            <Animated.View
              entering={FadeIn}
              exiting={FadeOut}
              style={[styles.errorBox, { backgroundColor: "rgba(232,64,64,0.1)", borderColor: "rgba(232,64,64,0.25)" }]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </Animated.View>
          )}

          {/* Generate */}
          <Pressable
            onPress={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={({ pressed }) => [
              styles.generateBtn,
              { borderRadius: colors.radius, opacity: (!prompt.trim() || loading) ? 0.5 : pressed ? 0.9 : 1 },
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDeep]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.generateInner, { borderRadius: colors.radius }]}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Feather name="play-circle" size={20} color={colors.primaryForeground} />
              )}
              <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                {loading ? "Generating…" : `Generate with ${ENGINES.find(e=>e.id===engine)?.label}`}
              </Text>
            </LinearGradient>
          </Pressable>

          {/* Coming soon note */}
          <View style={[styles.comingSoon, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={[styles.comingSoonText, { color: colors.mutedForeground }]}>
              Full video rendering is active on Aurora web. Mobile playback and download coming soon.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 280, zIndex: 0 },
  scroll: { paddingHorizontal: 20, gap: 8, zIndex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  creditBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  creditText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
  engineList: { flexDirection: "row", gap: 10 },
  engineCard: { flex: 1, padding: 12, borderWidth: 1, gap: 8 },
  engineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  engineIcon: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  engineLabel: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold" },
  engineDesc: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },
  pillRow: { gap: 8, paddingVertical: 4 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  durationRow: { flexDirection: "row", gap: 10 },
  durationBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  durationText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  promptWrap: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, minHeight: 100, marginTop: 4 },
  promptInput: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: "flex-start" },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  generateBtn: { marginTop: 8, overflow: "hidden" },
  generateInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17 },
  generateText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  comingSoon: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderWidth: 1, marginTop: 4 },
  comingSoonText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
