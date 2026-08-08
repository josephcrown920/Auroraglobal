// ── Design Skins ─────────────────────────────────────────────────────────────
// Admin-editable front-end design system. A "skin" is a flat map of CSS custom
// property overrides (hex colors + a few scalars) that get written onto
// <html> at runtime, on top of the values declared in src/styles.css.
//
// Skins are stored in the existing `site_content` table (publicly readable,
// admin-writable) so no migration is required:
//   key = "design:skin:<slug>"  kind = "json"  value = JSON.stringify(Skin)
//   key = "design:active"       kind = "text"  value = "<slug>" (or "" = default)
//
// Nothing in the shipped UI changes unless an admin activates a skin.

import { supabase } from "@/integrations/supabase/client";

export type SkinTokens = Record<string, string>;

export type Skin = {
  slug: string;
  name: string;
  tokens: SkinTokens;
  updated_at?: string;
};

export type TokenField = {
  /** CSS custom property name without the leading `--`. */
  key: string;
  label: string;
  group: string;
  /** color → <input type=color>; text → free text (sizes, gradients, fonts). */
  type: "color" | "text";
};

export const SKIN_ACTIVE_KEY = "design:active";
export const SKIN_KEY_PREFIX = "design:skin:";
/** localStorage cache so an active skin paints immediately, before the fetch. */
export const SKIN_CACHE_KEY = "aurora-design-skin";

export const TOKEN_FIELDS: TokenField[] = [
  // Core surfaces
  { key: "background", label: "Page background", group: "Surfaces", type: "color" },
  { key: "foreground", label: "Text", group: "Surfaces", type: "color" },
  { key: "card", label: "Card / panel", group: "Surfaces", type: "color" },
  { key: "card-foreground", label: "Card text", group: "Surfaces", type: "color" },
  { key: "popover", label: "Popover", group: "Surfaces", type: "color" },
  { key: "secondary", label: "Secondary surface", group: "Surfaces", type: "color" },
  { key: "muted", label: "Muted surface", group: "Surfaces", type: "color" },
  { key: "muted-foreground", label: "Muted text", group: "Surfaces", type: "color" },
  { key: "accent", label: "Accent surface", group: "Surfaces", type: "color" },
  { key: "border", label: "Border", group: "Surfaces", type: "color" },
  { key: "input", label: "Input border", group: "Surfaces", type: "color" },

  // Brand
  { key: "primary", label: "Primary / brand", group: "Brand", type: "color" },
  { key: "primary-foreground", label: "On primary", group: "Brand", type: "color" },
  { key: "primary-glow", label: "Primary glow", group: "Brand", type: "color" },
  { key: "primary-deep", label: "Primary deep", group: "Brand", type: "color" },
  { key: "ring", label: "Focus ring", group: "Brand", type: "color" },
  { key: "destructive", label: "Destructive", group: "Brand", type: "color" },
  { key: "brand-red", label: "Brand red", group: "Brand", type: "color" },

  // Studio (Prime Director / Colors pages)
  { key: "canvas", label: "Studio canvas", group: "Studio", type: "color" },
  { key: "panel", label: "Studio panel", group: "Studio", type: "color" },
  { key: "panel-2", label: "Studio panel 2", group: "Studio", type: "color" },
  { key: "line", label: "Studio line", group: "Studio", type: "color" },
  { key: "ink", label: "Studio ink", group: "Studio", type: "color" },
  { key: "ink-dim", label: "Studio ink dim", group: "Studio", type: "color" },
  { key: "prime", label: "Studio prime", group: "Studio", type: "color" },
  { key: "prime-glow", label: "Studio prime glow", group: "Studio", type: "color" },
  { key: "rec", label: "Record red", group: "Studio", type: "color" },

  // Shape & type
  { key: "radius", label: "Corner radius", group: "Shape & type", type: "text" },
  { key: "gradient-hero", label: "Hero gradient", group: "Shape & type", type: "text" },
  { key: "gradient-text", label: "Headline gradient", group: "Shape & type", type: "text" },
  { key: "shadow-glow", label: "Glow shadow", group: "Shape & type", type: "text" },
];

