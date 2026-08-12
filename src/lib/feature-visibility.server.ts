// Feature visibility persistence (server-only).
// Owner overrides live in the `app_settings` key/value table under one key,
// following the same pattern as the "Free GPU only" setting.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  parseOverrides,
  resolveHiddenKeys,
  type FeatureKey,
  type FeatureOverrides,
} from "@/lib/feature-visibility";

export const FEATURE_VISIBILITY_KEY = "feature_visibility";

// `app_settings` is not in the generated Supabase types yet — same
// untyped-accessor pattern as app-settings.server.ts.
type SettingsRead = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (
        col: string,
        val: string,
      ) => { maybeSingle: () => Promise<{ data: { value: unknown } | null; error: unknown }> };
    };
  };
};
type SettingsWrite = {
  from: (t: string) => {
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

/** Read persisted overrides. Fail-safe: any read error returns {} (seeded defaults apply). */
export async function getFeatureOverrides(): Promise<FeatureOverrides> {
  try {
    const db = supabaseAdmin as unknown as SettingsRead;
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", FEATURE_VISIBILITY_KEY)
      .maybeSingle();
    return parseOverrides(data?.value);
  } catch {
    return {};
  }
}

/** Effective hidden keys for regular users right now (fail-safe to defaults). */
export async function getEffectiveHiddenKeys(): Promise<FeatureKey[]> {
  return resolveHiddenKeys(await getFeatureOverrides());
}

async function writeOverrides(overrides: FeatureOverrides): Promise<void> {
  const db = supabaseAdmin as unknown as SettingsWrite;
  const { error } = await db
    .from("app_settings")
    .upsert(
      { key: FEATURE_VISIBILITY_KEY, value: overrides, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}

/** Set one feature's visibility override. Admin-gated callers only. */
export async function setFeatureVisibility(key: FeatureKey, visible: boolean): Promise<void> {
  const current = await getFeatureOverrides();
  await writeOverrides({ ...current, [key]: visible });
}

/** Reset every override back to the artist-only seeded defaults. Admin-gated callers only. */
export async function resetFeatureVisibility(): Promise<void> {
  await writeOverrides({});
}
