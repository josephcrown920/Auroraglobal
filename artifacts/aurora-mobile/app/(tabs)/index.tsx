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
import { Image } from 'expo-image';
import { useGetDashboard } from '@workspace/api-client-react';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const H_PAD = 20;
const RECENT_THUMB = (width - H_PAD * 2 - 8 * 2) / 3;

const TOOLS = [
  {
    id: '00', label: 'Perform Anywhere', sub: 'AI live performance engine',
    cost: 'FREE', badge: 'FLAGSHIP', tab: null, color: '#E8FF47',
    img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80&fit=crop',
  },
  {
    id: '01', label: 'Colors', sub: 'Performance photo generation',
    cost: '2 CR', badge: null, tab: '/(tabs)/colors', color: '#FF6BCD',
    img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&fit=crop',
  },
  {
    id: '02', label: 'TikTok30', sub: 'UGC campaign engine',
    cost: '6 CR', badge: null, tab: '/(tabs)/gallery', color: '#A78BFF',
    img: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80&fit=crop',
  },
  {
    id: '03', label: 'Video Agent', sub: 'AI video production assistant',
    cost: '10 CR', badge: null, tab: null, color: '#3CF0FF',
    img: 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=600&q=80&fit=crop',
  },
  {
    id: '04', label: "Director's Room", sub: 'Cinematic visual studio',
    cost: '12 CR', badge: 'SUITE', tab: null, color: '#FFB340',
    img: 'https://images.unsplash.com/photo-1598387993441-a364f854cde0?w=600&q=80&fit=crop',
  },
  {
    id: '05', label: 'GRWM', sub: 'Get Ready With Me',
    cost: '6 CR', badge: null, tab: null, color: '#FF8FAB',
    img: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80&fit=crop',
  },
  {
    id: '06', label: 'Motion Control', sub: 'Kinetic visual generation',
    cost: '10 CR', badge: 'FLAGSHIP', tab: '/(tabs)/video', color: '#FFFFFF',
    img: 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=600&q=80&fit=crop',
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E8FF47" />
      }
    >
      {/* ── Hero ── */}
      <View style={[styles.hero, { paddingTop: topPad + 28 }]}>
        <Text style={styles.heroLabel}>THE COMPLETE TOOLKIT</Text>
        <Text style={styles.heroTitle}>PERFORM.{'\n'}
          <Text style={styles.heroTitleOutline}>CREATE.</Text>
          {'\n'}RELEASE.
        </Text>
        <View style={styles.heroRule}>
          <View style={styles.heroLine} />
          <Text style={styles.heroSub}>{TOOLS.length} TOOLS · BUILT FOR ARTISTS</Text>
        </View>
      </View>

      {/* ── Tool strips ── */}
      <View style={styles.stripList}>
        {TOOLS.map(tool => <ToolStrip key={tool.id} tool={tool} />)}
      </View>

      {/* ── Recent Work ── */}
      {recentItems.length > 0 && (
        <View style={styles.recentSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>RECENT WORK</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/gallery' as any)}>
              <Text style={styles.viewAllLabel}>VIEW ALL →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.thumbGrid}>
            {recentItems.slice(0, 6).map(item => (
              <RecentThumb key={item.id} item={item} />
            ))}
          </View>
        </View>
      )}

      {!isLoading && recentItems.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No projects yet.</Text>
          <Text style={styles.emptyHint}>Pick a tool above to start creating.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ── Tool strip row ── */
function ToolStrip({ tool }: { tool: typeof TOOLS[0] }) {
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tool.tab) {
      router.push(tool.tab as any);
    }
    // Coming soon tools — no navigation yet
  }

  const isComingSoon = !tool.tab;

  return (
    <TouchableOpacity
      style={styles.strip}
      onPress={handlePress}
      activeOpacity={isComingSoon ? 0.95 : 0.82}
    >
      {/* Background image */}
      <Image
        source={{ uri: tool.img }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={300}
      />
      {/* Dim overlay */}
      <LinearGradient
        colors={['rgba(8,8,8,0.75)', 'rgba(8,8,8,0.55)']}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Left color accent */}
      <View style={[styles.stripAccent, { backgroundColor: tool.color }]} />

      {/* Content */}
      <View style={styles.stripContent}>
        {/* Number */}
        <Text style={[styles.stripNum, { color: tool.color }]}>{tool.id}</Text>

        {/* Name + badge */}
        <View style={styles.stripNameRow}>
          <Text style={styles.stripName}>{tool.label}</Text>
          {tool.badge && (
            <View style={[styles.badgePill, { borderColor: tool.color + '55' }]}>
              <Text style={[styles.badgeText, { color: tool.color }]}>{tool.badge}</Text>
            </View>
          )}
          {isComingSoon && (
            <View style={styles.comingSoonPill}>
              <Text style={styles.comingSoonText}>SOON</Text>
            </View>
          )}
        </View>

        <Text style={styles.stripSub}>{tool.sub}</Text>
      </View>

      {/* Right: cost + arrow */}
      <View style={styles.stripRight}>
        <View style={[styles.costBadge, { backgroundColor: tool.cost === 'FREE' ? tool.color + '22' : 'rgba(255,59,48,0.15)' }]}>
          <Text style={[styles.costText, { color: tool.cost === 'FREE' ? tool.color : '#FF3B30' }]}>{tool.cost}</Text>
        </View>
        <Text style={[styles.stripArrow, { color: isComingSoon ? '#333' : '#555' }]}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Recent thumbnail ── */
function RecentThumb({ item }: { item: Generation }) {
  const thumb = item.thumbnailUrl ?? item.outputUrl ?? null;
  return (
    <TouchableOpacity
      style={[styles.thumb, { width: RECENT_THUMB, height: RECENT_THUMB }]}
      onPress={() => router.push('/(tabs)/gallery' as any)}
      activeOpacity={0.85}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      ) : (
        <View style={styles.thumbPlaceholder} />
      )}
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={[StyleSheet.absoluteFill, { borderRadius: 3 }]} />
      <View style={styles.thumbMeta}>
        <Text style={styles.thumbType} numberOfLines={1}>{item.type.replace('_', ' ')}</Text>
      </View>
    </TouchableOpacity>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },

  /* Hero */
  hero: { paddingHorizontal: H_PAD, paddingBottom: 32 },
  heroLabel: {
    fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 3.5,
    textTransform: 'uppercase', color: '#333', marginBottom: 14,
  },
  heroTitle: {
    fontSize: 44, fontFamily: 'Inter_900Black', letterSpacing: -1.5,
    textTransform: 'uppercase', lineHeight: 40, color: '#FFFFFF',
  },
  heroTitleOutline: { color: 'transparent' }, // WebkitTextStroke not supported in RN, so we use a workaround
  heroRule: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  heroLine: { width: 28, height: 1, backgroundColor: '#282828' },
  heroSub: { fontSize: 9, fontFamily: 'Inter_400Regular', color: '#383838', letterSpacing: 1.5, textTransform: 'uppercase' },

  /* Tool strips */
  stripList: { borderTopWidth: 1, borderTopColor: '#161616' },
  strip: {
    flexDirection: 'row', alignItems: 'center', height: 80,
    borderBottomWidth: 1, borderBottomColor: '#161616',
    overflow: 'hidden', backgroundColor: '#080808',
  },
  stripAccent: { width: 2, height: '100%', opacity: 0.7 },
  stripContent: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  stripNum: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, marginBottom: 3 },
  stripNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  stripName: {
    fontSize: 17, fontFamily: 'Inter_900Black', letterSpacing: -0.4,
    textTransform: 'uppercase', color: '#FFFFFF',
  },
  badgePill: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5 },
  comingSoonPill: { backgroundColor: '#1a1a1a', borderRadius: 2, paddingHorizontal: 7, paddingVertical: 2 },
  comingSoonText: { fontSize: 8, fontFamily: 'Inter_700Bold', letterSpacing: 1.5, color: '#444' },
  stripSub: { fontSize: 10, fontFamily: 'Inter_400Regular', color: '#444', letterSpacing: 0.2 },
  stripRight: { paddingRight: 16, alignItems: 'flex-end', gap: 6 },
  costBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  costText: { fontSize: 10, fontFamily: 'Inter_700Bold', lineHeight: 12 },
  stripArrow: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  /* Recent work */
  recentSection: { paddingHorizontal: H_PAD, paddingTop: 40 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 3, textTransform: 'uppercase', color: '#333' },
  viewAllLabel: { fontSize: 9, fontFamily: 'Inter_700Bold', letterSpacing: 2, textTransform: 'uppercase', color: '#333' },
  thumbGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { borderRadius: 3, overflow: 'hidden', backgroundColor: '#111', justifyContent: 'flex-end' },
  thumbPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111' },
  thumbMeta: { padding: 6 },
  thumbType: { fontSize: 9, fontFamily: 'Inter_600SemiBold', color: 'rgba(255,255,255,0.5)', textTransform: 'capitalize', letterSpacing: 0.5 },

  /* Empty */
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 6, paddingHorizontal: H_PAD },
  emptyText: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.15)' },
  emptyHint: { fontSize: 11, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.08)', textAlign: 'center' },
});
