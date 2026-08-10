/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#ffffff",
      "foreground": "#04050d",
      "card": "#f4f5f9",
      "cardForeground": "#04050d",
      "popover": "#f4f5f9",
      "popoverForeground": "#04050d",
      "primary": "#8228f6",
      "primaryForeground": "#fcfcfc",
      "secondary": "#e9ebf1",
      "secondaryForeground": "#080b14",
      "muted": "#edeef3",
      "mutedForeground": "#545864",
      "accent": "#e5e8ef",
      "accentForeground": "#080b14",
      "destructive": "#df000a",
      "destructiveForeground": "#fcfcfc",
      "border": "#e3e6ef",
      "input": "#e3e6ef",
      "ring": "#8228f6",
      "chart1": "#e55a00",
      "chart2": "#00786c",
      "chart3": "#004157",
      "chart4": "#d49000",
      "chart5": "#d57400",
      "sidebar": "#f4f5f9",
      "sidebarForeground": "#04050d",
      "sidebarBorder": "#dde0ec",
      "sidebarPrimary": "#8228f6",
      "sidebarPrimaryForeground": "#fcfcfc",
      "sidebarAccent": "#e5e8ef",
      "sidebarAccentForeground": "#080b14",
      "sidebarRing": "#8228f6"
    },
    "dark": {
      "background": "#07090e",
      "foreground": "#f8f8f8",
      "card": "#0c1020",
      "cardForeground": "#f8f8f8",
      "popover": "#0c1020",
      "popoverForeground": "#f8f8f8",
      "primary": "#9343ff",
      "primaryForeground": "#faf8f8",
      "secondary": "#0d1223",
      "secondaryForeground": "#f8f8f8",
      "muted": "#0a0d1c",
      "mutedForeground": "#828693",
      "accent": "#14162e",
      "accentForeground": "#f8f8f8",
      "destructive": "#e03131",
      "destructiveForeground": "#f8f8f8",
      "border": "#1c2036",
      "input": "#1e2438",
      "ring": "#9343ff",
      "chart1": "#e06a20",
      "chart2": "#1a9689",
      "chart3": "#104e64",
      "chart4": "#d4a800",
      "chart5": "#d07a00",
      "sidebar": "#050810",
      "sidebarForeground": "#f8f8f8",
      "sidebarBorder": "#171b2c",
      "sidebarPrimary": "#9343ff",
      "sidebarPrimaryForeground": "#faf8f8",
      "sidebarAccent": "#0d1223",
      "sidebarAccentForeground": "#f8f8f8",
      "sidebarRing": "#9343ff"
    }
  },
  "fontFamily": {
    "sans": [
      "Plus Jakarta Sans",
      "Inter",
      "sans-serif"
    ],
    "serif": [
      "Cormorant Garamond",
      "Georgia",
      "serif"
    ],
    "mono": [
      "JetBrains Mono",
      "Menlo",
      "monospace"
    ]
  },
  "radius": "0.625rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
