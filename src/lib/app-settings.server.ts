// Global runtime app settings (server-only).
// Backed by the `app_settings` key/value table so the owner's choices survive
// restarts. The first setting is the "Free GPU only" safety mode.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const FREE_GPU_ONLY_KEY = "free_gpu_only";

// `app_settings` is not in the generated Supabase types yet — use the same
// untyped-accessor pattern the rest of the codebase uses for new tables.
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

function truthyEnv(v: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((v ?? "").trim());
}

/**
 * Default value for "Free GPU only" when no row has been persisted yet. Driven by
 * the `FREE_GPU_ONLY` environment flag so an operator can ship the safe default
 * without first touching the admin UI.
 */
export function freeGpuOnlyEnvDefault(): boolean {
  return truthyEnv(process.env.FREE_GPU_ONLY);
}

function coerceBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (/^(1|true|yes|on)$/i.test(value)) return true;
    if (/^(0|false|no|off)$/i.test(value)) return false;
  }
  return null;
}

/**
 * Is the global "Free GPU only" safety mode ON? Reads the persisted setting and
 * falls back to the `FREE_GPU_ONLY` env default when no row exists. Fail-safe: any
 * read error returns the env default rather than silently allowing paid spend.
 */
export async function isFreeGpuOnlyMode(): Promise<boolean> {
  try {
    const db = supabaseAdmin as unknown as SettingsRead;
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", FREE_GPU_ONLY_KEY)
      .maybeSingle();
    const stored = data ? coerceBool(data.value) : null;
    return stored ?? freeGpuOnlyEnvDefault();
  } catch {
    return freeGpuOnlyEnvDefault();
  }
}

/** Persist the "Free GPU only" mode. Admin-gated callers only. */
export async function setFreeGpuOnlyMode(enabled: boolean): Promise<void> {
  const db = supabaseAdmin as unknown as SettingsWrite;
  const { error } = await db
    .from("app_settings")
    .upsert(
      { key: FREE_GPU_ONLY_KEY, value: enabled, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}
