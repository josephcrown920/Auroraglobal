import { ActivityIndicator, View } from "react-native";
import colors from "@/constants/colors";

/**
 * Entry point — shows a branded loader.
 * The auth-gating hook in the root layout immediately redirects to
 * /(auth)/login or /(tabs) once the auth state resolves, so this
 * screen is only visible for a brief moment on cold start.
 */
export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.dark.background,
      }}
    >
      <ActivityIndicator color={colors.dark.primary} size="large" />
    </View>
  );
}
