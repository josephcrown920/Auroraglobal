import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

function getWebBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "https://auroraperformancestudio.com";
}

const CANVAS_FEATURES = [
  {
    icon: "layers",
    title: "Multi-layer compositing",
    desc: "Stack images, text, and effects on an infinite canvas",
  },
  {
    icon: "edit-2",
    title: "Non-destructive editing",
    desc: "Adjust every layer independently at any time",
  },
  {
    icon: "zap",
    title: "AI fill & erase",
    desc: "Remove backgrounds, fill regions, swap elements with AI",
  },
  {
    icon: "download",
    title: "Export at full resolution",
    desc: "PNG, JPG, or WebP — ready for print or social",
  },
];

export default function CanvasScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const openCanvas = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const base = getWebBase();
    await WebBrowser.openBrowserAsync(`${base}/canvas`);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["rgba(99,60,200,0.14)", "transparent"]}
        style={styles.gradientTop}
        pointerEvents="none"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Canvas</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Creative composition studio
            </Text>
          </View>
        </View>

        {/* Hero card */}
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          {/* Placeholder gradient preview */}
          <LinearGradient
            colors={[
              "rgba(168,85,247,0.22)",
              "rgba(99,60,200,0.18)",
              "rgba(30,30,51,0.9)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroPreview, { borderRadius: colors.radius - 2 }]}
          >
            {/* Mock canvas layers */}
            <View style={styles.mockCanvas}>
              <View style={[styles.mockLayer, styles.mockLayerA, { borderColor: "rgba(168,85,247,0.4)" }]} />
              <View style={[styles.mockLayer, styles.mockLayerB, { borderColor: "rgba(99,60,200,0.4)" }]} />
              <View style={[styles.mockLayer, styles.mockLayerC, { borderColor: "rgba(255,255,255,0.15)" }]} />
              <View style={[styles.mockCrosshair]}>
                <View style={[styles.mockCH, styles.mockCHH, { backgroundColor: "rgba(168,85,247,0.6)" }]} />
                <View style={[styles.mockCH, styles.mockCHV, { backgroundColor: "rgba(168,85,247,0.6)" }]} />
              </View>
            </View>

            <View style={styles.heroOverlay}>
              <View style={[styles.heroIcon, { backgroundColor: "rgba(168,85,247,0.2)", borderColor: "rgba(168,85,247,0.35)" }]}>
                <Feather name="layers" size={28} color="rgba(168,85,247,1)" />
              </View>
              <Text style={styles.heroLabel}>Aurora Canvas</Text>
              <Text style={styles.heroSub}>Full creative control — web-powered</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Features */}
        <View style={styles.featureList}>
          {CANVAS_FEATURES.map((f) => (
            <View
              key={f.icon}
              style={[
                styles.featureRow,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
              ]}
            >
              <View style={[styles.featureIcon, { backgroundColor: `${colors.primary}1a` }]}>
                <Feather name={f.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: colors.foreground }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        <Pressable
          onPress={openCanvas}
          style={({ pressed }) => [
            styles.cta,
            { borderRadius: colors.radius, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.ctaInner, { borderRadius: colors.radius }]}
          >
            <Feather name="external-link" size={18} color={colors.primaryForeground} />
            <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>
              Open Canvas in browser
            </Text>
          </LinearGradient>
        </Pressable>

        <Text style={[styles.ctaHint, { color: colors.mutedForeground }]}>
          Canvas requires the full Aurora web experience for the best creative tools.
          Mobile editing is coming soon.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gradientTop: { position: "absolute", top: 0, left: 0, right: 0, height: 260, zIndex: 0 },
  scroll: { paddingHorizontal: 20, gap: 16, zIndex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 28, fontWeight: "800", fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, marginTop: 2, fontFamily: "Inter_400Regular" },
  heroCard: { borderWidth: 1, overflow: "hidden" },
  heroPreview: { height: 200, justifyContent: "flex-end" },
  mockCanvas: { position: "absolute", inset: 0, padding: 20 },
  mockLayer: { position: "absolute", borderWidth: 1, borderStyle: "dashed" },
  mockLayerA: { top: 20, left: 30, width: 120, height: 80, transform: [{ rotate: "-3deg" }] },
  mockLayerB: { top: 50, left: 80, width: 100, height: 90, transform: [{ rotate: "2deg" }] },
  mockLayerC: { top: 30, right: 20, width: 90, height: 110, transform: [{ rotate: "5deg" }] },
  mockCrosshair: { position: "absolute", top: "50%", left: "50%", width: 20, height: 20, marginLeft: -10, marginTop: -10 },
  mockCH: { position: "absolute" },
  mockCHH: { width: 20, height: 1, top: 9, left: 0 },
  mockCHV: { width: 1, height: 20, top: 0, left: 9 },
  heroOverlay: { padding: 18, alignItems: "flex-start", gap: 6 },
  heroIcon: { width: 52, height: 52, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  heroLabel: { fontSize: 20, fontWeight: "800", color: "#fff", fontFamily: "Inter_700Bold" },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular" },
  featureList: { gap: 10 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderWidth: 1 },
  featureIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  featureTitle: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  featureDesc: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  cta: { overflow: "hidden" },
  ctaInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  ctaText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  ctaHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
});