/** Hex/scalar equivalents of the shipped dark theme — the editor's starting point. */
export const DEFAULT_TOKENS: SkinTokens = {
  background: "#0b0814",
  foreground: "#fafafa",
  card: "#16121f",
  "card-foreground": "#fafafa",
  popover: "#16121f",
  secondary: "#201a2b",
  muted: "#1d1826",
  "muted-foreground": "#918da0",
  accent: "#272033",
  border: "#2a2436",
  input: "#312a3e",
  primary: "#b56bf2",
  "primary-foreground": "#16101f",
  "primary-glow": "#c885f7",
  "primary-deep": "#4a2b8f",
  ring: "#b56bf2",
  destructive: "#f0464a",
  "brand-red": "#e0453a",
  canvas: "#0b0814",
  panel: "#16121f",
  "panel-2": "#201a2b",
  line: "#2a2436",
  ink: "#fafafa",
  "ink-dim": "#918da0",
  prime: "#b56bf2",
  "prime-glow": "#c885f7",
  rec: "#e0453a",
  radius: "0.625rem",
  "gradient-hero": "linear-gradient(135deg, #6b2fd6, #d152c8)",
  "gradient-text": "linear-gradient(120deg, #ffffff, #d98ff0 55%, #b56bf2)",
  "shadow-glow": "0 20px 60px -20px rgba(107,47,214,0.45)",
};

/** Ready-made starting points an admin can load, tweak, and save. */
export const SKIN_PRESETS: { name: string; tokens: SkinTokens }[] = [
  { name: "Aurora Violet (default)", tokens: { ...DEFAULT_TOKENS } },
  {
    name: "Gold Noir",
    tokens: {
      ...DEFAULT_TOKENS,
      background: "#0a0a0a",
      card: "#141210",
      secondary: "#1d1a15",
      muted: "#1a1713",
      "muted-foreground": "#a1957c",
      accent: "#241f16",
      border: "#33291a",
      input: "#3d3120",
      primary: "#e9c46a",
      "primary-foreground": "#181307",
      "primary-glow": "#f6dd9a",
      "primary-deep": "#6b5116",
      ring: "#e9c46a",
      canvas: "#0a0a0a",
      panel: "#141210",
      "panel-2": "#1d1a15",
      line: "#33291a",
      "ink-dim": "#a1957c",
      prime: "#e9c46a",
      "prime-glow": "#f6dd9a",
      "gradient-hero": "linear-gradient(135deg, #8a6a1d, #f0d48a)",
      "gradient-text": "linear-gradient(120deg, #ffffff, #f6dd9a 55%, #e9c46a)",
      "shadow-glow": "0 20px 60px -20px rgba(233,196,106,0.4)",
    },
  },
  {
    name: "Red Carpet",
    tokens: {
      ...DEFAULT_TOKENS,
      background: "#0d0708",
      card: "#1a1012",
      secondary: "#241417",
      muted: "#201214",
      "muted-foreground": "#a58b8f",
      accent: "#2c171b",
      border: "#3a1d22",
      input: "#46232a",
      primary: "#e03a4e",
      "primary-foreground": "#1a0508",
      "primary-glow": "#ff6b7d",
      "primary-deep": "#7a1524",
      ring: "#e03a4e",
      canvas: "#0d0708",
      panel: "#1a1012",
      "panel-2": "#241417",
      line: "#3a1d22",
      "ink-dim": "#a58b8f",
      prime: "#e03a4e",
      "prime-glow": "#ff6b7d",
      "gradient-hero": "linear-gradient(135deg, #8c1024, #e03a4e)",
      "gradient-text": "linear-gradient(120deg, #ffffff, #ff8f9c 55%, #e03a4e)",
      "shadow-glow": "0 20px 60px -20px rgba(224,58,78,0.45)",
    },
  },
  {
    name: "Cyber Teal",
    tokens: {
      ...DEFAULT_TOKENS,
      background: "#04100f",
      card: "#0b1c1b",
      secondary: "#112625",
      muted: "#0f2221",
      "muted-foreground": "#82a3a0",
      accent: "#153230",
      border: "#1c3b39",
      input: "#234745",
      primary: "#2ee6c5",
      "primary-foreground": "#04211c",
      "primary-glow": "#7ff5de",
      "primary-deep": "#0c6b5b",
      ring: "#2ee6c5",
      canvas: "#04100f",
      panel: "#0b1c1b",
      "panel-2": "#112625",
      line: "#1c3b39",
      "ink-dim": "#82a3a0",
      prime: "#2ee6c5",
      "prime-glow": "#7ff5de",
      "gradient-hero": "linear-gradient(135deg, #0b6f66, #2ee6c5)",
      "gradient-text": "linear-gradient(120deg, #ffffff, #7ff5de 55%, #2ee6c5)",
      "shadow-glow": "0 20px 60px -20px rgba(46,230,197,0.4)",
    },
  },
  {
    name: "Studio Light",
    tokens: {
      ...DEFAULT_TOKENS,
      background: "#ffffff",
      foreground: "#12121a",
      card: "#f6f5f9",
      "card-foreground": "#12121a",
      popover: "#ffffff",
      secondary: "#eeecf3",
      muted: "#f1eff5",
      "muted-foreground": "#5f5b6b",
      accent: "#e8e4f2",
      border: "#e1dee8",
      input: "#d6d2e0",
      primary: "#7c3aed",
      "primary-foreground": "#ffffff",
      "primary-glow": "#a175f5",
      ring: "#7c3aed",
      canvas: "#ffffff",
      panel: "#f6f5f9",
      "panel-2": "#eeecf3",
      line: "#e1dee8",
      ink: "#12121a",
      "ink-dim": "#5f5b6b",
      prime: "#7c3aed",
      "prime-glow": "#a175f5",
      "gradient-hero": "linear-gradient(135deg, #7c3aed, #c026d3)",
      "gradient-text": "linear-gradient(120deg, #12121a, #7c3aed 60%, #c026d3)",
      "shadow-glow": "0 20px 60px -20px rgba(124,58,237,0.25)",
    },
  },
];

