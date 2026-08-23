import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useRef, useState } from "react";
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
import { GALLERY_SUCCESS_STATUSES } from "@/lib/gallery-mapping";
import { randomUploadId } from "@/lib/reference-image";
import {
  generateContent,
  generatePerformanceReskin,
  getGenerationStatus,
  getUserProfile,
  uploadReferenceImage,
  uploadReferenceVideo,
  IMAGE_COST,
  RESKIN_COST,
  RESKIN_PREVIEW_COST,
  VIDEO_COST_FROM,
  type MotionPreset,
} from "@/lib/api";

// ── Scene styles ─────────────────────────────────────────────────────────────
// Reskin mode: the scene text becomes the Performance Shot `location`.
// Photo mode: it drives the staging prompt.

interface SceneStyle {
  id: string;
  label: string;
  icon: string;
  scene: string;
}

const SCENES: SceneStyle[] = [
  {
    id: "studio",
    label: "Studio",
    icon: "aperture",
    scene:
      "a minimalist color studio performance set with a seamless vivid cyclorama backdrop, suspended vintage studio microphone, cinematic studio lighting",
  },
  {
    id: "street",
    label: "Street",
    icon: "map-pin",
    scene:
      "a golden-hour city street performance, warm sunlight, shallow depth of field, urban cinematic atmosphere",
  },
  {
    id: "stage",
    label: "Stage",
    icon: "music",
    scene:
      "a large concert stage mid-performance, dramatic beam lights and haze, crowd silhouettes in the background, energetic atmosphere",
  },
  {
    id: "minimal",
    label: "Minimal",
    icon: "square",
    scene:
      "a clean minimal white gallery space, soft even lighting, high-fashion editorial performance look",
  },
];

const MOTIONS: { id: MotionPreset; label: string; icon: string }[] = [
  { id: "push-in", label: "Push in", icon: "zoom-in" },
  { id: "orbit", label: "Orbit", icon: "rotate-cw" },
  { id: "pan-left", label: "Pan left", icon: "arrow-left" },
  { id: "pan-right", label: "Pan right", icon: "arrow-right" },
  { id: "handheld", label: "Handheld", icon: "move" },
  { id: "static", label: "Static", icon: "square" },
];

const DURATIONS = [5, 8] as const;

const SUCCESS_STATUSES: readonly string[] = GALLERY_SUCCESS_STATUSES;
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60_000;

function stagePrompt(scene: SceneStyle, extra: string): string {
  const detail = extra.trim() ? ` ${extra.trim()}.` : "";
  return `Place the subject into ${scene.scene}.${detail} Full-body performance stance, expressive pose. Preserve exact facial likeness, hair, skin tone, and outfit. 4K photoreal, cinematic.`;
}

function ResultVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView player={player} style={styles.resultVideo} contentFit="contain" nativeControls />
  );
}

type Mode = "reskin" | "photo";
type PhotoStep = "setup" | "staged";
type ResultSource = "reskin" | "video";

