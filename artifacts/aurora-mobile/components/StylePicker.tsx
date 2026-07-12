import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface StylePreset {
  id: string;
  label: string;
  icon: string;
  prompt: string;
  kind: "image" | "video" | "ugc";
  description: string;
}

export const PRESETS: StylePreset[] = [
  {
    id: "performance",
    label: "Performance Shot",
    icon: "star",
    kind: "image",
    prompt: "Ultra-realistic performance shot, professional studio lighting, magazine quality",
    description: "Studio-quality portrait",
  },
  {
    id: "music-video",
    label: "Music Video",
    icon: "music",
    kind: "image",
    prompt: "Cinematic music video still, dramatic lighting, music artist style, editorial quality",
    description: "Cinematic editorial look",
  },
  {
    id: "colors",
    label: "Colors Studio",
    icon: "droplet",
    kind: "image",
    prompt: "Single-color cyclorama studio background, clean professional backdrop, beauty shot",
    description: "Color cyclorama backdrop",
  },
  {
    id: "ugc",
    label: "UGC Ad",
    icon: "video",
    kind: "ugc",
    prompt: "Authentic UGC-style content creator advertisement, natural lighting, candid feel",
    description: "TikTok-style content",
  },
  {
    id: "editorial",
    label: "Editorial",
    icon: "camera",
    kind: "image",
    prompt: "High fashion editorial photograph, Vogue magazine style, artistic composition",
    description: "High fashion editorial",
  },
  {
    id: "custom",
    label: "Custom",
    icon: "edit-3",
    kind: "image",
    prompt: "",
    description: "Your own prompt",
  },
];

interface Props {
  selectedId: string;
  onSelect: (preset: StylePreset) => void;
}

export function StylePicker({ selectedId, onSelect }: Props) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {PRESETS.map((preset) => {
        const isSelected = preset.id === selectedId;
        return (
          <Pressable
            key={preset.id}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(preset);
            }}
            style={[
              styles.card,
              {
                backgroundColor: isSelected ? colors.primary : colors.card,
                borderColor: isSelected ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name={preset.icon as any}
              size={20}
              color={isSelected ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.label,
                { color: isSelected ? colors.primaryForeground : colors.foreground },
              ]}
              numberOfLines={1}
            >
              {preset.label}
            </Text>
            <Text
              style={[
                styles.description,
                { color: isSelected ? "rgba(255,255,255,0.7)" : colors.mutedForeground },
              ]}
              numberOfLines={1}
            >
              {preset.description}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 10, paddingVertical: 4 },
  card: {
    width: 110,
    padding: 12,
    borderWidth: 1,
    gap: 6,
    alignItems: "center",
  },
  label: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  description: { fontSize: 10, textAlign: "center" },
});
