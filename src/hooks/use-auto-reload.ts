/**
 * useAutoReload — client-side auto-top-up preference manager.
 *
 * Stores the user's low-credit threshold and preferred pack in localStorage.
 * When credits drop at or below the threshold, the hook fires a one-time
 * toast prompt with a direct billing link (no stored-card charge; user
 * confirms each purchase).
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "aurora.auto_reload.v1";

export interface AutoReloadSettings {
  enabled: boolean;
  threshold: number;
  packId: string;
}

const DEFAULT_SETTINGS: AutoReloadSettings = {
  enabled: false,
  threshold: 5,
  packId: "starter",
};

export function getAutoReloadSettings(): AutoReloadSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AutoReloadSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAutoReloadSettings(s: AutoReloadSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* ignore */ }
}

/**
 * Mount this once in a top-level authenticated layout.
 * It fires a toast prompt (max once per session) when credits <= threshold.
 */
export function useAutoReloadPrompt(credits: number | null | undefined) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (credits == null || firedRef.current) return;
    const settings = getAutoReloadSettings();
    if (!settings.enabled) return;
    if (credits > settings.threshold) return;

    firedRef.current = true;
    toast.warning(
      credits <= 0
        ? "You're out of Aura — auto-top-up is on. Top up now to keep generating."
        : `Only ${credits} Aura left — auto-top-up threshold reached.`,
      {
        duration: 10_000,
        action: {
          label: "Top up →",
          onClick: () => {
            window.location.href = "/billing";
          },
        },
      },
    );
  }, [credits]);
}
