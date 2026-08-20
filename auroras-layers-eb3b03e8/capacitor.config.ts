import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.auroraperformancestudio.layers",
  appName: "Aurora Layers",
  webDir: "dist/client",
  bundledWebRuntime: false,

  // Native display / status bar
  backgroundColor: "#0b0614",
  ios: {
    contentInset: "always",
    allowsLinkPreview: false,
    scrollEnabled: false,
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined,
    },
  },

  // Uncomment to run the app from your published Lovable URL instead of
  // bundled assets. This keeps the mobile app in sync with the web app
  // without resubmitting to the stores.
  // server: {
  //   url: "https://your-published-url.lovable.app/embed",
  //   cleartext: false,
  //   allowNavigation: ["auroraperformancestudio.com", "*.lovable.app"],
  // },

  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0b0614",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0614",
    },
  },
};

export default config;
