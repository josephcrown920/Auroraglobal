/**
 * Cross-platform "share to social media" helpers.
 *
 * Reality check on what's actually possible from a website (no native app,
 * no platform API keys):
 *  - WhatsApp, Facebook, X all expose public web share intents (a URL you can
 *    open in a new tab that pre-fills a post/message). These work everywhere.
 *  - Instagram, TikTok, and Snapchat do NOT expose a public web intent for
 *    posting arbitrary external content — this is a deliberate platform
 *    restriction, not a bug we can route around. The only real path onto
 *    those three from a browser is the OS-level share sheet (Web Share API)
 *    on a phone where the app is installed, which lets the user pick it
 *    directly with the media attached. When that's unavailable (desktop, or
 *    unsupported browser) we fall back to downloading the asset so the user
 *    can attach it manually in the app — never a fake button that silently
 *    does nothing.
 */

export type SocialPlatform = "instagram" | "tiktok" | "snapchat" | "whatsapp" | "facebook" | "x";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "snapchat",
  "whatsapp",
  "facebook",
  "x",
];

export interface ShareTarget {
  /** Public link to share (e.g. the r/$token page) — used by web intents and native share. */
  url: string;
  /** Caption / prompt text, prefilled where the platform supports it. */
  text?: string;
  /** Raw media URL (image/video) — used for native file-share and download fallback. */
  assetUrl?: string | null;
  /** Filename to use if we fall back to downloading. */
  filename?: string;
}

type WebIntentBuilder = (t: ShareTarget) => string;

const WEB_INTENTS: Partial<Record<SocialPlatform, WebIntentBuilder>> = {
  whatsapp: (t) => `https://wa.me/?text=${encodeURIComponent(t.text ? `${t.text} ${t.url}` : t.url)}`,
  facebook: (t) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(t.url)}`,
  x: (t) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(t.url)}&text=${encodeURIComponent(t.text ?? "")}`,
};

/** Platforms with a real web share intent we can just open in a new tab. */
export function hasWebIntent(platform: SocialPlatform): boolean {
  return platform in WEB_INTENTS;
}

export function nativeShareSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

async function fetchAsShareFile(assetUrl: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(assetUrl, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || "application/octet-stream" });
  } catch {
    return null;
  }
}

/**
 * Open the OS-level share sheet. On mobile this lists every installed app
 * that accepts the payload — Instagram, TikTok, Snapchat, WhatsApp, Messages,
 * Mail, etc. — with the media file attached when the browser supports it.
 * Returns true on success or user-cancel, false if unsupported/failed.
 */
export async function shareNative(target: ShareTarget, title = "Aurora"): Promise<boolean> {
  if (!nativeShareSupported()) return false;

  if (target.assetUrl) {
    const file = await fetchAsShareFile(target.assetUrl, target.filename ?? "aurora-share");
    if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ title, text: target.text, url: target.url, files: [file] });
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return true;
        // Some browsers reject files+url together; retry without the url.
        try {
          await navigator.share({ title, text: target.text, files: [file] });
          return true;
        } catch (e2) {
          if (e2 instanceof DOMException && e2.name === "AbortError") return true;
        }
      }
    }
  }

  try {
    await navigator.share({ title, text: target.text, url: target.url });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return true;
    return false;
  }
}

/** Open a platform's web share intent in a new tab. Returns false if the platform has none. */
export function openWebIntent(platform: SocialPlatform, target: ShareTarget): boolean {
  const build = WEB_INTENTS[platform];
  if (!build) return false;
  window.open(build(target), "_blank", "noopener,noreferrer");
  return true;
}

export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  x: "X",
};
