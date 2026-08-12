import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { Generation, getVideoSource } from "@/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_SIZE = (SCREEN_W - 48) / 2;

interface Props {
  generation: Generation;
}

/**
 * Detect a video result. The gallery mapper sets has_video from the row's
 * result_video_url (authoritative); the extension/kind checks cover items
 * loaded through older code paths.
 */
export function isVideoGeneration(gen: Generation): boolean {
  if (gen.has_video !== undefined) return gen.has_video;
  const url = gen.output_url ?? "";
  return /\.(mp4|webm|mov|m3u8)(\?|#|$)/i.test(url) || gen.kind === "video";
}

/**
 * Full-screen video player used inside the expanded modal. Streams through
 * the backend faststart proxy so iOS gets the moov atom up front — playing
 * the raw provider URL directly can render as a black frame on iOS.
 */
function ExpandedVideo({ generation }: { generation: Generation }) {
  const colors = useColors();
  const [source, setSource] = useState<{ uri: string; headers: Record<string, string> } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getVideoSource(generation.id)
      .then((s) => {
        if (alive) setSource(s);
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [generation.id]);

  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.play();
  });

  if (error) {
    return (
      <View style={styles.videoFallback}>
        <Feather name="video-off" size={32} color={colors.mutedForeground} />
        <Text style={[styles.videoFallbackText, { color: colors.mutedForeground }]}>
          Couldn't load this video
        </Text>
      </View>
    );
  }
  if (!source) {
    return (
      <View style={styles.videoFallback}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return (
    <VideoView
      player={player}
      style={styles.fullVideo}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
  );
}

export function GenerationCard({ generation }: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const insets = useSafeAreaInsets();

  const url = generation.output_url;
  if (!url) return null;

  const isVideo = isVideoGeneration(generation);
  // expo-image can't render an MP4 — video tiles use the still poster when
  // the row has one, otherwise a solid placeholder behind the play button.
  const thumbUri = isVideo ? generation.poster_url ?? null : url;

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
        {thumbUri ? (
          <Image
            source={{ uri: thumbUri }}
            style={[styles.thumbnail, { borderRadius: colors.radius }]}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <View
            style={[
              styles.thumbnail,
              styles.thumbnailPlaceholder,
              { borderRadius: colors.radius, backgroundColor: colors.muted },
            ]}
          >
            <Feather name="film" size={28} color={colors.mutedForeground} />
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: colors.muted }]}>
          <Text
            style={[styles.badgeText, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {generation.kind}
          </Text>
        </View>
        {isVideo && (
          <View style={styles.videoIconWrap}>
            <View style={styles.videoIconCircle}>
              <Feather name="play" size={20} color="#fff" />
            </View>
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
          {isVideo ? (
            // Mount the player only while the modal is open so audio stops on close.
            expanded && <ExpandedVideo generation={generation} />
          ) : (
            <Image source={{ uri: url }} style={styles.fullImage} contentFit="contain" />
          )}
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
  thumbnailPlaceholder: { alignItems: "center", justifyContent: "center" },
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
  videoIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  videoIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3, // optical centering of the play triangle
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
  fullVideo: { width: SCREEN_W, height: SCREEN_W * 1.5 },
  videoFallback: {
    width: SCREEN_W,
    height: SCREEN_W * 1.2,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  videoFallbackText: { fontSize: 14 },
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
