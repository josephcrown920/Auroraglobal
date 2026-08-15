import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
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
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  generateContent,
  getUserProfile,
  getGallery,
  uploadReferenceImage,
  Generation,
  IMAGE_COST,
} from "@/lib/api";
import { PRESETS, StylePreset } from "@/components/StylePicker";

const CREDIT_COST = IMAGE_COST;

// ─── Inspiration cards shown when gallery is sparse ───────────────────────────
const INSPIRATIONS = [
  {
    id: "i1",
    label: "Performance Shot",
    tag: "Studio",
    gradient: ["#2d1b69", "#5b21b6"] as [string, string],
    icon: "star",
    presetId: "performance",
    tall: true,
  },
  {
    id: "i2",
    label: "Music Video Still",
    tag: "Cinematic",
    gradient: ["#0f172a", "#1e1b4b"] as [string, string],
    icon: "music",
    presetId: "music-video",
    tall: false,
  },
  {
    id: "i3",
    label: "Colors Studio",
    tag: "Backdrop",
    gradient: ["#0c4a6e", "#0e7490"] as [string, string],
    icon: "droplet",
    presetId: "colors",
    tall: false,
  },
  {
    id: "i4",
    label: "TikTok UGC Ad",
    tag: "Viral",
    gradient: ["#431407", "#9a3412"] as [string, string],
    icon: "video",
    presetId: "ugc",
    tall: true,
  },
  {
    id: "i5",
    label: "Editorial Look",
    tag: "Fashion",
    gradient: ["#14532d", "#166534"] as [string, string],
    icon: "camera",
    presetId: "editorial",
    tall: false,
  },
  {
    id: "i6",
    label: "Custom Prompt",
    tag: "Freestyle",
    gradient: ["#1a1a2e", "#16213e"] as [string, string],
    icon: "edit-3",
    presetId: "custom",
    tall: true,
  },
];

// ─── Glow pulse animation ──────────────────────────────────────────────────────
function GlowPulse({ color }: { color: string }) {
  const opacity = useSharedValue(0.4);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 900 }),
        withTiming(0.4, { duration: 900 })
      ),
      -1
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { borderRadius: 14, backgroundColor: color }]}
      pointerEvents="none"
    />
  );
}

// ─── Gallery image card ────────────────────────────────────────────────────────
function GalleryCard({
  item,
  height,
  onTry,
}: {
  item: Generation;
  height: number;
  onTry: (prompt: string) => void;
}) {
  const colors = useColors();
  const [showTry, setShowTry] = useState(false);

  if (!item.output_url) return null;

  return (
    <Pressable
      onPress={() => setShowTry((v) => !v)}
      style={[styles.gridCard, { height, borderRadius: 12 }]}
    >
      <Image
        source={{ uri: item.output_url }}
        style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
        contentFit="cover"
        transition={300}
      />
      {showTry && item.prompt && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.tryOverlay}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTry(item.prompt!);
              setShowTry(false);
            }}
            style={[styles.tryBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="zap" size={11} color="#fff" />
            <Text style={styles.tryBtnText}>Try</Text>
          </Pressable>
        </Animated.View>
      )}
    </Pressable>
  );
}

