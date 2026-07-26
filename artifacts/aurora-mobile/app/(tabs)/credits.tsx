import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import {
  useGetMe,
  useGetCreditPackages,
  useGetCreditTransactions,
  useCheckoutCredits,
} from '@workspace/api-client-react';

export default function CreditsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: user } = useGetMe();
  const { data: packages, isLoading: packagesLoading } = useGetCreditPackages();
  const { data: txHistory } = useGetCreditTransactions({ limit: 10 });

  const checkoutMutation = useCheckoutCredits();
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  const handleBuyCredits = useCallback(
    async (packageId: string) => {
      if (!user?.email) {
        Alert.alert('Error', 'Please complete your profile first.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCheckingOut(packageId);
      try {
        const result = await checkoutMutation.mutateAsync({
          data: { packageId, email: user.email },
        });
        if (result.authorizationUrl) {
          await WebBrowser.openBrowserAsync(result.authorizationUrl);
        }
      } catch (err) {
        Alert.alert('Error', 'Could not start checkout. Please try again.');
      } finally {
        setCheckingOut(null);
      }
    },
    [user, checkoutMutation]
  );

  const transactions = txHistory?.transactions ?? [];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={['rgba(16,185,129,0.18)', 'transparent']}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Credits</Text>

        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.balanceLeft}>
            <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
              Current Balance
            </Text>
            <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
              {user?.credits?.toLocaleString() ?? '—'}
            </Text>
            <Text style={[styles.balanceSub, { color: colors.mutedForeground }]}>credits</Text>
          </View>
          <LinearGradient
            colors={['#7C3AED', '#D946EF']}
            style={styles.balanceIcon}
          >
            <Ionicons name="flash" size={26} color="#fff" />
          </LinearGradient>
        </View>
      </LinearGradient>

      {/* Packages */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Up Credits</Text>
        {packagesLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
        ) : (
          <View style={styles.packages}>
            {(packages ?? []).map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.packageCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: pkg.popular ? colors.primary : colors.border,
                    borderWidth: pkg.popular ? 2 : 1,
                  },
                ]}
                onPress={() => handleBuyCredits(pkg.id)}
                disabled={checkingOut === pkg.id}
                activeOpacity={0.85}
              >
                {pkg.popular && (
                  <View style={[styles.popularBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.popularText}>Popular</Text>
                  </View>
                )}
                <View style={styles.packageInfo}>
                  <View>
                    <Text style={[styles.packageName, { color: colors.foreground }]}>
                      {pkg.name}
                    </Text>
                    <View style={styles.creditRow}>
                      <Ionicons name="flash" size={14} color={colors.accent} />
                      <Text style={[styles.packageCredits, { color: colors.accent }]}>
                        {pkg.credits.toLocaleString()} credits
                      </Text>
                    </View>
                    {pkg.description ? (
                      <Text style={[styles.packageDesc, { color: colors.mutedForeground }]}>
                        {pkg.description}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.priceArea}>
                    <Text style={[styles.packagePrice, { color: colors.foreground }]}>
                      ₦{pkg.priceNgn.toLocaleString()}
                    </Text>
                    {checkingOut === pkg.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <View style={[styles.buyBtn, { backgroundColor: colors.primary }]}>
                        <Text style={styles.buyBtnText}>Buy</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Transaction history */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
          <View style={[styles.txList, { borderColor: colors.border }]}>
            {transactions.map((tx, idx) => (
              <View key={tx.id}>
                <View style={styles.txRow}>
                  <View
                    style={[
                      styles.txIcon,
                      {
                        backgroundColor:
                          tx.type === 'topup' || tx.type === 'bonus'
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(239,68,68,0.15)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        tx.type === 'topup'
                          ? 'arrow-down'
                          : tx.type === 'bonus'
                          ? 'gift'
                          : tx.type === 'refund'
                          ? 'return-up-back'
                          : 'arrow-up'
                      }
                      size={14}
                      color={
                        tx.type === 'topup' || tx.type === 'bonus' || tx.type === 'refund'
                          ? '#10B981'
                          : '#EF4444'
                      }
                    />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={[styles.txDesc, { color: colors.foreground }]}>
                      {tx.description}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color:
                          tx.amount > 0
                            ? '#10B981'
                            : colors.destructive,
                      },
                    ]}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {tx.amount}
                  </Text>
                </View>
                {idx < transactions.length - 1 && (
                  <View style={[styles.txDivider, { backgroundColor: colors.border }]} />
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, marginBottom: 16 },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  balanceLeft: { gap: 2 },
  balanceLabel: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  balanceAmount: { fontSize: 40, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  balanceSub: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  balanceIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  packages: { gap: 12 },
  packageCard: { borderRadius: 16, padding: 16, overflow: 'hidden' },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  packageInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  packageName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  creditRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  packageCredits: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  packageDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 4, maxWidth: 180 },
  priceArea: { alignItems: 'flex-end', gap: 8 },
  packagePrice: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  buyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  buyBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  txList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  txIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 2 },
  txDesc: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  txDate: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  txAmount: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  txDivider: { height: 1, marginHorizontal: 14 },
});
