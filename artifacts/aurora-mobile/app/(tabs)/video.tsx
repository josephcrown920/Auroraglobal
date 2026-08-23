import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

import { useColors } from "@/hooks/useColors";
import {
  generateContent,
  getUserProfile,
  uploadReferenceImage,
  VIDEO_COST_FROM,
  type MotionPreset,
} from "@/lib/api";
import { randomUploadId } from "@/lib/reference-image";

const DURATIONS = [5, 8, 10] as const;

const MOTIONS: { id: MotionPreset; label: string; icon: string }[] = [
  { id: "push-in", label: "Push in", icon: "zoom-in" },
  { id: "orbit", label: "Orbit", icon: "rotate-cw" },
  { id: "pan-left", label: "Pan left", icon: "arrow-left" },
  { id: "pan-right", label: "Pan right", icon: "arrow-right" },
  { id: "handheld", label: "Handheld", icon: "move" },
  { id: "static", label: "Static", icon: "square" },
];

function ResultVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.resultVideo}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function VideoScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [duration, setDuration] = useState<number>(5);
  const [motion, setMotion] = useState<MotionPreset | null>("push-in");
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "preview" | "final">("idle");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 10_000,
  });
  const credits = profile?.credits_balance ?? 0;

  const pickPhoto = async () => {
    if (photo) {
      setPhoto(null);
      setPhotoB64(null);
      Haptics.selectionAsync();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to animate a photo.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.85,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setPhoto(res.assets[0].uri);
      setPhotoB64(res.assets[0].base64 ?? null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  async function runGeneration(confirmId?: string) {
    // Fast double-tap guard: a second tap landing before the button's
    // disabled state re-renders would otherwise fire a second concurrent
    // (and separately charged) generation.
    if (loading) return;
    if (!prompt.trim() && !photo) {
      setError("Describe your video or attach a photo to animate.");
      return;
    }
    setLoading(true);
    setError(null);
    setPhase(confirmId ? "final" : "preview");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let imageUrls: string[] | undefined;
      if (photo) {
        const signed = await uploadReferenceImage(photo, photoB64);
        imageUrls = [signed];
      }
      const res = await generateContent({
        kind: "video",
        prompt: prompt.trim() || "Cinematic shot, natural motion",
        imageUrls,
        duration,
        motion: motion ?? undefined,
        confirmPreviewId: confirmId,
        idempotencyKey: randomUploadId(),
      });
      if (res.url) {
        setResultUrl(res.url);
        setIsPreview(res.preview === true);
        setPreviewId(res.previewGenerationId ?? null);
        queryClient.invalidateQueries({ queryKey: ["gallery"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError("No video returned — try again.");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed";
      setError(
        msg === "out_of_credits"
          ? "Not enough Aura for this render."
          : msg,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  }

  const closeResult = () => {
    setResultUrl(null);
    setIsPreview(false);
  };

  const renderFull = () => {
    if (!previewId) return;
    closeResult();
    runGeneration(previewId);
  };

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
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Text or photo → AI video
              </Text>
            </View>
            <View style={[styles.creditBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.creditText, { color: colors.foreground }]}>{credits}</Text>
            </View>
          </View>

          {/* Photo to animate */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Photo (optional)
          </Text>
          <Pressable
            onPress={pickPhoto}
            style={[
              styles.photoSlot,
              {
                backgroundColor: colors.card,
                borderColor: photo ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {photo ? (
              <>
                <Image source={{ uri: photo }} style={styles.photoPreview} contentFit="cover" />
                <View style={styles.photoRemove}>
                  <Feather name="x" size={14} color="#fff" />
                  <Text style={styles.photoRemoveText}>Remove</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoEmpty}>
                <Feather name="image" size={20} color={colors.mutedForeground} />
                <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>
                  Animate a photo — tap to attach
                </Text>
              </View>
            )}
          </Pressable>

          {/* Camera motion */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Camera</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {MOTIONS.map((m) => {
              const active = motion === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    setMotion(active ? null : m.id);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Feather name={m.icon as any} size={13} color={active ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.pillText, { color: active ? colors.primaryForeground : colors.foreground }]}>{m.label}</Text>
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
                  <Text style={[styles.durationText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{d}s</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Prompt */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Scene</Text>
          <View style={[styles.promptWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <TextInput
              style={[styles.promptInput, { color: colors.foreground }]}
              placeholder="Describe the scene, mood, and action…"
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
            onPress={() => runGeneration()}
            disabled={loading || (!prompt.trim() && !photo)}
            style={({ pressed }) => [
              styles.generateBtn,
              { borderRadius: colors.radius, opacity: ((!prompt.trim() && !photo) || loading) ? 0.5 : pressed ? 0.9 : 1 },
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
                {loading
                  ? phase === "final"
                    ? "Rendering full quality…"
                    : "Rendering preview…"
                  : "Generate preview"}
              </Text>
            </LinearGradient>
          </Pressable>

          <View style={[styles.noteBox, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              You first get a fast low-cost preview. Like it? Confirm to render the
              full-quality clip (from {VIDEO_COST_FROM} Aura). Videos take a minute
              or two — keep the app open.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Result modal ── */}
      <Modal visible={!!resultUrl} transparent animationType="slide" onRequestClose={closeResult}>
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                {isPreview ? "Preview ready" : "Your video is ready ✦"}
              </Text>
              <Pressable onPress={closeResult} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {resultUrl && <ResultVideo uri={resultUrl} />}
            <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
              {isPreview
                ? "This is a fast 480p preview. Render full quality?"
                : "Saved to your Gallery tab"}
            </Text>
            {isPreview && previewId ? (
              <Pressable
                onPress={renderFull}
                style={[styles.doneBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
              >
                <Text style={styles.doneBtnText}>Render full quality</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={closeResult}
              style={[
                styles.doneBtn,
                isPreview
                  ? { backgroundColor: colors.muted, borderRadius: 14 }
                  : { backgroundColor: colors.primary, borderRadius: 14 },
              ]}
            >
              <Text style={[styles.doneBtnText, isPreview && { color: colors.foreground }]}>
                {isPreview ? "Keep preview" : "Done"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  photoSlot: { borderWidth: 1, overflow: "hidden", height: 120 },
  photoPreview: { width: "100%", height: "100%" },
  photoRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  photoRemoveText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  photoEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderWidth: 1, marginTop: 4 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  resultOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", justifyContent: "flex-end" },
  resultCard: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, gap: 14 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold" },
  resultVideo: { width: "100%", height: 320, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  resultHint: { fontSize: 13, textAlign: "center", fontFamily: "Inter_400Regular" },
  doneBtn: { paddingVertical: 15, alignItems: "center" },
  doneBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", fontFamily: "Inter_700Bold" },
});
