import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import {
  getCreditTransactions,
  getPublicPricing,
  getUserProfile,
  CreditTransaction,
} from "@/lib/api";

// Store-policy note: this screen intentionally has NO purchase button or
// payment link. Credits are consumed in-app only; purchasing lives on the
// web app and must never be linked from the mobile build (Play/App Store
// reject digital-goods purchases outside their billing systems).
export default function CreditsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => getUserProfile(),
    staleTime: 10_000,
  });

  const { data: txns, isLoading: txnsLoading, refetch: refetchTxns } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => getCreditTransactions(50),
    staleTime: 30_000,
  });

  const { data: pricing } = useQuery({
    queryKey: ["public-pricing"],
    queryFn: getPublicPricing,
    staleTime: 5 * 60 * 1000,
  });

  const credits = profile?.credits_balance ?? 0;

  const renderTxn = ({ item }: { item: CreditTransaction }) => {
    const isCredit = item.amount > 0;
    return (
      <View style={[styles.txnRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.txnIcon, { backgroundColor: isCredit ? "rgba(168,85,247,0.12)" : colors.muted }]}>
          <Feather
            name={isCredit ? "plus-circle" : "zap"}
            size={16}
            color={isCredit ? colors.primary : colors.mutedForeground}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.txnDesc, { color: colors.foreground }]} numberOfLines={1}>
            {item.description || (isCredit ? "Credits added" : "Generation")}
          </Text>
          <Text style={[styles.txnDate, { color: colors.mutedForeground }]}>
            {new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>
        <Text
          style={[
            styles.txnAmount,
            { color: isCredit ? colors.primary : colors.foreground },
          ]}
        >
          {isCredit ? "+" : ""}{item.amount}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <FlatList
        data={txns ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderTxn}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={profileLoading || txnsLoading}
            onRefresh={() => { refetchProfile(); refetchTxns(); }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        ListHeaderComponent={() => (
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <Text style={[styles.title, { color: colors.foreground }]}>Credits</Text>
            </View>

            <LinearGradient
              colors={[colors.card, colors.muted]}
              style={[styles.balanceCard, { borderColor: colors.border }]}
            >
              <View style={styles.balanceRow}>
                <View style={[styles.balanceIconWrap, { backgroundColor: colors.primary + "22" }]}>
                  <Feather name="zap" size={28} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                    Available credits
                  </Text>
                  {profileLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                      {credits}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>
                {pricing
                  ? `Images from ${pricing.imageFrom} Aura · videos from ${pricing.videoFrom} Aura`
                  : "Prices vary by model, duration, and resolution"}
              </Text>
            </LinearGradient>

            {(txns?.length ?? 0) > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>History</Text>
            )}
          </View>
        )}
        ListEmptyComponent={() =>
          !txnsLoading ? (
            <View style={styles.emptyTxns}>
              <Text style={[styles.emptyTxnsText, { color: colors.mutedForeground }]}>
                No transactions yet
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  balanceCard: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, padding: 20, marginBottom: 20, gap: 12 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  balanceIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  balanceLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  balanceValue: { fontSize: 40, fontWeight: "800", fontFamily: "Inter_700Bold" },
  balanceHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 18, fontWeight: "700", paddingHorizontal: 20, marginBottom: 14, fontFamily: "Inter_700Bold" },
  txnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txnIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txnDesc: { fontSize: 14, fontWeight: "500", fontFamily: "Inter_500Medium" },
  txnDate: { fontSize: 12, marginTop: 2, fontFamily: "Inter_400Regular" },
  txnAmount: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold" },
  emptyTxns: { paddingHorizontal: 20, paddingVertical: 8 },
  emptyTxnsText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
