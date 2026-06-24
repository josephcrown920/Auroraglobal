/**
 * Aurora design tokens — mirrored from the web app's styles.css (:root dark theme).
 * The web palette is authored in oklch; these are the precise sRGB hex equivalents
 * so the mobile app shares the exact same visual identity.
 *
 * Aurora is a dark-only brand, so `light` and `dark` resolve to the same palette
 * (the app should look identical regardless of the device appearance setting).
 */

const palette = {
  // Legacy aliases
  text: "#faf9fd",
  tint: "#b981ff",

  // Core surfaces
  background: "#070416",
  foreground: "#faf9fd",

  // Cards / elevated surfaces
  card: "#120d26",
  cardForeground: "#faf9fd",

  // Primary action color
  primary: "#b981ff",
  primaryForeground: "#070416",
  primaryGlow: "#d296ff",
  primaryDeep: "#3f0082",

  // Secondary surfaces
  secondary: "#1f1939",
  secondaryForeground: "#faf9fd",

  // Muted / subdued
  muted: "#1b1630",
  mutedForeground: "#a6a0bc",

  // Accent
  accent: "#38185f",
  accentForeground: "#faf9fd",

  // Destructive
  destructive: "#ff3131",
  destructiveForeground: "#faf9fd",

  // Borders & inputs (subtle white overlays, matching oklch(1 0 0 / 10-12%))
  border: "rgba(255,255,255,0.10)",
  input: "rgba(255,255,255,0.12)",

  // Brand gradients (purple -> pink), use with expo-linear-gradient
  gradientHero: ["#7933e0", "#d15fea"] as const,
  gradientStage: ["#af6eff", "#7933e0"] as const,
};

const colors = {
  light: palette,
  dark: palette,

  // Border radius (px) — mirrors web --radius (0.625rem = 10px)
  radius: 10,
};

export default colors;
