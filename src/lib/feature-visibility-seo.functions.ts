"use server";

import { createServerFn } from "@tanstack/react-start";
import {
  defaultHiddenKeys,
  featureKeyForRoute,
  type FeatureKey,
} from "@/lib/feature-visibility";
import { getEffectiveHiddenKeys } from "@/lib/feature-visibility.server";

/**
 * Read the live feature state during SSR and client-side route navigation.
 * Keeping this behind a server function prevents server-only Supabase code
 * from entering the browser bundle while still giving route `head()` access
 * to the current override.
 */
const getHiddenFeatureKeysForSeo = createServerFn({ method: "GET" }).handler(
  async () => ({ hidden: await getEffectiveHiddenKeys() }),
);

export function featureVisibilityLoader(feature: FeatureKey) {
  return async (): Promise<{ featureHidden: boolean }> => {
    try {
      const { hidden } = await getHiddenFeatureKeysForSeo();
      return { featureHidden: hidden.includes(feature) };
    } catch (error) {
      // Fail-safe by contract (see feature-visibility.ts): a settings-store or
      // server-function outage must NEVER take the route down. Fall back to
      // the seeded artist-only defaults — the same baseline the server uses
      // when the store is unreachable, so gating semantics are preserved.
      console.warn(`[feature-visibility] loader falling back to defaults for "${feature}"`, error);
      return { featureHidden: defaultHiddenKeys().includes(feature) };
    }
  };
}

export function featureVisibilityLoaderForRoute(path: string) {
  const feature = featureKeyForRoute(path);
  return feature ? featureVisibilityLoader(feature) : undefined;
}

export function featureVisibilityRobotsMeta(
  loaderData: { featureHidden?: boolean } | undefined,
) {
  return {
    name: "robots",
    content: loaderData?.featureHidden ? "noindex, nofollow" : "index, follow",
  };
}