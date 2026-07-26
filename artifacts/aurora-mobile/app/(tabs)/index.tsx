import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGetDashboard, useGetMe } from '@workspace/api-client-react';
import { GenerationCard } from '@/components/GenerationCard';
import { CreditBadge } from '@/components/CreditBadge';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: dashboard, isLoading: dashLoading, refetch } = useGetDashboard();
  const { data: user } = useGetMe();
  const [refreshing, setRefreshing] = React.useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const quickActions = [
    {
      label: 'Colors Studio',
      icon: 'color-palette',
      tab: '/(tabs)/colors',
      gradient: ['#7C3AED', '#5B21B6'] as const,
    },
    {
      label: 'Video Agent',
      icon: 'film',
      tab: '/(tabs)/video',
      gradient: ['#D946EF', '#9D174D'] as const,
    },
    {
      label: 'Gallery',
      icon: 'grid',
      tab: '/(tabs)/gallery',
      gradient: ['#F59E0B', '#B45309'] as const,
    },
    {
      label: 'Buy Credits',
      icon: 'flash',
      tab: '/(tabs)/credits',
      gradient: ['#10B981', '#065F46'] as const,
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(124,58,237,0.25)', 'rgba(217,70,239,0.08)', 'transparent']}
        style={[styles.headerGradient, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              Good {getTimeOfDay()}
            </Text>
            <Text style={[styles.userName, { color: colors.foreground }]}>
              {user?.displayName ?? user?.email?.split('@')[0] ?? 'Artist'}
            </Text>
          </View>
          <CreditBadge onPress={() => router.push('/(tabs)/credits' as any)} />
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <StatPill
            colors={colors}
            label="Total"
            value={dashboard?.totalGenerations ?? 0}
            icon="images"
          />
          <StatPill
            colors={colors}
            label="This Month"
            value={dashboard?.thisMonthGenerations ?? 0}
            icon="calendar"
          />
          <StatPill
            colors={colors}
            label="Favorites"
            value={dashboard?.favoriteCount ?? 0}
            icon="heart"
          />
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Create</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (action.label === 'Buy Credits') {
                  router.push('/(tabs)/credits' as any);
                } else {
                  router.push(action.tab as any);
                }
              }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={action.gradient}
                style={[styles.actionGradient, { borderRadius: colors.radius }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={action.icon as any} size={26} color="#fff" />
                <Text style={styles.actionLabel}>{action.label}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      {(dashboard?.recentActivity?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gallery' as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.galleryRow}>
            {(dashboard?.recentActivity ?? []).slice(0, 4).map((item) => (
              <GenerationCard key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state */}
      {!dashLoading && (dashboard?.totalGenerations ?? 0) === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles" size={40} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Ready to create?</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Tap Colors Studio to generate your first AI performance photo.
          </Text>
          <TouchableOpacity
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tabs)/colors' as any)}
          >
            <Text style={styles.emptyBtnText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function StatPill({
  colors,
  label,
  value,
  icon,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <View style={[styles.statPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={14} color={colors.primary} />
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value.toLocaleString()}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: { gap: 2 },
  greeting: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  userName: { fontSize: 22, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statValue: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: (width - 50) / 2,
  },
  actionGradient: {
    padding: 20,
    gap: 10,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  galleryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});
