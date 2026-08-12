"use server";

import { createServerFn } from "@tanstack/react-start";
import {
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
  return async () => {
    const { hidden } = await getHiddenFeatureKeysForSeo();
    return { featureHidden: hidden.includes(feature) };
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