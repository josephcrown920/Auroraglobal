import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { deleteAccount, getUserProfile } from "@/lib/api";

const APP_VERSION = "1.0.0";

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "https://auroraperformancestudio.com";
}

interface SettingRowProps {
  icon: string;
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  value?: string;
  chevron?: boolean;
}

function SettingRow({ icon, label, onPress, destructive, value, chevron = true }: SettingRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: destructive ? "rgba(232,64,64,0.12)" : colors.muted }]}>
        <Feather
          name={icon as any}
          size={16}
          color={destructive ? colors.destructive : colors.primary}
        />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: destructive ? colors.destructive : colors.foreground },
        ]}
      >
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {value && <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>}
      {chevron && <Feather name="chevron-right" size={16} color={colors.mutedForeground} />}
    </Pressable>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Ref guard: state updates lag Alert callbacks, so a queued second Alert
  // could otherwise start a concurrent deletion request.
  const deletingRef = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getUserProfile,
    staleTime: 30_000,
  });

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const email = user?.email ?? "";

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Could not sign out");
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const openWeb = async (path: string) => {
    const base = getApiBase();
    await WebBrowser.openBrowserAsync(`${base}${path}`);
  };

  // In-app account deletion — required by App Store 5.1.1(v) and Google
  // Play's account-deletion policy for any app with sign-up.
  const handleDeleteAccount = () => {
    if (deleting) return;
    Alert.alert(
      "Delete Account?",
      "This permanently deletes your account, remaining Aura, and all your creations. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            if (deletingRef.current) return;
            deletingRef.current = true;
            setDeleting(true);
            try {
              await deleteAccount();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await signOut();
            } catch (e: any) {
              Alert.alert(
                "Could not delete account",
                e?.message ?? "Please try again or contact support@auroraperformancestudio.com",
              );
            } finally {
              deletingRef.current = false;
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Account</Text>
        </View>

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.displayName, { color: colors.foreground }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.email, { color: colors.mutedForeground }]} numberOfLines={1}>
              {email}
            </Text>
          </View>
          <View style={[styles.creditPill, { backgroundColor: colors.muted }]}>
            <Feather name="zap" size={12} color={colors.primary} />
            <Text style={[styles.creditCount, { color: colors.primary }]}>
              {profile?.credits_balance ?? 0}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>General</Text>
          <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="globe"
              label="Open Web App"
              onPress={() => openWeb("/")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Legal</Text>
          <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="shield"
              label="Privacy Policy"
              onPress={() => openWeb("/privacy")}
            />
            <SettingRow
              icon="file-text"
              label="Terms of Service"
              onPress={() => openWeb("/terms")}
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="info"
              label="App Version"
              value={APP_VERSION}
              chevron={false}
              onPress={undefined}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              {
                backgroundColor: "rgba(232,64,64,0.1)",
                borderColor: "rgba(232,64,64,0.25)",
                borderRadius: colors.radius,
                opacity: pressed || signingOut ? 0.7 : 1,
              },
            ]}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.destructive} />
            ) : (
              <>
                <Feather name="log-out" size={18} color={colors.destructive} />
                <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={[styles.group, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <SettingRow
              icon="trash-2"
              label={deleting ? "Deleting Account…" : "Delete Account"}
              destructive
              chevron={false}
              onPress={handleDeleteAccount}
            />
          </View>
          <Text style={[styles.deleteHint, { color: colors.mutedForeground }]}>
            Permanently removes your account, remaining Aura, and all creations.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700", fontFamily: "Inter_700Bold" },
  displayName: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  email: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  creditPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  creditCount: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, fontFamily: "Inter_600SemiBold" },
  group: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 13, marginRight: 6, fontFamily: "Inter_400Regular" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 15,
    borderWidth: 1,
  },
  signOutText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  deleteHint: { fontSize: 12, marginTop: 8, paddingHorizontal: 4, fontFamily: "Inter_400Regular" },
});
