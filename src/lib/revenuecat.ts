/**
 * RevenueCat wrapper — native IAP on iOS/Android via Capacitor.
 *
 * On web (browser preview, PWA), RevenueCat is a no-op and callers fall back
 * to the existing Paystack subscription flow. Only initialize on native.
 *
 * Configure in the Capacitor build with these env vars (Workspace Secrets):
 *   VITE_REVENUECAT_IOS_API_KEY      — Apple Public SDK key (appl_...)
 *   VITE_REVENUECAT_ANDROID_API_KEY  — Google Public SDK key (goog_...)
 *
 * Product/entitlement setup:
 *   In the RevenueCat dashboard, create one Entitlement per tier
 *   ("creator", "pro", "studio") and attach the store products
 *   ("aurora.creator.monthly", etc.). The four tiers mirror
 *   src/lib/subscription-plans.ts.
 */

let initialized = false;

function isNative(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

export async function initRevenueCat(appUserId?: string): Promise<void> {
  if (!isNative() || initialized) return;
  try {
    const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
    const platform = (window as unknown as { Capacitor?: { getPlatform?: () => string } })
      .Capacitor?.getPlatform?.();
    const apiKey =
      platform === "ios"
        ? (import.meta.env.VITE_REVENUECAT_IOS_API_KEY as string | undefined)
        : (import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as string | undefined);
    if (!apiKey) return;
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
    await Purchases.configure({ apiKey, appUserID: appUserId });
    initialized = true;
  } catch (err) {
    console.warn("[revenuecat] init failed", err);
  }
}

export async function getOfferings() {
  if (!isNative()) return null;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases.getOfferings();
}

export async function purchasePackage(packageIdentifier: string, offeringIdentifier?: string) {
  if (!isNative()) throw new Error("RevenueCat purchases are only available in the mobile app.");
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const offerings = await Purchases.getOfferings();
  const offering = offeringIdentifier
    ? offerings.all[offeringIdentifier]
    : offerings.current;
  const pkg = offering?.availablePackages.find((p) => p.identifier === packageIdentifier);
  if (!pkg) throw new Error(`Package ${packageIdentifier} not found`);
  return Purchases.purchasePackage({ aPackage: pkg });
}

export async function restorePurchases() {
  if (!isNative()) return null;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  return Purchases.restorePurchases();
}

export async function hasEntitlement(entitlementId: string): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const info = await Purchases.getCustomerInfo();
    return !!info.customerInfo.entitlements.active[entitlementId];
  } catch {
    return false;
  }
}

export async function identify(appUserId: string) {
  if (!isNative()) return;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.logIn({ appUserID: appUserId });
}

export async function logOut() {
  if (!isNative()) return;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  await Purchases.logOut();
}
