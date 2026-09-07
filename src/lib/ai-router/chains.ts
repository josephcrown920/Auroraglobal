// Aurora AI Intelligence Router — Per-category model chains
// Each chain is an ordered list of provider names to try in sequence.
// Claude is first for creative/technical work; Gemini leads utility chains.
// Provider names map to the registry in providers.ts.

import type { RequestCategory } from "./categories";

// Ordered fallback chains per the spec.
// First provider in the list is the preferred choice; the router tries each
// in order until one succeeds, skipping providers that are unhealthy or disabled.
export const CATEGORY_CHAINS: Record<RequestCategory, string[]> = {
  // "openai" is the Replit-billed proxy (no user key) — it sits second in every
  // chain as the always-on backstop, so a dead slug or drained balance on the
  // preferred provider never leaves a feature with no working model.
  // ── Utility / low-cost first ──────────────────────────────────────────────
  GENERAL_CHAT:     ["gemini", "openai", "grok", "qwen", "deepseek", "llama"],
  CUSTOMER_SUPPORT: ["gemini", "openai", "qwen", "llama", "claude"],
  FAQ:              ["gemini", "openai", "deepseek", "qwen", "llama"],
  PRICING:          ["gemini", "openai", "deepseek", "qwen"],
  PRODUCT_DISCOVERY:["gemini", "openai", "grok", "claude", "deepseek"],

  // ── Premium creative — Claude leads ───────────────────────────────────────
  VIDEO_DIRECTION:  ["claude", "openai", "gemini", "deepseek", "qwen", "llama"],
  VIDEO_PROMPTS:    ["claude", "openai", "gemini", "deepseek", "qwen"],
  IMAGE_PROMPTS:    ["claude", "openai", "gemini", "deepseek", "qwen"],
  SCRIPT_WRITING:   ["claude", "openai", "grok", "gemini", "deepseek", "qwen"],
  MUSIC_MARKETING:  ["claude", "openai", "grok", "gemini", "deepseek"],
  ARTIST_BRANDING:  ["claude", "openai", "grok", "gemini", "deepseek"],
  SOCIAL_CONTENT:   ["claude", "openai", "grok", "gemini", "deepseek"],
  ADVERTISEMENT:    ["claude", "openai", "grok", "gemini", "deepseek"],
  COPYWRITING:      ["claude", "openai", "gemini", "deepseek", "grok"],
  LANDING_PAGE:     ["claude", "openai", "gemini", "deepseek"],
  BLOG:             ["claude", "openai", "gemini", "deepseek"],
  EMAIL_WRITING:    ["claude", "openai", "gemini", "deepseek"],
  PLAYLIST_PITCHING:["claude", "openai", "grok", "gemini", "deepseek"],

  // ── Technical — Claude + coder-specialised models ─────────────────────────
  CODING:    ["claude", "openai", "qwen-coder", "deepseek-coder", "gemini", "grok"],
  DEBUGGING: ["claude", "openai", "qwen-coder", "deepseek-coder", "gemini"],
};

