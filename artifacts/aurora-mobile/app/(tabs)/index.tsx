import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
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
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { generateContent, getUserProfile } from "@/lib/api";
import { StylePicker, PRESETS, StylePreset } from "@/components/StylePicker";

const CREDIT_COST = 2;

function GlowPulse({ color }: { color: string }) {
  const opacity = useSharedValue(0.4);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1200 }),
        withTiming(0.4, { duration: 1200 })
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

export default function StudioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPreset, setSelectedPreset] = useState<StylePreset>(PRESETS[0]);
  const [prompt, setPrompt] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 10_000,
  });

  const credits = profile?.credits_balance ?? 0;

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to pick a reference image.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]) {
      setPhoto(res.assets[0].uri);
    }
  };

  const handleGenerate = async () => {
    if (credits < CREDIT_COST) {
      Alert.alert(
        "Not enough credits",
        `You need ${CREDIT_COST} credits to generate. Top up in the Credits tab.`,
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

    try {
      const gen = await generateContent({
        kind: selectedPreset.kind,
        prompt: finalPrompt,
        referenceImageUrl: photo ?? undefined,
      });

      if (gen.output_url) {
        setResult(gen.output_url);
        queryClient.invalidateQueries({ queryKey: ["gallery"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setGenError("Generation completed but no output was returned. Try again.");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Generation failed";
      if (msg === "out_of_credits") {
        setGenError("You've run out of credits. Top up in the Credits tab.");
      } else {
        setGenError(msg);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = !generating && credits >= CREDIT_COST;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(168,85,247,0.12)", "transparent"]}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.titleRow}>
            <View>
              <Text style={[styles.title, { color: colors.foreground }]}>Studio</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Create AI-powered content
              </Text>
            </View>
            <View style={[styles.creditBadge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={[styles.creditText, { color: colors.foreground }]}>
                {credits}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Choose Style</Text>
          <StylePicker selectedId={selectedPreset.id} onSelect={setSelectedPreset} />

          <View style={styles.mainContent}>
            <Pressable
              onPress={pickPhoto}
              style={[
                styles.photoPicker,
                {
                  borderColor: photo ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  borderRadius: colors.radius,
                },
              ]}
            >
              {photo ? (
                <>
                  <Image source={{ uri: photo }} style={styles.photoPreview} contentFit="cover" />
                  <View style={styles.photoOverlay}>
                    <Feather name="camera" size={18} color="#fff" />
                    <Text style={styles.photoOverlayText}>Change photo</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <View style={[styles.photoIconWrap, { backgroundColor: colors.muted }]}>
                    <Feather name="user" size={28} color={colors.mutedForeground} />
                  </View>
                  <Text style={[styles.photoLabel, { color: colors.foreground }]}>
                    Add reference photo
                  </Text>
                  <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>
                    Optional — improves identity consistency
                  </Text>
                </View>
              )}
            </Pressable>

            <View style={[styles.promptWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.promptInput, { color: colors.foreground }]}
                placeholder={
                  selectedPreset.id === "custom"
                    ? "Describe what you want to create..."
                    : `Add extra details for your ${selectedPreset.label}...`
                }
                placeholderTextColor={colors.mutedForeground}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                maxLength={500}
                returnKeyType="done"
              />
              {prompt.length > 0 && (
                <Pressable onPress={() => setPrompt("")} style={styles.clearBtn}>
                  <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            </View>

            {genError ? (
              <Animated.View
                entering={FadeIn}
                style={[styles.errorBox, { backgroundColor: "rgba(232,64,64,0.1)", borderColor: "rgba(232,64,64,0.25)" }]}
              >
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{genError}</Text>
              </Animated.View>
            ) : null}

            <Pressable
              onPress={handleGenerate}
              disabled={!canGenerate}
              style={({ pressed }) => [
                styles.generateBtn,
                { borderRadius: colors.radius, opacity: !canGenerate ? 0.5 : pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.generateBtnInner, { borderRadius: colors.radius }]}
              >
                {generating ? (
                  <>
                    <GlowPulse color={colors.glow} />
                    <ActivityIndicator color={colors.primaryForeground} />
                    <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                      Generating...
                    </Text>
                  </>
                ) : (
                  <>
                    <Feather name="zap" size={18} color={colors.primaryForeground} />
                    <Text style={[styles.generateText, { color: colors.primaryForeground }]}>
                      Generate — {CREDIT_COST} credits
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={!!result}
        transparent
        animationType="slide"
        onRequestClose={() => setResult(null)}
      >
        <View style={styles.resultModal}>
          <View style={[styles.resultCard, { backgroundColor: colors.card }]}>
            <View style={styles.resultHeader}>
              <Text style={[styles.resultTitle, { color: colors.foreground }]}>
                Your creation is ready
              </Text>
              <Pressable onPress={() => setResult(null)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {result && (
              <Image
                source={{ uri: result }}
                style={[styles.resultImage, { borderRadius: colors.radius }]}
                contentFit="contain"
              />
            )}

            <Text style={[styles.resultHint, { color: colors.mutedForeground }]}>
              Find this in your Gallery tab
            </Text>
            <Pressable
              onPress={() => setResult(null)}
              style={[styles.doneBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 250, zIndex: 0 },
  scroll: { paddingHorizontal: 0, gap: 20, zIndex: 1 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
  },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  creditText: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 20, fontFamily: "Inter_600SemiBold" },
  mainContent: { paddingHorizontal: 20, gap: 14 },
  photoPicker: {
    height: 180,
    borderWidth: 1.5,
    borderStyle: "dashed",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreview: { width: "100%", height: "100%" },
  photoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  photoOverlayText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  photoPlaceholder: { alignItems: "center", gap: 8 },
  photoIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  photoLabel: { fontSize: 15, fontWeight: "600" },
  photoHint: { fontSize: 12 },
  promptWrap: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 80,
  },
  promptInput: { fontSize: 15, lineHeight: 22, fontFamily: "Inter_400Regular", flex: 1 },
  clearBtn: { alignSelf: "flex-end", padding: 4 },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  generateBtn: { overflow: "hidden" },
  generateBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 17,
    overflow: "hidden",
  },
  generateText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  resultModal: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "flex-end" },
  resultCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 },
  resultHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold" },
  resultImage: { width: "100%", height: 280 },
  resultHint: { fontSize: 13, textAlign: "center" },
  doneBtn: { paddingVertical: 14, alignItems: "center" },
  doneBtnText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