export default function PerformScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ── Shared state ──
  const [mode, setMode] = useState<Mode>("reskin");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const uploadedPhotoRef = useRef<string | null>(null);
  const [sceneId, setSceneId] = useState<string>("studio");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Reskin (clip) state ──
  const [clip, setClip] = useState<{
    uri: string;
    durationMs?: number | null;
    fileSize?: number | null;
  } | null>(null);
  const uploadedClipRef = useRef<string | null>(null);
  const [outfit, setOutfit] = useState("");
  const [reskinBusy, setReskinBusy] = useState(false);
  const [reskinStage, setReskinStage] = useState<"upload" | "render">("upload");
  const [reskinFinal, setReskinFinal] = useState(false);
  const [reskinElapsed, setReskinElapsed] = useState(0);
  const [reskinPreviewId, setReskinPreviewId] = useState<string | null>(null);
  const pollGenRef = useRef(0);

  // ── Photo-mode state ──
  const [photoStep, setPhotoStep] = useState<PhotoStep>("setup");
  const [stagedUrl, setStagedUrl] = useState<string | null>(null);
  const [staging, setStaging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animPhase, setAnimPhase] = useState<"preview" | "final">("preview");
  const [motion, setMotion] = useState<MotionPreset | null>("push-in");
  const [duration, setDuration] = useState<number>(5);
  const [previewId, setPreviewId] = useState<string | null>(null);

  // ── Result modal ──
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [resultSource, setResultSource] = useState<ResultSource>("video");

  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 10_000,
  });
  const credits = profile?.credits_balance ?? 0;

  // Cancel any in-flight poll on unmount.
  useEffect(() => {
    return () => {
      pollGenRef.current += 1;
    };
  }, []);

  const busy = staging || animating || reskinBusy;

  function friendly(e: unknown): string {
    const msg = e instanceof Error ? e.message : "Something went wrong";
    if (msg === "out_of_credits") return "Not enough Aura for this Performance Shot.";
    if (msg === "motion_offline")
      return "The Perform engine is offline right now. Try \"From a photo\" — it works instantly.";
    if (/no .*worker|no active worker|not available/i.test(msg))
      return "That engine is offline right now — try again in a few minutes.";
    return msg;
  }

  // ── Pickers ──

  const pickPhoto = async () => {
    if (busy) return;
    if (photo) {
      setPhoto(null);
      setPhotoB64(null);
      uploadedPhotoRef.current = null;
      setReskinPreviewId(null);
      setStagedUrl(null);
      setPhotoStep("setup");
      Haptics.selectionAsync();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to use Perform Anywhere.");
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
      uploadedPhotoRef.current = null;
      setReskinPreviewId(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickClip = async () => {
    if (busy) return;
    if (clip) {
      setClip(null);
      uploadedClipRef.current = null;
      setReskinPreviewId(null);
      Haptics.selectionAsync();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow media access to upload your performance clip.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "videos" });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (a.duration && a.duration > 31_000) {
        setError("Keep the performance clip under 30 seconds.");
        return;
      }
      if (a.fileSize && a.fileSize > 80 * 1024 * 1024) {
        setError("Clip too large — keep it under 30 seconds.");
        return;
      }
      setError(null);
      setClip({ uri: a.uri, durationMs: a.duration, fileSize: a.fileSize });
      uploadedClipRef.current = null;
      setReskinPreviewId(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // ── Reskin flow (hero): clip + photo → Performance Shot ──

  async function submitReskin(confirmId?: string) {
    if (!clip) {
      setError("Add your performance clip first — film yourself with your phone.");
      return;
    }
    if (!photo) {
      setError("Add a clear photo of you (your character).");
      return;
    }
    const myGen = ++pollGenRef.current;
    setReskinBusy(true);
    setReskinFinal(!!confirmId);
    setReskinStage("upload");
    setReskinElapsed(0);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!uploadedClipRef.current) {
        uploadedClipRef.current = await uploadReferenceVideo(clip.uri, clip.fileSize);
      }
      if (!uploadedPhotoRef.current) {
        uploadedPhotoRef.current = await uploadReferenceImage(photo, photoB64);
      }
      const res = await generatePerformanceReskin({
        performanceVideoUrl: uploadedClipRef.current,
        avatarImageUrl: uploadedPhotoRef.current,
        location: scene.scene,
        outfit: outfit.trim() || undefined,
        prompt: detail.trim() || undefined,
        confirmPreviewId: confirmId,
      });
      if (pollGenRef.current !== myGen) return;
      setReskinStage("render");
      queryClient.invalidateQueries({ queryKey: ["profile"] });

      const started = Date.now();
      while (Date.now() - started < POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        if (pollGenRef.current !== myGen) return;
        setReskinElapsed(Math.floor((Date.now() - started) / 1000));
        let status: { status: string; videoUrl: string | null };
        try {
          status = await getGenerationStatus(res.generationId);
        } catch {
          continue; // transient read error — keep polling
        }
        if (SUCCESS_STATUSES.includes(status.status)) {
          if (!status.videoUrl) {
            setError("Render finished but no video came back — check your Gallery.");
            return;
          }
          setResultUrl(status.videoUrl);
          setIsPreview(res.preview);
          setResultSource("reskin");
          if (res.preview) setReskinPreviewId(res.generationId);
          else setReskinPreviewId(null);
          queryClient.invalidateQueries({ queryKey: ["gallery"] });
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
        if (status.status === "failed" || status.status === "cancelled") {
          setError("Render failed — the reserved Aura was released. Try again.");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          return;
        }
      }
      setError("Still rendering — it will land in your Gallery when done.");
    } catch (e) {
      if (pollGenRef.current === myGen) {
        setError(friendly(e));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      if (pollGenRef.current === myGen) setReskinBusy(false);
    }
  }

  // ── Photo flow (fallback): stage a still, then animate ──

  async function stageScene() {
    // Fast double-tap guard against a second concurrent (separately
    // charged) generation before the button's disabled state re-renders.
    if (staging) return;
    if (!photo) {
      setError("Add a photo of yourself first.");
      return;
    }
    setStaging(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (!uploadedPhotoRef.current) {
        uploadedPhotoRef.current = await uploadReferenceImage(photo, photoB64);
      }
      const res = await generateContent({
        kind: "image",
        prompt: stagePrompt(scene, detail),
        imageUrls: [uploadedPhotoRef.current],
        idempotencyKey: randomUploadId(),
      });
      if (res.url) {
        setStagedUrl(res.url);
        setPhotoStep("staged");
        queryClient.invalidateQueries({ queryKey: ["gallery"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError("No image returned — try again.");
      }
    } catch (e) {
      setError(friendly(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setStaging(false);
    }
  }

  async function animate(confirmId?: string) {
    // Fast double-tap guard against a second concurrent (separately
    // charged) generation before the button's disabled state re-renders.
    if (animating) return;
    if (!stagedUrl) return;
    setAnimating(true);
    setError(null);
    setAnimPhase(confirmId ? "final" : "preview");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await generateContent({
        kind: "video",
        prompt:
          "The subject performs with natural expressive body movement, cinematic energy" +
          (detail.trim() ? `, ${detail.trim()}` : ""),
        imageUrls: [stagedUrl],
        duration,
        motion: motion ?? undefined,
        confirmPreviewId: confirmId,
        idempotencyKey: randomUploadId(),
      });
      if (res.url) {
        setResultUrl(res.url);
        setIsPreview(res.preview === true);
        setResultSource("video");
        setPreviewId(res.previewGenerationId ?? null);
        queryClient.invalidateQueries({ queryKey: ["gallery"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError("No video returned — try again.");
      }
    } catch (e) {
      setError(friendly(e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAnimating(false);
    }
  }

  // ── Result modal actions ──

  const closeResult = () => {
    setResultUrl(null);
    setIsPreview(false);
  };

  const renderFull = () => {
    if (resultSource === "reskin") {
      if (!reskinPreviewId) return;
      const ticket = reskinPreviewId;
      closeResult();
      submitReskin(ticket);
    } else {
      if (!previewId) return;
      const ticket = previewId;
      closeResult();
      animate(ticket);
    }
  };

  const confirmCostLabel =
    resultSource === "reskin" ? `Render full quality · ${RESKIN_COST} Aura` : "Render full quality";

  // ── UI ──

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(99,60,200,0.18)", "transparent"]}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Perform Anywhere</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Film on your phone — Aurora swaps the scene
              </Text>
            </View>
            <View
              style={[
                styles.creditBadge,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.creditText, { color: colors.foreground }]}>{credits}</Text>
            </View>
          </View>

          {/* Mode toggle */}
          <View
            style={[
              styles.modeRow,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            {(
              [
                { id: "reskin", label: "Reskin my clip", icon: "video" },
                { id: "photo", label: "From a photo", icon: "user" },
              ] as { id: Mode; label: string; icon: string }[]
            ).map((m) => {
              const active = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    if (!busy) {
                      setMode(m.id);
                      setError(null);
                      Haptics.selectionAsync();
                    }
                  }}
                  style={[
                    styles.modeBtn,
                    active && { backgroundColor: colors.primary, borderRadius: colors.radius - 2 },
                  ]}
                >
                  <Feather
                    name={m.icon as any}
                    size={13}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.modeText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Reskin mode ── */}
          {mode === "reskin" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Your performance clip
              </Text>
              <Pressable
                onPress={pickClip}
                disabled={busy}
                style={[
                  styles.photoSlot,
                  {
                    backgroundColor: colors.card,
                    borderColor: clip ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                {clip ? (
                  <View style={styles.clipFilled}>
                    <View style={[styles.clipIconWrap, { backgroundColor: colors.muted }]}>
                      <Feather name="film" size={22} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.clipTitle, { color: colors.foreground }]} numberOfLines={1}>
                        Performance clip attached
                      </Text>
                      <Text style={[styles.clipMeta, { color: colors.mutedForeground }]}>
                        {clip.durationMs ? `${Math.round(clip.durationMs / 1000)}s · ` : ""}tap to remove
                      </Text>
                    </View>
                    <Feather name="x" size={16} color={colors.mutedForeground} />
                  </View>
                ) : (
                  <View style={styles.photoEmpty}>
                    <Feather name="video" size={20} color={colors.mutedForeground} />
                    <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>
                      Film yourself performing (≤ 30s) — tap to attach
                    </Text>
                  </View>
                )}
              </Pressable>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Your character
              </Text>
              <Pressable
                onPress={pickPhoto}
                disabled={busy}
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
                    <Feather name="user" size={20} color={colors.mutedForeground} />
                    <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>
                      Clear photo of you — tap to attach
                    </Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          {/* ── Photo mode: identity photo ── */}
          {mode === "photo" && (
            <>
              <View style={styles.stepRow}>
                {(["Stage the scene", "Animate it"] as const).map((label, i) => {
                  const activeStep =
                    (i === 0 && photoStep === "setup") || (i === 1 && photoStep === "staged");
                  const doneStep = i === 0 && photoStep === "staged";
                  return (
                    <View
                      key={label}
                      style={[
                        styles.stepPill,
                        {
                          backgroundColor: activeStep
                            ? colors.primary
                            : doneStep
                              ? colors.muted
                              : colors.card,
                          borderColor: activeStep || doneStep ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {doneStep && <Feather name="check" size={11} color={colors.primary} />}
                      <Text
                        style={[
                          styles.stepText,
                          {
                            color: activeStep
                              ? colors.primaryForeground
                              : doneStep
                                ? colors.primary
                                : colors.mutedForeground,
                          },
                        ]}
                      >
                        {i + 1}. {label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Your photo</Text>
              <Pressable
                onPress={pickPhoto}
                disabled={busy}
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
                    <Feather name="user" size={20} color={colors.mutedForeground} />
                    <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>
                      Clear photo of you — tap to attach
                    </Text>
                  </View>
                )}
              </Pressable>
            </>
          )}

          {/* Scene style (shared) */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {mode === "reskin" ? "New scene" : "Scene"}
          </Text>
          <View style={styles.sceneGrid}>
            {SCENES.map((s) => {
              const active = sceneId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    setSceneId(s.id);
                    Haptics.selectionAsync();
                  }}
                  disabled={busy}
                  style={[
                    styles.sceneCard,
                    {
                      backgroundColor: active ? colors.primary : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Feather
                    name={s.icon as any}
                    size={18}
                    color={active ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.sceneLabel,
                      { color: active ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Outfit (reskin only) */}
          {mode === "reskin" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                New outfit (optional)
              </Text>
              <View
                style={[
                  styles.promptWrap,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    minHeight: 48,
                  },
                ]}
              >
                <TextInput
                  style={[styles.promptInput, { color: colors.foreground }]}
                  placeholder="e.g. black leather jacket, chrome chains"
                  placeholderTextColor={colors.mutedForeground}
                  value={outfit}
                  onChangeText={setOutfit}
                  maxLength={200}
                  editable={!busy}
                />
              </View>
            </>
          )}

          {/* Details (shared) */}
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Creative direction (optional)
          </Text>
          <View
            style={[
              styles.promptWrap,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <TextInput
              style={[styles.promptInput, { color: colors.foreground }]}
              placeholder={
                mode === "reskin"
                  ? "Music-video vibe — e.g. moody neon, slow-motion energy"
                  : "Outfit, mood, props — e.g. black leather jacket, hot pink backdrop"
              }
              placeholderTextColor={colors.mutedForeground}
              value={detail}
              onChangeText={setDetail}
              multiline
              maxLength={400}
              editable={!busy}
            />
          </View>

          {/* Photo mode: staged still + animate controls */}
          {mode === "photo" && stagedUrl && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                Staged scene
              </Text>
              <View
                style={[styles.stagedWrap, { borderColor: colors.primary, borderRadius: colors.radius }]}
              >
                <Image source={{ uri: stagedUrl }} style={styles.stagedImg} contentFit="cover" />
              </View>
            </>
          )}
          {mode === "photo" && photoStep === "staged" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Camera</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillRow}
              >
                {MOTIONS.map((m) => {
                  const active = motion === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => {
                        setMotion(active ? null : m.id);
                        Haptics.selectionAsync();
                      }}
                      disabled={busy}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: 20,
                        },
                      ]}
                    >
                      <Feather
                        name={m.icon as any}
                        size={13}
                        color={active ? colors.primaryForeground : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.pillText,
                          { color: active ? colors.primaryForeground : colors.foreground },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Duration</Text>
              <View style={styles.durationRow}>
                {DURATIONS.map((d) => {
                  const active = duration === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        setDuration(d);
                        Haptics.selectionAsync();
                      }}
                      disabled={busy}
                      style={[
                        styles.durationBtn,
                        {
                          backgroundColor: active ? colors.primary : colors.card,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: colors.radius,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          { color: active ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {d}s
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {error && (
            <Animated.View
              entering={FadeIn}
              exiting={FadeOut}
              style={[
                styles.errorBox,
                { backgroundColor: "rgba(232,64,64,0.1)", borderColor: "rgba(232,64,64,0.25)" },
              ]}
            >
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </Animated.View>
          )}

          {/* Primary action */}
          {mode === "reskin" ? (
            <Pressable
              onPress={() => submitReskin()}
              disabled={busy || !clip || !photo}
              style={({ pressed }) => [
                styles.generateBtn,
                {
                  borderRadius: colors.radius,
                  opacity: !clip || !photo || busy ? 0.5 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.generateInner, { borderRadius: colors.radius }]}
              >
                {reskinBusy ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Feather name="repeat" size={20} color={colors.primaryForeground} />
                )}
                <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                  {reskinBusy
                    ? reskinStage === "upload"
                      ? "Uploading your clip…"
                      : `${reskinFinal ? "Rendering full quality" : "Reskinning performance"}… ${
                          reskinElapsed > 0 ? `${reskinElapsed}s` : ""
                        }`
                    : `Preview Performance Shot · ${RESKIN_PREVIEW_COST} Aura`}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : photoStep === "setup" ? (
            <Pressable
              onPress={stageScene}
              disabled={busy || !photo}
              style={({ pressed }) => [
                styles.generateBtn,
                { borderRadius: colors.radius, opacity: !photo || busy ? 0.5 : pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.generateInner, { borderRadius: colors.radius }]}
              >
                {staging ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Feather name="aperture" size={20} color={colors.primaryForeground} />
                )}
                <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                  {staging ? "Staging your scene…" : `Stage my scene · ${IMAGE_COST} Aura`}
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable
                onPress={() => animate()}
                disabled={busy}
                style={({ pressed }) => [
                  styles.generateBtn,
                  { borderRadius: colors.radius, opacity: busy ? 0.5 : pressed ? 0.9 : 1 },
                ]}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDeep]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.generateInner, { borderRadius: colors.radius }]}
                >
                  {animating ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Feather name="play-circle" size={20} color={colors.primaryForeground} />
                  )}
                  <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                    {animating
                      ? animPhase === "final"
                        ? "Rendering full quality…"
                        : "Rendering preview…"
                      : "Animate — generate preview"}
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={stageScene}
                disabled={busy}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                {staging ? (
                  <ActivityIndicator color={colors.mutedForeground} size="small" />
                ) : (
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                )}
                <Text style={[styles.secondaryText, { color: colors.mutedForeground }]}>
                  Re-stage scene · {IMAGE_COST} Aura
                </Text>
              </Pressable>
            </View>
          )}

          <View
            style={[
              styles.noteBox,
              { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Feather name="info" size={14} color={colors.primary} />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              {mode === "reskin"
                ? `Film yourself performing, and Aurora swaps you into a new scene and outfit — your moves, your face, a whole new music video. Preview costs ${RESKIN_PREVIEW_COST} Aura; the full render is ${RESKIN_COST}. Results land in your Gallery.`
                : `Two steps: stage a still of you in the scene (${IMAGE_COST} Aura), then animate it. Animation starts with a fast preview — confirm to render full quality (from ${VIDEO_COST_FROM} Aura).`}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Result modal ── */}
      <Modal visible={!!resultUrl} transparent animationType="slide" onRequestClose={closeResult}>
        <View style={styles.resultOverlay}>
          <View
            style={[
              styles.resultCard,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 },
            ]}
          >
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                {isPreview ? "Preview ready" : "Your performance is ready ✦"}
              </Text>
              <Pressable onPress={closeResult} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {resultUrl && <ResultVideo uri={resultUrl} />}
            <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
              {isPreview
                ? "This is a fast capped preview. Render full quality?"
                : "Saved to your Gallery tab"}
            </Text>
            {isPreview && (resultSource === "reskin" ? reskinPreviewId : previewId) ? (
              <Pressable
                onPress={renderFull}
                style={[styles.doneBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
              >
                <Text style={styles.doneBtnText}>{confirmCostLabel}</Text>
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
  title: { fontSize: 26, fontWeight: "800", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  creditBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  creditText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  modeRow: { flexDirection: "row", borderWidth: 1, padding: 3, marginBottom: 4 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  modeText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  stepRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  stepPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  stepText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 12, marginBottom: 6, fontFamily: "Inter_600SemiBold" },
  photoSlot: { borderWidth: 1, overflow: "hidden", minHeight: 84 },
  photoPreview: { width: "100%", height: 120 },
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
  photoEmpty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 18 },
  photoEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 16 },
  clipFilled: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  clipIconWrap: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  clipTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  clipMeta: { fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  sceneGrid: { flexDirection: "row", gap: 8 },
  sceneCard: { flex: 1, alignItems: "center", gap: 6, paddingVertical: 14, borderWidth: 1 },
  sceneLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  promptWrap: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, minHeight: 72, marginTop: 4 },
  promptInput: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular" },
  stagedWrap: { borderWidth: 2, overflow: "hidden" },
  stagedImg: { width: "100%", height: 320 },
  pillRow: { gap: 8, paddingVertical: 4 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
  pillText: { fontSize: 13, fontWeight: "500", fontFamily: "Inter_500Medium" },
  durationRow: { flexDirection: "row", gap: 10 },
  durationBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  durationText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 8, borderWidth: 1, alignItems: "flex-start", marginTop: 8 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  generateBtn: { marginTop: 8, overflow: "hidden" },
  generateInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 17 },
  generateText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  secondaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderWidth: 1 },
  secondaryText: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
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
