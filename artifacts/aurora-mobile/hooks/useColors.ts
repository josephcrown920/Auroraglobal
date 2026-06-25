import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

/**
 * Returns the Aurora design tokens for the current color scheme.
 *
 * Aurora is a dark-only brand — both palettes resolve to the same
 * tokens, so the app looks identical regardless of the device's
 * appearance setting. The `radius` value is always included.
 */
export function useColors() {
  const scheme = useColorScheme();
  const palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
