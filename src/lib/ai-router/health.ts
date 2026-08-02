// Aurora AI Intelligence Router — Provider Health Tracker
// Tracks a rolling 5-minute window of outcomes per provider.
// Process-scoped: resets on restart (intentional — stale health state is worse
// than a fresh start). Providers with poor recent success rates are skipped.

import { CATEGORY_CHAINS } from "./chains";
import type { RequestCategory } from "./categories";

type HealthEntry = { timestamp: number; latencyMs: number; success: boolean };

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MIN_CALLS_TO_FLAG = 3;      // need at least 3 data points before flagging unhealthy
const MIN_SUCCESS_RATE = 0.5;     // flag unhealthy below 50% success rate

// Process-global health window (Map<providerName, entries[]>)
const healthMap = new Map<string, HealthEntry[]>();

function pruned(entries: HealthEntry[]): HealthEntry[] {
  const cutoff = Date.now() - WINDOW_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

/** Record the outcome of a completed provider call. */
export function recordOutcome(provider: string, latencyMs: number, success: boolean): void {
  const existing = pruned(healthMap.get(provider) ?? []);
  existing.push({ timestamp: Date.now(), latencyMs, success });
  healthMap.set(provider, existing);
}

/** True when the provider is considered healthy enough to attempt. */
export function isHealthy(provider: string): boolean {
  const entries = pruned(healthMap.get(provider) ?? []);
  if (entries.length < MIN_CALLS_TO_FLAG) return true; // not enough data — assume healthy
  const successRate = entries.filter((e) => e.success).length / entries.length;
  return successRate >= MIN_SUCCESS_RATE;
}

/**
 * Count providers in a category that are currently healthy.
 *
 * Pass the enabled provider names when the caller needs the operational
 * count. Without that set this counts health only, which is useful for
 * diagnostics and tests.
 */
export function countHealthyForCategory(
  category: RequestCategory,
  enabledProviders?: ReadonlySet<string>,
): number {
  return (CATEGORY_CHAINS[category] ?? []).filter(
    (provider) =>
      (!enabledProviders || enabledProviders.has(provider)) &&
      isHealthy(provider),
  ).length;
}

/** Return the categories that currently have no enabled, healthy provider. */
export function getDegradedCategories(
  categories: readonly RequestCategory[],
  enabledProviders: ReadonlySet<string>,
): RequestCategory[] {
  return categories.filter(
    (category) => countHealthyForCategory(category, enabledProviders) === 0,
  );
}

export type ProviderHealthStatus = {
  name: string;
  displayName?: string;
  enabled: boolean;
  healthy: boolean;
  callsInWindow: number;
  successRate: number | null;   // null when no data
  avgLatencyMs: number | null;  // null when no data
};

/** Return a snapshot of all tracked providers' health for the admin panel. */
export function getHealthSnapshot(
  allProviders: Array<{ name: string; displayName: string; enabled: boolean }>,
): ProviderHealthStatus[] {
  return allProviders.map((p) => {
    const entries = pruned(healthMap.get(p.name) ?? []);
    const calls = entries.length;
    const successRate =
      calls === 0 ? null : entries.filter((e) => e.success).length / calls;
    const avgLatencyMs =
      calls === 0 ? null : entries.reduce((s, e) => s + e.latencyMs, 0) / calls;
    return {
      name: p.name,
      displayName: p.displayName,
      enabled: p.enabled,
      healthy: isHealthy(p.name),
      callsInWindow: calls,
      successRate,
      avgLatencyMs,
    };
  });
}

/** Reset all health data (used in tests). */
export function resetHealthMap(): void {
  healthMap.clear();
}
