import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Generation } from "@/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_SIZE = (SCREEN_W - 48) / 2;

interface Props {
  generation: Generation;
}

export function GenerationCard({ generation }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  const url = generation.output_url;
  if (!url) return null;

  const isVideo =
    url.includes(".mp4") ||
    url.includes("video") ||
    generation.kind === "video";

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Share or Copy", "What would you like to do?", [
      { text: "Share", onPress: shareContent },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const shareContent = async () => {
    try {
      await Share.share({ message: url, url });
    } catch (e: any) {
      if (e?.message !== "User did not share") {
        Alert.alert("Error", "Could not share this file.");
      }
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setExpanded(true)}
        onLongPress={handleLongPress}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderRadius: colors.radius,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Image
          source={{ uri: url }}
          style={[styles.thumbnail, { borderRadius: colors.radius }]}
          contentFit="cover"
          transition={300}
        />
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text
            style={[styles.badgeText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {generation.kind}
          </Text>
        </View>
        {isVideo && (
          <View style={styles.videoIcon}>
            <Feather name="play-circle" size={24} color="#fff" />
          </View>
        )}
      </Pressable>

      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <View style={styles.modalBg}>
          <Pressable
            style={[styles.closeBtn, { top: insets.top + 12 }]}
            onPress={() => setExpanded(false)}
          >
            <Feather name="x" size={22} color="#fff" />
          </Pressable>
          <Image
            source={{ uri: url }}
            style={styles.fullImage}
            contentFit="contain"
          />
          <View
            style={[
              styles.modalActions,
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={shareContent}
            >
              <Feather name="share-2" size={18} color={colors.primaryForeground} />
              <Text style={[styles.actionText, { color: colors.primaryForeground }]}>
                Share
              </Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.card }]}
              onPress={() => setExpanded(false)}
            >
              <Feather name="x" size={18} color={colors.foreground} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 1,
  },
  thumbnail: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  videoIcon: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  fullImage: { width: SCREEN_W, height: SCREEN_W * 1.2 },
  modalActions: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  actionText: { fontSize: 15, fontWeight: "600" },
});
