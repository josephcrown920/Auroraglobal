/**
 * Reliable cross-origin image/video download.
 *
 * Browsers ignore the `download` attribute on <a> when the href is on a
 * different origin (which is the case for Supabase storage URLs). This helper
 * fetches the asset as a blob and clicks a synthetic link so the file actually
 * lands on disk with the chosen filename.
 */
export async function saveAssetToDisk(url: string, filename?: string): Promise<void> {
  const name = filename || url.split("/").pop()?.split("?")[0] || `aurora-${Date.now()}`;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch {
    // Fallback: open in a new tab so the user can long-press / right-click save.
    window.open(url, "_blank", "noopener");
  }
}

/** True if a generation prompt was produced by the Split Reality flow. */
export function isSplitRealityPrompt(prompt: string | null | undefined): boolean {
  return !!prompt && /^\[Split Reality/i.test(prompt);
}

/** Parse the variant tag (`ultra` / `cinematic`) from a Split Reality prompt. */
export function splitRealityVariant(prompt: string | null | undefined): string | null {
  const m = (prompt ?? "").match(/^\[Split Reality\s*\/\s*([^\]]+)\]/i);
  return m ? m[1].trim() : null;
}
