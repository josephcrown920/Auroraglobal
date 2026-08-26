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

type RolesRead = {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, val: string) => Promise<{ data: Array<{ role: string }> | null; error: unknown }>;
    };
  };
};

async function isAdminUser(userId: string): Promise<boolean> {
  const db = supabaseAdmin as unknown as RolesRead;
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).some((r) => r.role === "admin");
}

/**
 * Server-side authority for a gateable feature. The `SoulShell`-style client
 * gates are UX only — anyone with a valid auth token can otherwise call a
 * feature's server functions directly and bypass a client-only check. Every
 * server function behind a hidden-by-default feature (see
 * GATEABLE_FEATURES.defaultHidden in feature-visibility.ts) must call this
 * before doing any work, same rollout gate as the UI: admins always pass;
 * everyone else is denied while the feature is hidden.
 * Fail-safe: an overrides-store outage falls back to the seeded defaults
 * (resolveHiddenKeys already does this), so an outage denies rather than
 * silently opening a gated, paid feature to everyone.
 */
export async function assertFeatureAccess(userId: string, key: FeatureKey): Promise<void> {
  if (await isAdminUser(userId)) return;
  const hidden = await getEffectiveHiddenKeys();
  if (hidden.includes(key)) {
    throw new Error("This feature isn't available for your account yet.");
  }
}
