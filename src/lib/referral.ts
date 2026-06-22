// Client-side helpers for affiliate referral capture.
// Writes the ?ref=CODE value to localStorage so we can attach it to the user's
// profile on first sign-in, enabling lifetime referral attribution.

const KEY = "aurora_ref";

export function captureRefFromUrl() {
  if (typeof window === "undefined") return;
  try {
    const sp = new URLSearchParams(window.location.search);
    const code = sp.get("ref");
    if (code && code.length >= 2 && code.length <= 40 && /^[a-z0-9_-]+$/i.test(code)) {
      window.localStorage.setItem(KEY, code.toLowerCase());
    }
  } catch {}
}

export function getStoredRef(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(KEY); } catch { return null; }
}

export function clearStoredRef() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch {}
}