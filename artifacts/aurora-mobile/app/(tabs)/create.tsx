import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import {
  CREDIT_COST,
  type GenerationKind,
  type GenerateParams,
  type MotionPreset,
  generate,
} from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_H = Platform.OS === "ios" ? 88 : 68;
const CHAR_LIMIT = 500;

const KINDS: { kind: GenerationKind; label: string; emoji: string }[] = [
  { kind: "image", label: "Image", emoji: "🎨" },
  { kind: "video", label: "Video", emoji: "🎬" },
  { kind: "lipsync", label: "Lipsync", emoji: "🎭" },
  { kind: "upscale", label: "Upscale", emoji: "⬆️" },
];

const MOTIONS: { label: string; value: MotionPreset | undefined }[] = [
  { label: "None", value: undefined },
  { label: "Orbit", value: "orbit" },
  { label: "Push in", value: "push-in" },
  { label: "Pull out", value: "pull-out" },
  { label: "Pan left", value: "pan-left" },
  { label: "Pan right", value: "pan-right" },
  { label: "Tilt up", value: "tilt-up" },
  { label: "Tilt down", value: "tilt-down" },
  { label: "Static", value: "static" },
  { label: "Handheld", value: "handheld" },
];

const DURATIONS = [3, 5, 8, 10, 12];

const TIMING: Record<GenerationKind, string> = {
  image: "10–30 seconds",
  video: "1–3 minutes",
  lipsync: "30–90 seconds",
  upscale: "15–45 seconds",
};

