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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGetDashboard } from '@workspace/api-client-react';
import { CreditBadge } from '@/components/CreditBadge';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_GAP = 10;
const H_PAD = 20;
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2;
const RECENT_THUMB = (width - H_PAD * 2 - CARD_GAP * 2) / 3;

const BRAND_RED = '#FF3B30';

const tools = [
  {
    label: 'Colors',
    desc: 'High-fidelity performance photos',
    tab: '/(tabs)/colors',
    cost: 2,
    icon: 'color-palette' as const,
    image:
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80&fit=crop&crop=center',
  },
  {
    label: 'Motion',
    desc: 'Cinematic video snippets',
    tab: '/(tabs)/video',
    cost: 10,
    icon: 'film' as const,
    image:
      'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80&fit=crop&crop=center',
  },
  {
    label: 'Lip Sync',
    desc: 'AI audio-synced performance',
    tab: '/(tabs)/lipsync',
    cost: 8,
    icon: 'mic' as const,
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&fit=crop&crop=top',
  },
  {
    label: 'Music Video',
    desc: 'Full-length track production',
    tab: '/(tabs)/musicvideo',
    cost: 12,
    icon: 'musical-notes' as const,
    image:
      'https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=600&q=80&fit=crop&crop=center',
  },
  {
    label: 'TikTok30 UGC',
    desc: 'Campaign batch generation',
    tab: '/(tabs)/gallery',
    cost: 6,
    icon: 'phone-portrait' as const,
    image:
      'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80&fit=crop&crop=top',
  },
];

type Generation = {
  id: string;
  type: string;
  thumbnailUrl?: string | null;
  outputUrl?: string | null;
  createdAt: string;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { data: dashboard, isLoading, refetch } = useGetDashboard();
  const [refreshing, setRefreshing] = React.useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const recentItems = (dashboard?.recentActivity as Generation[] | undefined) ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BRAND_RED}
        />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 20 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.brandLabel}>Aurora Studio</Text>
            <Text style={styles.headline}>Create something{'\n'}new.</Text>
            <Text style={styles.subline}>Select a tool to begin your next project.</Text>
          </View>
          <CreditBadge onPress={() => router.push('/(tabs)/credits' as any)} />
        </View>
      </View>

      {/* Tool Cards grid */}
      <View style={styles.grid}>
        {tools.map((tool, idx) => {
          const isLastOdd = tools.length % 2 !== 0 && idx === tools.length - 1;
          return (
            <ToolCard
              key={tool.label}
              tool={tool}
              fullWidth={isLastOdd}
            />
          );
        })}
      </View>

      {/* Recent Projects */}
      {recentItems.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Recent Projects</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gallery' as any)}>
              <Text style={styles.viewAllLabel}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.thumbGrid}>
            {recentItems.slice(0, 6).map((item) => (
              <RecentThumb key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      {/* Empty state */}
      {!isLoading && recentItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No projects yet.</Text>
          <Text style={styles.emptyHint}>Pick a tool above to start creating.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ── Tool card ─────────────────────────────────────────────── */

function ToolCard({
  tool,
  fullWidth,
}: {
  tool: (typeof tools)[number];
  fullWidth: boolean;
}) {
  const cardWidth = fullWidth ? width - H_PAD * 2 : CARD_WIDTH;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(tool.tab as any);
  }

  return (
    <TouchableOpacity
      style={[styles.toolCard, { width: cardWidth }]}
      onPress={handlePress}
      activeOpacity={0.88}
    >
      {/* Full-bleed background photo */}
      <Image
        source={{ uri: tool.image }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />

      {/* Gradient overlay: opaque at bottom, transparent at top */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.78)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Bottom bar: icon + credit badge */}
      <View style={styles.toolCardBottom}>
        <View style={styles.toolIconWrap}>
          <Ionicons name={tool.icon} size={14} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={styles.costBadge}>
          <Text style={styles.costText}>{tool.cost} CR</Text>
        </View>
      </View>

      {/* Text block just above bottom bar */}
      <View style={styles.toolCardText}>
        <Text style={styles.toolLabel}>{tool.label}</Text>
        <Text style={styles.toolDesc} numberOfLines={1}>{tool.desc}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Recent thumbnail ──────────────────────────────────────── */

function RecentThumb({ item }: { item: Generation }) {
  const thumb = item.thumbnailUrl ?? item.outputUrl ?? null;

  return (
    <TouchableOpacity
      style={[styles.thumb, { width: RECENT_THUMB, height: RECENT_THUMB }]}
      onPress={() => router.push('/(tabs)/gallery' as any)}
      activeOpacity={0.85}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons name="image-outline" size={20} color="rgba(255,255,255,0.15)" />
        </View>
      )}
      {/* bottom gradient on hover — always present, subtle */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)']}
        style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
      />
      <View style={styles.thumbMeta}>
        <Text style={styles.thumbType} numberOfLines={1}>
          {item.type.replace('_', ' ')}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Styles ────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  /* Header */
  header: {
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  brandLabel: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: BRAND_RED,
  },
  headline: {
    fontSize: 30,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.38)',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  /* Tool grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
    marginBottom: 32,
  },
  toolCard: {
    height: CARD_WIDTH * 1.3, // ~4:5 aspect ratio feels right on mobile
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111111',
    justifyContent: 'flex-end',
  },
  toolCardText: {
    paddingHorizontal: 11,
    paddingBottom: 40,
    gap: 2,
  },
  toolLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  toolDesc: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 15,
  },
  toolCardBottom: {
    position: 'absolute',
    bottom: 10,
    left: 11,
    right: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  costBadge: {
    backgroundColor: BRAND_RED,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
  },
  costText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
  },

  /* Recent projects */
  recentSection: {
    paddingHorizontal: H_PAD,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.35)',
  },
  viewAllLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.28)',
  },
  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  thumb: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#111111',
    justifyContent: 'flex-end',
  },
  thumbPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMeta: {
    padding: 6,
  },
  thumbType: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'capitalize',
    letterSpacing: 0.5,
  },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 6,
    paddingHorizontal: H_PAD,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.18)',
  },
  emptyHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
  },
});
