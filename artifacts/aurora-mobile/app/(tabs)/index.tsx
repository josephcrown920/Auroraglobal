import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { fetchGenerations, type GenerationRow } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_H = Platform.OS === "ios" ? 88 : 68;

function GenerationCard({ item }: { item: GenerationRow }) {
  const C = useColors();
  const imgUrl = item.result_image_url ?? null;
  const succeeded = item.status === "succeeded";
  return (
    <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={styles.cardImage} contentFit="cover" transition={300} />
      ) : (
        <View style={[styles.cardImage, { backgroundColor: C.secondary, alignItems: "center", justifyContent: "center" }]}>
          <Text style={{ fontSize: 28 }}>{succeeded ? "🎨" : "⏳"}</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        {!!item.prompt && (
          <Text style={[styles.cardPrompt, { color: C.foreground }]} numberOfLines={2}>
            {item.prompt}
          </Text>
        )}
        <View style={styles.cardMeta}>
          <View style={[styles.badge, { backgroundColor: C.accent }]}>
            <Text style={[styles.badgeText, { color: C.primaryGlow }]}>{item.kind}</Text>
          </View>
          {item.credits_cost != null && (
            <Text style={[styles.cardCost, { color: C.mutedForeground }]}>{item.credits_cost} cr</Text>
          )}
        </View>
      </View>
    </View>
  );
}

export default function GalleryScreen() {
  const C = useColors();
  const { signOut, user } = useAuth();
  const router = useRouter();

  const {
    data: generations = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ["generations", user?.id],
    queryFn: fetchGenerations,
    enabled: !!user,
  });

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
          <Text style={[styles.headerTitle, { color: C.foreground }]}>Aurora</Text>
          <Pressable
            onPress={signOut}
            style={({ pressed }) => [styles.signOutBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Text style={[styles.signOutText, { color: C.mutedForeground }]}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={[styles.statusText, { color: C.mutedForeground }]}>Loading gallery…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.statusText, { color: C.destructive }]}>
            {error instanceof Error ? error.message : "Failed to load"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.actionBtn, { backgroundColor: C.secondary }]}
          >
            <Text style={{ color: C.primary, fontFamily: "Inter_500Medium" }}>Try again</Text>
          </Pressable>
        </View>
      ) : generations.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 52 }}>🎨</Text>
          <Text style={[styles.emptyTitle, { color: C.foreground }]}>No creations yet</Text>
          <Text style={[styles.emptySubtitle, { color: C.mutedForeground }]}>
            Tap Create to generate your first image
          </Text>
          <Pressable
            onPress={() => router.push("/(tabs)/create")}
            style={[styles.actionBtn, { backgroundColor: C.primary }]}
          >
            <Text style={{ color: C.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
              Create now
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={generations}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, paddingBottom: TAB_BAR_H + 12 }}
          columnWrapperStyle={{ gap: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <GenerationCard item={item} />}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={C.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  headerLogo: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  headerLogoText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" },
  signOutBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  signOutText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  statusText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 },
  emptyTitle: { fontSize: 22, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginTop: 12 },
  emptySubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  actionBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  card: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  cardImage: { width: "100%", aspectRatio: 1 },
  cardBody: { padding: 10, gap: 6 },
  cardPrompt: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  cardMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase" },
  cardCost: { fontSize: 10, fontFamily: "Inter_400Regular" },
});
