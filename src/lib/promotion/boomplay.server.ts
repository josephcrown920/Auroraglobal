// Boomplay adapter — no public API. Link-only: keep the artist URL, grab
// best-effort Open Graph name + image from the public page, and always offer
// the one-tap Boomplay for Artists dashboard button.
import { fetchText } from "./http.server";
import { parseBoomplayInput } from "./parsers";
import type { PlatformResult } from "./types";

const HOSTS = ["boomplay.com", "www.boomplay.com", "boomplaymusic.com"] as const;

export function boomplayConfigured(): boolean {
  return true; // no API key exists for Boomplay public pages
}

function og(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+property=["']og:${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const swapped = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${property}["']`,
    "i",
  );
  return re.exec(html)?.[1] ?? swapped.exec(html)?.[1] ?? null;
}

export async function syncBoomplay(input: string): Promise<PlatformResult> {
  const parsed = parseBoomplayInput(input);
  if (!parsed || parsed.kind !== "url") {
    return {
      ok: false,
      reason: "invalid_input",
      message: "Paste your Boomplay artist page link (https://www.boomplay.com/artists/…).",
    };
  }
  let displayName: string | null = null;
  let imageUrl: string | null = null;
  try {
    const page = await fetchText(parsed.url, HOSTS, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AuroraPromotion/1.0)" },
    });
    if (page.ok) {
      displayName = og(page.text, "title")?.replace(/\s*[|-]\s*Boomplay.*$/i, "").trim() || null;
      imageUrl = og(page.text, "image");
    }
  } catch {
    // Best-effort only — the link still works without page metadata.
  }
  const idMatch = /\/artists\/(\d+)/.exec(parsed.url);
  return {
    ok: true,
    data: {
      externalId: idMatch?.[1] ?? null,
      profileUrl: parsed.url,
      displayName,
      imageUrl,
      metrics: {}, // Boomplay exposes no public stats
      items: [],
    },
  };
}