// ─── Inspiration card ─────────────────────────────────────────────────────────
function InspirationCard({
  item,
  height,
  onTry,
}: {
  item: typeof INSPIRATIONS[0];
  height: number;
  onTry: (presetId: string) => void;
}) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTry(item.presetId);
      }}
      style={[styles.gridCard, { height, borderRadius: 12, overflow: "hidden" }]}
    >
      <LinearGradient
        colors={item.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />
      {/* Noise texture overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.18)" }]} />
      <View style={styles.inspoContent}>
        <View style={[styles.inspoIconWrap, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
          <Feather name={item.icon as any} size={20} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.inspoTag}>{item.tag}</Text>
        <Text style={styles.inspoLabel} numberOfLines={2}>{item.label}</Text>
        <View style={[styles.inspoTryChip, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Feather name="zap" size={10} color="rgba(255,255,255,0.85)" />
          <Text style={styles.inspoTryText}>Try this</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPreset, setSelectedPreset] = useState<StylePreset>(PRESETS[0]);
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");

  const inputRef = useRef<TextInput>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 10_000,
  });
  const { data: galleryData } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getGallery(30),
    staleTime: 15_000,
  });

  const credits = profile?.credits_balance ?? 0;
  const gallery: Generation[] = useMemo(
    () => (galleryData ?? []).filter((g) => !!g.output_url),
    [galleryData]
  );

  // Category filter
  const CATEGORIES = [
    { id: "all", label: "All" },
    { id: "performance", label: "Performance" },
    { id: "music-video", label: "Music Video" },
    { id: "colors", label: "Colors" },
    { id: "ugc", label: "UGC" },
    { id: "editorial", label: "Editorial" },
  ];

  // Build the grid items: gallery items + inspirations padded to at least 6 cards
  const gridItems = useMemo(() => {
    type GridItem =
      | { type: "gallery"; data: Generation; id: string }
      | { type: "inspiration"; data: typeof INSPIRATIONS[0]; id: string };

    const galleryItems: GridItem[] = gallery
      .filter((g) => {
        if (activeCategory === "all") return true;
        // Rough kind-match
        if (activeCategory === "ugc") return g.kind === "ugc";
        if (activeCategory === "music-video") return g.kind === "video" || g.kind === "image";
        return g.kind === "image";
      })
      .map((g) => ({ type: "gallery" as const, data: g, id: g.id }));

    const inspoItems: GridItem[] = INSPIRATIONS.filter(
      (i) => activeCategory === "all" || i.presetId === activeCategory
    ).map((i) => ({ type: "inspiration" as const, data: i, id: i.id }));

    // Interleave gallery + inspirations; show inspirations when gallery is sparse
    const combined: GridItem[] = [];
    let gi = 0;
    let ii = 0;
    const total = Math.max(galleryItems.length + inspoItems.length, 6);
    for (let k = 0; k < total; k++) {
      if (gi < galleryItems.length && (ii >= inspoItems.length || k % 3 !== 2)) {
        combined.push(galleryItems[gi++]);
      } else if (ii < inspoItems.length) {
        combined.push(inspoItems[ii++]);
      }
    }
    return combined;
  }, [gallery, activeCategory]);

  // Split into two columns
  const [leftCol, rightCol] = useMemo(() => {
    const left: typeof gridItems = [];
    const right: typeof gridItems = [];
    gridItems.forEach((item, i) => {
      if (i % 2 === 0) left.push(item);
      else right.push(item);
    });
    return [left, right];
  }, [gridItems]);

  // Staggered heights: a deterministic height per position
  const getHeight = (index: number, col: number): number => {
    const heights = col === 0
      ? [200, 150, 210, 160, 190, 145, 220, 155]
      : [155, 205, 145, 215, 150, 200, 160, 190];
    return heights[index % heights.length];
  };

  const pickPhoto = async () => {
    if (photo) {
      // Tap again to remove the attached reference.
      setPhoto(null);
      setPhotoB64(null);
      Haptics.selectionAsync();
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo access to attach a reference image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      setPhoto(res.assets[0].uri);
      setPhotoB64(res.assets[0].base64 ?? null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleGenerate = async () => {
    if (credits < CREDIT_COST) {
      Alert.alert(
        "Not enough Aura",
        `You need at least ${CREDIT_COST} Aura to generate.`,
        [{ text: "OK" }]
      );
      return;
    }

    const finalPrompt = selectedPreset.prompt
      ? `${selectedPreset.prompt}${prompt ? `. ${prompt}` : ""}`
      : prompt || "Professional portrait, high quality";

    setGenerating(true);
    setGenError(null);
    setResult(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    inputRef.current?.blur();

    try {
      // Local photo → signed studio-bucket URL the backend accepts.
      let imageUrls: string[] | undefined;
      if (photo) {
        const signedUrl = await uploadReferenceImage(photo, photoB64);
        imageUrls = [signedUrl];
      }

      const gen = await generateContent({
        kind: selectedPreset.kind,
        prompt: finalPrompt,
        imageUrls,
      });

      if (gen.url) {
        setResult(gen.url);
        queryClient.invalidateQueries({ queryKey: ["gallery"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setGenError("No output returned — try again.");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed";
      if (msg === "out_of_credits") {
        setGenError("Out of Aura for this generation.");
      } else {
        setGenError(msg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGenerating(false);
    }
  };

  const handleTryGallery = useCallback((tryPrompt: string) => {
    setPrompt(tryPrompt);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleTryInspiration = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) setSelectedPreset(preset);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const canGenerate = !generating && credits >= CREDIT_COST;
  const BOTTOM_BAR_HEIGHT = 120 + insets.bottom;
  const HEADER_HEIGHT = insets.top + 56;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Ambient glow */}
      <LinearGradient
        colors={["rgba(168,85,247,0.15)", "transparent"]}
        style={[styles.ambientGlow]}
        pointerEvents="none"
      />

      {/* ── Scrollable grid ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: HEADER_HEIGHT + 52, // header + category chips
          paddingBottom: BOTTOM_BAR_HEIGHT + 12,
          paddingHorizontal: 10,
          gap: 0,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Staggered two-column grid */}
        <View style={styles.grid}>
          {/* Left column */}
          <View style={[styles.gridCol, { marginRight: 5 }]}>
            {leftCol.map((item, i) => {
              const h = getHeight(i, 0);
              return (
                <Animated.View key={item.id} entering={FadeInUp.delay(i * 60).duration(400)} style={{ marginBottom: 8 }}>
                  {item.type === "gallery" ? (
                    <GalleryCard item={item.data} height={h} onTry={handleTryGallery} />
                  ) : (
                    <InspirationCard item={item.data} height={h} onTry={handleTryInspiration} />
                  )}
                </Animated.View>
              );
            })}
          </View>
          {/* Right column */}
          <View style={[styles.gridCol, { marginLeft: 5 }]}>
            {rightCol.map((item, i) => {
              const h = getHeight(i, 1);
              return (
                <Animated.View key={item.id} entering={FadeInUp.delay(i * 60 + 30).duration(400)} style={{ marginBottom: 8 }}>
                  {item.type === "gallery" ? (
                    <GalleryCard item={item.data} height={h} onTry={handleTryGallery} />
                  ) : (
                    <InspirationCard item={item.data} height={h} onTry={handleTryInspiration} />
                  )}
                </Animated.View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Sticky header (absolute) ── */}
      <View style={[styles.header, { paddingTop: insets.top, height: HEADER_HEIGHT }]} pointerEvents="box-none">
        {Platform.OS === "ios" ? (
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11,11,20,0.92)" }]} />
        )}
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>Aurora</Text>
          </View>
          <View style={[styles.creditBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="zap" size={12} color={colors.primary} />
            <Text style={[styles.creditText, { color: colors.foreground }]}>{credits}</Text>
            <Text style={[styles.creditUnit, { color: colors.mutedForeground }]}>Aura</Text>
          </View>
        </View>
      </View>

      {/* ── Category chips (absolute, below header) ── */}
      <View style={[styles.chips, { top: HEADER_HEIGHT }]} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 8 }}
        >
          {CATEGORIES.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <Pressable
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveCategory(cat.id);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Floating bottom composer ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "position" : undefined}
        keyboardVerticalOffset={0}
        style={styles.composerKAV}
        pointerEvents="box-none"
      >
        <View style={[styles.composerPanel, { paddingBottom: insets.bottom + 8 }]}>
          {Platform.OS === "ios" ? (
            <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(11,11,20,0.96)" }]} />
          )}
          <View style={[styles.composerBorder, { borderColor: colors.border }]} pointerEvents="none" />

          {/* Style chips row */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 8, paddingTop: 4 }}
          >
            {PRESETS.map((p) => {
              const active = p.id === selectedPreset.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPreset(p);
                  }}
                  style={[
                    styles.styleChip,
                    {
                      backgroundColor: active ? "rgba(168,85,247,0.2)" : "rgba(255,255,255,0.05)",
                      borderColor: active ? colors.primary : "rgba(255,255,255,0.08)",
                    },
                  ]}
                >
                  <Feather
                    name={p.icon as any}
                    size={11}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.styleChipText, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Input row */}
          <View style={styles.inputRow}>
            {/* Photo attach button */}
            <Pressable
              onPress={pickPhoto}
              style={[
                styles.attachBtn,
                {
                  backgroundColor: photo ? colors.primary : "rgba(255,255,255,0.07)",
                  borderColor: photo ? colors.primary : colors.border,
                },
              ]}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={styles.attachThumb} contentFit="cover" />
              ) : (
                <Feather name="image" size={18} color={colors.mutedForeground} />
              )}
            </Pressable>

            {/* Text input */}
            <View style={[styles.promptBox, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: colors.border }]}>
              <TextInput
                ref={inputRef}
                style={[styles.promptInput, { color: colors.foreground }]}
                placeholder={
                  selectedPreset.id === "custom"
                    ? "Describe your vision..."
                    : `Add details for ${selectedPreset.label}…`
                }
                placeholderTextColor={colors.mutedForeground}
                value={prompt}
                onChangeText={setPrompt}
                multiline={false}
                returnKeyType="done"
                onSubmitEditing={canGenerate ? handleGenerate : undefined}
              />
              {prompt.length > 0 && (
                <Pressable onPress={() => setPrompt("")} style={{ padding: 4 }}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {/* Generate button */}
            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={({ pressed }) => [
                styles.genBtn,
                { opacity: !canGenerate ? 0.5 : pressed ? 0.85 : 1 },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                style={styles.genBtnInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {generating ? (
                  <>
                    <GlowPulse color={colors.glow} />
                    <ActivityIndicator color="#fff" size="small" />
                  </>
                ) : (
                  <Feather name="zap" size={20} color="#fff" />
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Error message */}
          {genError && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.errorRow}>
              <Feather name="alert-circle" size={12} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{genError}</Text>
              <Pressable onPress={() => setGenError(null)}>
                <Feather name="x" size={12} color={colors.mutedForeground} />
              </Pressable>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ── Result modal ── */}
      <Modal
        visible={!!result}
        transparent
        animationType="slide"
        onRequestClose={() => setResult(null)}
      >
        <View style={styles.resultOverlay}>
          <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>Your creation is ready ✦</Text>
              <Pressable onPress={() => setResult(null)} hitSlop={12}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {result && (
              <Image
                source={{ uri: result }}
                style={[styles.resultImage, { borderRadius: 12 }]}
                contentFit="contain"
                transition={400}
              />
            )}
            <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
              Saved to your Gallery tab
            </Text>
            <Pressable
              onPress={() => setResult(null)}
              style={[styles.doneBtn, { backgroundColor: colors.primary, borderRadius: 14 }]}
            >
              <Text style={[styles.doneBtnText, { color: "#fff" }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 0,
    pointerEvents: "none",
  },

  // Grid
  grid: { flexDirection: "row", flex: 1 },
  gridCol: { flex: 1 },
  gridCard: { overflow: "hidden", backgroundColor: "#1a1a2e" },

  // Gallery card overlays
  tryOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  tryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // Inspiration card
  inspoContent: {
    flex: 1,
    padding: 12,
    justifyContent: "flex-start",
  },
  inspoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  inspoTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
    marginBottom: 4,
  },
  inspoLabel: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 8,
  },
  inspoTryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  inspoTryText: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600" },

  // Header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    overflow: "hidden",
  },
  headerContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoDot: { width: 8, height: 8, borderRadius: 4 },
  logoText: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  creditText: { fontSize: 14, fontWeight: "700" },
  creditUnit: { fontSize: 11, fontWeight: "500" },

  // Category chips
  chips: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 18,
    backgroundColor: "transparent",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },

  // Bottom composer
  composerKAV: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  composerPanel: {
    overflow: "hidden",
    paddingTop: 10,
  },
  composerBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  styleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  styleChipText: { fontSize: 11, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  attachThumb: { width: 44, height: 44 },
  promptBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    minHeight: 44,
  },
  promptInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  genBtn: { width: 44, height: 44, borderRadius: 22, overflow: "hidden" },
  genBtnInner: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 4,
  },
  errorText: { flex: 1, fontSize: 12, lineHeight: 16 },

  // Result modal
  resultOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
  },
  resultCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 14,
  },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontSize: 17, fontWeight: "700" },
  resultImage: { width: "100%", height: 300 },
  resultHint: { fontSize: 13, textAlign: "center" },
  doneBtn: { paddingVertical: 15, alignItems: "center" },
  doneBtnText: { fontSize: 16, fontWeight: "700" },
});
