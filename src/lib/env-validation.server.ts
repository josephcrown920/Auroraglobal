// Startup/runtime environment validation.
//
// Two tiers, deliberately different failure modes:
//   - REQUIRED_ENV: the app cannot serve anything sane without these (no DB
//     connection at all). Missing one is a fatal misconfiguration — fail
//     loudly and immediately rather than limping into confusing per-request
//     500s. This mirrors the project's "explicit failure, no silent
//     fallback" convention (see docs/DB_MIGRATIONS.md / SECURITY_AND_SECRETS.md).
//   - OPTIONAL_ENV_GROUPS: feature-scoped provider keys. The app is designed
//     to keep working with these missing (adapters self-report
//     `enabled: !!process.env.X` and orchestrator/LLM fallback chains simply
//     skip an unconfigured provider) — so a missing key here is a one-line
//     boot-time log, never a crash.
//
// Never logs a secret value, only variable names and boolean presence.
export const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
] as const;

export const OPTIONAL_ENV_GROUPS: Record<string, readonly string[]> = {
  "LLM fallback chain": [
    "LOVABLE_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "HF_TOKEN",
  ],
  "Media/video providers": [
    "FAL_KEY",
    "KLING_ACCESS_KEY",
    "REPLICATE_API_KEY",
    "PIAPI_API_KEY",
    "RUNWAY_API_KEY",
    "BYTEPLUS_API_KEY",
  ],
  "Self-hosted GPU workers": ["RUNPOD_API_KEY", "VASTAI_API_KEY", "AURORA_REGISTER_SECRET"],
  Payments: ["PAYSTACK_SECRET_KEY", "NOWPAYMENTS_API_KEY"],
  "Cron/internal": ["CRON_SECRET", "INTER_APP_API_KEY"],
  Observability: ["SENTRY_DSN", "AURORA_ALERT_EMAIL"],
};

export type EnvValidationResult = {
  missingRequired: string[];
  optionalStatus: Record<string, { configured: string[]; missing: string[] }>;
};

/** Pure check — never throws, never logs. Callers decide how to react. */
export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const missingRequired = REQUIRED_ENV.filter((key) => !env[key]);
  const optionalStatus: EnvValidationResult["optionalStatus"] = {};
  for (const [group, keys] of Object.entries(OPTIONAL_ENV_GROUPS)) {
    optionalStatus[group] = {
      configured: keys.filter((key) => !!env[key]),
      missing: keys.filter((key) => !env[key]),
    };
  }
  return { missingRequired, optionalStatus };
}

/**
 * Run once at process startup. Throws (fatal, fail-fast) if a required
 * variable is missing; logs a compact, value-free summary of optional
 * provider groups either way.
 */
export function validateEnvAtStartup(env: NodeJS.ProcessEnv = process.env): void {
  const { missingRequired, optionalStatus } = checkEnv(env);

  for (const [group, status] of Object.entries(optionalStatus)) {
    if (status.missing.length === 0) continue;
    if (status.configured.length === 0) {
      console.warn(`[env] ${group}: no keys configured (${status.missing.join(", ")}) — this feature group is fully disabled.`);
    } else {
      console.info(`[env] ${group}: ${status.configured.length}/${status.configured.length + status.missing.length} keys configured; missing ${status.missing.join(", ")}.`);
    }
  }

  if (missingRequired.length > 0) {
    const message = `Missing required environment variable(s): ${missingRequired.join(", ")}. The app cannot start without these.`;
    console.error(`[env] FATAL: ${message}`);
    throw new Error(message);
  }
}
