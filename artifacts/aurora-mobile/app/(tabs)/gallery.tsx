import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { GenerationCard } from "@/components/GenerationCard";
import { useColors } from "@/hooks/useColors";
import { getGallery, Generation } from "@/lib/api";

export default function GalleryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data, isLoading, refetch, isRefetching, error } = useQuery({
    queryKey: ["gallery"],
    queryFn: () => getGallery(60),
    staleTime: 15_000,
  });

  const generations: Generation[] = data ?? [];

  const renderItem = ({ item, index }: { item: Generation; index: number }) => (
    <GenerationCard generation={item} />
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
        <Feather name="image" size={32} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No generations yet</Text>
      <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
        Create your first piece in the Studio tab
      </Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Gallery</Text>
        {!isLoading && generations.length > 0 && (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {generations.length} {generations.length === 1 ? "piece" : "pieces"}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.empty}>
          <Feather name="alert-circle" size={32} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Could not load gallery</Text>
          <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
            {(error as Error).message}
          </Text>
        </View>
      ) : (
        <FlatList
          data={generations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + 90 },
            generations.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
          scrollEnabled={generations.length > 0}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  count: { fontSize: 14, fontFamily: "Inter_400Regular" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, gap: 8 },
  emptyContainer: { flex: 1 },
  row: { gap: 8, justifyContent: "space-between" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", fontFamily: "Inter_700Bold" },
  emptyHint: { fontSize: 14, textAlign: "center", lineHeight: 20, fontFamily: "Inter_400Regular" },
});
