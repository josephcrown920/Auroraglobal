import { useEffect } from "react";
import { applyDesignSkin, fetchActiveSkinTokens, SKIN_CACHE_KEY, type SkinTokens } from "@/lib/design-skins";

/**
 * Applies the admin-selected design skin site-wide.
 *
 * Paints the last-known skin from localStorage immediately (no flash), then
 * revalidates against the backend. Renders nothing and never throws — when no
 * skin is active the shipped design system is used untouched.
 */
export function DesignSkinApplier() {
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SKIN_CACHE_KEY);
      if (cached) applyDesignSkin(JSON.parse(cached) as SkinTokens);
    } catch {
      // Corrupt/unavailable cache — ignore and wait for the fetch.
    }

    let cancelled = false;
    fetchActiveSkinTokens()
      .then((tokens) => {
        if (cancelled) return;
        applyDesignSkin(tokens);
        try {
          if (tokens) localStorage.setItem(SKIN_CACHE_KEY, JSON.stringify(tokens));
          else localStorage.removeItem(SKIN_CACHE_KEY);
        } catch {
          // Storage unavailable — non-fatal.
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
