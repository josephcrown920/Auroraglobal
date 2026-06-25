import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
import { generateImage } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_H = Platform.OS === "ios" ? 88 : 68;
const CHAR_LIMIT = 500;

export default function CreateScreen() {
  const C = useColors();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: generateImage,
    onSuccess: async (data) => {
      setResultUrl(data.url ?? null);
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

  function handleGenerate() {
    if (!prompt.trim()) {
      Alert.alert("Describe your image", "Please enter a prompt before generating.");
      return;
    }
    setResultUrl(null);
    mutation.mutate({ prompt: prompt.trim() });
  }

  const generating = mutation.isPending;

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
          contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_H + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Result or generating preview */}
          {resultUrl ? (
            <View style={[styles.previewCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <Image
                source={{ uri: resultUrl }}
                style={styles.previewImage}
                contentFit="cover"
                transition={400}
              />
              <View style={styles.previewFooter}>
                <Text style={[styles.previewLabel, { color: C.mutedForeground }]}>
                  ✨ Image ready — saved to your gallery
                </Text>
              </View>
            </View>
          ) : generating ? (
            <View
              style={[styles.previewCard, styles.generatingCard, { backgroundColor: C.card, borderColor: C.primary }]}
            >
              <ActivityIndicator color={C.primary} size="large" />
              <Text style={[styles.generatingText, { color: C.primary }]}>Creating your image…</Text>
              <Text style={[styles.generatingHint, { color: C.mutedForeground }]}>
                This usually takes 10–30 seconds
              </Text>
            </View>
          ) : null}

          {/* Prompt */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: C.foreground }]}>Describe your image</Text>
            <TextInput
              style={[
                styles.promptInput,
                {
                  backgroundColor: C.secondary,
                  color: C.foreground,
                  borderColor: generating ? C.primary : C.border,
                },
              ]}
              placeholder={"A vast purple nebula with glowing stars,\ncinematic lighting, 8K…"}
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

          {/* Generate button */}
          <Pressable
            style={({ pressed }) => [styles.genWrap, { opacity: pressed || generating ? 0.7 : 1 }]}
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
                <Text style={styles.genText}>✨  Generate Image</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={[styles.creditNote, { color: C.mutedForeground }]}>1 credit per image</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  headerLogo: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerLogoText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerTitle: { fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 20 },
  previewCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  previewImage: { width: "100%", aspectRatio: 1 },
  previewFooter: { padding: 12 },
  previewLabel: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  generatingCard: { aspectRatio: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  generatingText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  generatingHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  promptInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  charCount: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "right" },
  genWrap: {},
  genGradient: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  genText: { color: "#fff", fontSize: 17, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  creditNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
