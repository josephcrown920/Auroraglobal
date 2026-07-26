import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import {
  useGetGallery,
  useToggleFavorite,
  type GalleryItem,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { GenerationCard } from '@/components/GenerationCard';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const FILTERS = [
  { key: 'all', label: 'All', icon: 'grid' },
  { key: 'photo', label: 'Photos', icon: 'image' },
  { key: 'video', label: 'Videos', icon: 'film' },
  { key: 'lipsync', label: 'Lip Sync', icon: 'mic' },
  { key: 'music_video', label: 'Music', icon: 'musical-notes' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export default function GalleryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const queryClient = useQueryClient();

  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [refreshing, setRefreshing] = useState(false);

  const galleryParams =
    activeFilter === 'all'
      ? { limit: 50 }
      : activeFilter === 'favorites'
      ? { favorited: true, limit: 50 }
      : { type: activeFilter as any, limit: 50 };

  const { data: galleryData, isLoading, refetch } = useGetGallery(galleryParams);

  const favoriteMutation = useToggleFavorite();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleFavoriteToggle = useCallback(
    async (id: string, favorited: boolean) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      favoriteMutation.mutate(
        { id, data: { favorited } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
          },
        }
      );
    },
    [favoriteMutation, queryClient]
  );

  const items = galleryData?.items ?? [];

  const renderItem = useCallback(
    ({ item, index }: { item: GalleryItem; index: number }) => (
      <View style={index % 2 === 0 ? styles.leftCol : styles.rightCol}>
        <GenerationCard item={item} onFavoriteToggle={handleFavoriteToggle} />
      </View>
    ),
    [handleFavoriteToggle]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(245,158,11,0.15)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Gallery</Text>
        <Text style={[styles.headerCount, { color: colors.mutedForeground }]}>
          {galleryData?.total ?? 0} items
        </Text>

        {/* Filter row */}
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => {
            const active = f.key === activeFilter;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  setActiveFilter(f.key);
                  Haptics.selectionAsync();
                }}
              >
                <Ionicons
                  name={f.icon as any}
                  size={13}
                  color={active ? '#fff' : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? '#fff' : colors.mutedForeground },
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </LinearGradient>

      {/* Gallery grid */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing here yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {activeFilter === 'favorites'
              ? 'Heart items in your gallery to save favorites.'
              : 'Generate your first creation in Colors Studio or Video Agent.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: Platform.OS === 'web' ? 34 + 50 : insets.bottom + 80 },
          ]}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          scrollEnabled={!!items.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  headerCount: { fontSize: 14, fontFamily: 'Inter_400Regular', marginTop: 2, marginBottom: 12 },
  filterList: { paddingRight: 20, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  grid: { paddingHorizontal: 12, paddingTop: 12 },
  columnWrapper: { gap: 12, marginBottom: 0 },
  leftCol: { flex: 1 },
  rightCol: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
});