/** Write a skin's tokens onto <html>. Passing null clears every override. */
export function applyDesignSkin(tokens: SkinTokens | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const field of TOKEN_FIELDS) {
    const value = tokens?.[field.key];
    if (value && value.trim()) root.style.setProperty(`--${field.key}`, value.trim());
    else root.style.removeProperty(`--${field.key}`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- site_content rows are untyped key/value
const table = () => (supabase as any).from("site_content");

export async function fetchSkins(): Promise<{ skins: Skin[]; activeSlug: string }> {
  const { data, error } = await table()
    .select("key, value, updated_at")
    .like("key", "design:%");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { key: string; value: string; updated_at?: string }[];
  const skins: Skin[] = [];
  let activeSlug = "";
  for (const row of rows) {
    if (row.key === SKIN_ACTIVE_KEY) {
      activeSlug = row.value ?? "";
      continue;
    }
    if (!row.key.startsWith(SKIN_KEY_PREFIX)) continue;
    try {
      const parsed = JSON.parse(row.value) as Skin;
      skins.push({
        slug: row.key.slice(SKIN_KEY_PREFIX.length),
        name: parsed.name || row.key.slice(SKIN_KEY_PREFIX.length),
        tokens: parsed.tokens ?? {},
        updated_at: row.updated_at,
      });
    } catch {
      // Corrupt row — skip rather than break the whole list.
    }
  }
  skins.sort((a, b) => a.name.localeCompare(b.name));
  return { skins, activeSlug };
}

/** Fetch only the active skin's tokens (used by the runtime applier). */
export async function fetchActiveSkinTokens(): Promise<SkinTokens | null> {
  const { skins, activeSlug } = await fetchSkins();
  if (!activeSlug) return null;
  return skins.find((s) => s.slug === activeSlug)?.tokens ?? null;
}

export function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `skin-${Date.now()}`
  );
}

export async function saveSkin(skin: Skin) {
  const { error } = await table().upsert(
    {
      key: `${SKIN_KEY_PREFIX}${skin.slug}`,
      kind: "json",
      value: JSON.stringify({ name: skin.name, tokens: skin.tokens }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export async function deleteSkin(slug: string) {
  const { error } = await table().delete().eq("key", `${SKIN_KEY_PREFIX}${slug}`);
  if (error) throw new Error(error.message);
}

/** Set (or clear, with "") the site-wide active skin. */
export async function setActiveSkin(slug: string) {
  const { error } = await table().upsert(
    { key: SKIN_ACTIVE_KEY, kind: "text", value: slug, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}