export default function CreateScreen() {
  const C = useColors();
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<GenerationKind>("image");
  const [prompt, setPrompt] = useState("");
  const [motion, setMotion] = useState<MotionPreset | undefined>(undefined);
  const [duration, setDuration] = useState<number>(5);
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultKind, setResultKind] = useState<GenerationKind>("image");

  const mutation = useMutation({
    mutationFn: generate,
    onSuccess: async (data, vars) => {
      setResultUrl(data.url ?? null);
      setResultKind(vars.kind);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
    onError: async (err) => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Generation failed",
        err instanceof Error ? err.message : "Something went wrong.",
      );
    },
  });

  function buildParams(): GenerateParams | null {
    switch (kind) {
      case "image":
        if (!prompt.trim()) {
          Alert.alert("Add a prompt", "Describe what you want to create.");
          return null;
        }
        return { kind, prompt: prompt.trim() };

      case "video":
        if (!prompt.trim()) {
          Alert.alert("Add a prompt", "Describe your video scene.");
          return null;
        }
        return {
          kind,
          prompt: prompt.trim(),
          ...(motion ? { motion } : {}),
          duration,
        };

      case "lipsync":
        if (!videoUrl.trim() || !audioUrl.trim()) {
          Alert.alert("Missing URLs", "Paste both a video URL and an audio URL.");
          return null;
        }
        return { kind, videoUrl: videoUrl.trim(), audioUrl: audioUrl.trim() };

      case "upscale":
        if (!imageUrl.trim()) {
          Alert.alert("Missing URL", "Paste the image URL you want to upscale.");
          return null;
        }
        return { kind, imageUrls: [imageUrl.trim()] };
    }
  }

  function handleGenerate() {
    const params = buildParams();
    if (!params) return;
    setResultUrl(null);
    mutation.mutate(params);
  }

  const generating = mutation.isPending;
  const cost = CREDIT_COST[kind];
  const isImageResult = resultKind === "image" || resultKind === "upscale";

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: C.background }}>
        <View style={styles.header}>
          <LinearGradient
            colors={[...colors.dark.gradientHero]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerLogo}
          >
            <Text style={styles.headerLogoText}>A</Text>
          </LinearGradient>
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Create</Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={TAB_BAR_H}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_H + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Type selector ── */}
          <View style={styles.kindRow}>
            {KINDS.map(({ kind: k, label, emoji }) => {
              const active = kind === k;
              return (
                <Pressable
                  key={k}
                  style={({ pressed }) => [
                    styles.kindChip,
                    {
                      backgroundColor: active ? C.primary : C.secondary,
                      borderColor: active ? C.primary : C.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => {
                    setKind(k);
                    setResultUrl(null);
                  }}
                >
                  <Text style={styles.kindEmoji}>{emoji}</Text>
                  <Text
                    style={[
                      styles.kindLabel,
                      { color: active ? C.primaryForeground : C.foreground },
                    ]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.creditPill,
                      { backgroundColor: active ? "rgba(0,0,0,0.2)" : C.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.creditPillText,
                        { color: active ? C.primaryForeground : C.primaryGlow },
                      ]}
                    >
                      {CREDIT_COST[k]}cr
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* ── Result / generating preview ── */}
          {resultUrl ? (
            <View style={[styles.previewCard, { backgroundColor: C.card, borderColor: C.border }]}>
              {isImageResult ? (
                <Image
                  source={{ uri: resultUrl }}
                  style={styles.previewImage}
                  contentFit="cover"
                  transition={400}
                />
              ) : (
                <View style={[styles.previewImage, styles.videoPlaceholder, { backgroundColor: C.secondary }]}>
                  <Text style={styles.videoIcon}>{resultKind === "lipsync" ? "🎭" : "🎬"}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.openVideoBtn,
                      { backgroundColor: C.primary, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={() => Linking.openURL(resultUrl)}
                  >
                    <Text style={[styles.openVideoText, { color: C.primaryForeground }]}>
                      ▶  Open video
                    </Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.previewFooter}>
                <Text style={[styles.previewLabel, { color: C.mutedForeground }]}>
                  ✨ Ready — saved to your gallery
                </Text>
              </View>
            </View>
          ) : generating ? (
            <View
              style={[
                styles.previewCard,
                styles.generatingCard,
                { backgroundColor: C.card, borderColor: C.primary },
              ]}
            >
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={[styles.generatingText, { color: C.primary }]}>
                Creating your {kind}…
              </Text>
              <Text style={[styles.generatingHint, { color: C.mutedForeground }]}>
                Usually takes {TIMING[kind]}
              </Text>
            </View>
          ) : null}

          {/* ── Type-specific inputs ── */}
          {(kind === "image" || kind === "video") && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: C.foreground }]}>
                {kind === "image" ? "Describe your image" : "Describe your video"}
              </Text>
              <TextInput
                style={[
                  styles.promptInput,
                  {
                    backgroundColor: C.secondary,
                    color: C.foreground,
                    borderColor: generating ? C.primary : C.border,
                  },
                ]}
                placeholder={
                  kind === "image"
                    ? "A vast purple nebula with glowing stars, cinematic, 8K…"
                    : "Astronaut floating through a glowing nebula…"
                }
                placeholderTextColor={C.mutedForeground}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                maxLength={CHAR_LIMIT}
                editable={!generating}
                textAlignVertical="top"
              />
              <Text style={[styles.charCount, { color: C.mutedForeground }]}>
                {prompt.length}/{CHAR_LIMIT}
              </Text>
            </View>
          )}

          {kind === "video" && (
            <>
              {/* Motion preset */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: C.foreground }]}>Camera motion</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {MOTIONS.map(({ label, value }) => {
                    const active = motion === value;
                    return (
                      <Pressable
                        key={label}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: active ? C.primary : C.secondary,
                            borderColor: active ? C.primary : C.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        onPress={() => setMotion(value)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? C.primaryForeground : C.foreground },
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Duration */}
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: C.foreground }]}>Duration</Text>
                <View style={styles.durationRow}>
                  {DURATIONS.map((s) => {
                    const active = duration === s;
                    return (
                      <Pressable
                        key={s}
                        style={({ pressed }) => [
                          styles.durationChip,
                          {
                            backgroundColor: active ? C.primary : C.secondary,
                            borderColor: active ? C.primary : C.border,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        onPress={() => setDuration(s)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? C.primaryForeground : C.foreground },
                          ]}
                        >
                          {s}s
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {kind === "lipsync" && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: C.foreground }]}>Source video URL</Text>
              <TextInput
                style={[styles.urlInput, { backgroundColor: C.secondary, color: C.foreground, borderColor: C.border }]}
                placeholder="https://… (video from your gallery)"
                placeholderTextColor={C.mutedForeground}
                value={videoUrl}
                onChangeText={setVideoUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!generating}
              />
              <Text style={[styles.sectionLabel, { color: C.foreground, marginTop: 12 }]}>Audio URL</Text>
              <TextInput
                style={[styles.urlInput, { backgroundColor: C.secondary, color: C.foreground, borderColor: C.border }]}
                placeholder="https://… (mp3 or wav)"
                placeholderTextColor={C.mutedForeground}
                value={audioUrl}
                onChangeText={setAudioUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!generating}
              />
              <Text style={[styles.hintText, { color: C.mutedForeground }]}>
                Use result URLs from your gallery or trusted CDN links.
              </Text>
            </View>
          )}

          {kind === "upscale" && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: C.foreground }]}>Image URL to upscale</Text>
              <TextInput
                style={[styles.urlInput, { backgroundColor: C.secondary, color: C.foreground, borderColor: C.border }]}
                placeholder="https://… (image from your gallery)"
                placeholderTextColor={C.mutedForeground}
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                editable={!generating}
              />
              <Text style={[styles.hintText, { color: C.mutedForeground }]}>
                Paste a result URL from your gallery to enhance it to higher resolution.
              </Text>
            </View>
          )}

          {/* ── Generate button ── */}
          <Pressable
            style={({ pressed }) => [{ opacity: pressed || generating ? 0.7 : 1 }]}
            onPress={handleGenerate}
            disabled={generating}
          >
            <LinearGradient
              colors={[...colors.dark.gradientHero]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.genGradient}
            >
              {generating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.genText}>
                  ✨  Generate {kind.charAt(0).toUpperCase() + kind.slice(1)}
                </Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={[styles.creditNote, { color: C.mutedForeground }]}>
            {cost} {cost === 1 ? "credit" : "credits"} per {kind}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  headerLogo: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerLogoText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 20 },
  kindRow: { flexDirection: "row", gap: 8 },
  kindChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  kindEmoji: { fontSize: 20 },
  kindLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  creditPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  creditPillText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  previewImage: { width: "100%", aspectRatio: 1 },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", gap: 16 },
  videoIcon: { fontSize: 60 },
  openVideoBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  openVideoText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  previewFooter: { padding: 12 },
  previewLabel: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  generatingCard: { aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  generatingText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  generatingHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  promptInput: {
    minHeight: 110, borderRadius: 12, borderWidth: 1,
    padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22,
  },
  urlInput: {
    height: 50, borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_400Regular",
  },
  charCount: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  chipsScroll: { flexGrow: 0 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, marginRight: 8,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  durationRow: { flexDirection: "row", gap: 8 },
  durationChip: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  hintText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  genGradient: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  genText: { color: "#fff", fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  creditNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
