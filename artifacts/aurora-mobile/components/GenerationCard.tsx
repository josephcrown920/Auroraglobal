import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { GalleryItem } from '@workspace/api-client-react';

const CARD_WIDTH = (Dimensions.get('window').width - 48) / 2;

const TYPE_ICONS: Record<string, string> = {
  photo: 'image',
  video: 'film',
  lipsync: 'mic',
  ugc: 'megaphone',
  music_video: 'musical-notes',
};

interface GenerationCardProps {
  item: GalleryItem;
  onFavoriteToggle?: (id: string, favorited: boolean) => void;
  onPress?: (item: GalleryItem) => void;
}

export function GenerationCard({ item, onFavoriteToggle, onPress }: GenerationCardProps) {
  const colors = useColors();
  const iconName = TYPE_ICONS[item.type] ?? 'image';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => onPress?.(item)}
      activeOpacity={0.85}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
        {item.thumbnailUrl || item.outputUrl ? (
          <Image
            source={{ uri: item.thumbnailUrl ?? item.outputUrl ?? '' }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : item.status === 'processing' || item.status === 'queued' ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.processingText, { color: colors.mutedForeground }]}>
              {item.status === 'queued' ? 'Queued…' : 'Processing…'}
            </Text>
          </View>
        ) : item.status === 'failed' ? (
          <View style={styles.processingOverlay}>
            <Ionicons name="alert-circle" size={24} color={colors.destructive} />
            <Text style={[styles.processingText, { color: colors.destructive }]}>Failed</Text>
          </View>
        ) : (
          <View style={styles.processingOverlay}>
            <Ionicons name={iconName as any} size={28} color={colors.mutedForeground} />
          </View>
        )}
        {/* Video/type badge */}
        <View style={[styles.typeBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
          <Ionicons name={iconName as any} size={10} color="#fff" />
        </View>
      </View>

      <View style={styles.info}>
        {item.prompt ? (
          <Text style={[styles.prompt, { color: colors.foreground }]} numberOfLines={2}>
            {item.prompt}
          </Text>
        ) : (
          <Text style={[styles.prompt, { color: colors.mutedForeground }]}>
            {item.type.replace('_', ' ')}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={[styles.credits, { color: colors.mutedForeground }]}>
            {item.creditsUsed} cr
          </Text>
          <TouchableOpacity
            onPress={() => onFavoriteToggle?.(item.id, !item.isFavorited)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={item.isFavorited ? 'heart' : 'heart-outline'}
              size={16}
              color={item.isFavorited ? colors.secondary : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  processingOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  typeBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    borderRadius: 4,
    padding: 3,
  },
  info: {
    padding: 10,
    gap: 6,
  },
  prompt: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  credits: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
