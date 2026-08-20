import { Capacitor } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

export const isIOS = () => Capacitor.getPlatform() === "ios";

export const isAndroid = () => Capacitor.getPlatform() === "android";

export const isWeb = () => !Capacitor.isNativePlatform();

/** Returns the platform name: 'ios', 'android', or 'web'. */
export const platform = () => Capacitor.getPlatform();
