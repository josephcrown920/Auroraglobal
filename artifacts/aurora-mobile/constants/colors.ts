/**
 * Aurora Mobile design tokens — derived from aurora-studio/src/index.css
 *
 * Primary identity: dark violet/magenta cinematic theme.
 * All values converted from the web app's HSL custom properties to hex.
 */

const colors = {
  light: {
    text: '#0a0a0a',
    tint: '#7C3AED',

    background: '#FAFAFA',
    foreground: '#0a0a0a',

    card: '#F0F0F5',
    cardForeground: '#0a0a0a',

    primary: '#7C3AED',
    primaryForeground: '#FFFFFF',

    secondary: '#D946EF',
    secondaryForeground: '#FFFFFF',

    muted: '#E8E8F0',
    mutedForeground: '#6B6E7A',

    accent: '#F59E0B',
    accentForeground: '#0a0a0a',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#D4D4E0',
    input: '#D4D4E0',
  },

  dark: {
    text: '#FAFAFA',
    tint: '#7C3AED',

    // hsl(240 10% 4%) — near-black deep navy
    background: '#080A10',
    foreground: '#FAFAFA',

    // hsl(240 10% 7%)
    card: '#0E1018',
    cardForeground: '#FAFAFA',

    // hsl(262 83% 58%) — deep violet
    primary: '#7C3AED',
    primaryForeground: '#FFFFFF',

    // hsl(292 91% 73%) — electric magenta
    secondary: '#D946EF',
    secondaryForeground: '#080A10',

    // hsl(240 10% 12%)
    muted: '#1A1C26',
    // hsl(240 5% 65%)
    mutedForeground: '#9CA0AF',

    // hsl(35 100% 55%) — amber
    accent: '#F59E0B',
    accentForeground: '#080A10',

    destructive: '#EF4444',
    destructiveForeground: '#FAFAFA',

    // hsl(240 10% 12%)
    border: '#1A1C26',
    input: '#1A1C26',
  },

  // --radius: 0.75rem → 12px
  radius: 12,
};

export default colors;
