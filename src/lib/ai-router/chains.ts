// Aurora AI Intelligence Router — Per-category model chains
// Each chain is an ordered list of provider names to try in sequence.
// Claude is first for creative/technical work; Gemini leads utility chains.
// Provider names map to the registry in providers.ts.

import type { RequestCategory } from "./categories";

// Ordered fallback chains per the spec.
// First provider in the list is the preferred choice; the router tries each
// in order until one succeeds, skipping providers that are unhealthy or disabled.
export const CATEGORY_CHAINS: Record<RequestCategory, string[]> = {
  // ── Utility / low-cost first ──────────────────────────────────────────────
  GENERAL_CHAT:     ["gemini", "grok", "qwen", "deepseek", "llama"],
  CUSTOMER_SUPPORT: ["gemini", "qwen", "llama", "claude"],
  FAQ:              ["gemini", "deepseek", "qwen", "llama"],
  PRICING:          ["gemini", "deepseek", "qwen"],
  PRODUCT_DISCOVERY:["gemini", "grok", "claude", "deepseek"],

  // ── Premium creative — Claude leads ───────────────────────────────────────
  VIDEO_DIRECTION:  ["claude", "gemini", "deepseek", "qwen", "llama"],
  VIDEO_PROMPTS:    ["claude", "gemini", "deepseek", "qwen"],
  IMAGE_PROMPTS:    ["claude", "gemini", "deepseek", "qwen"],
  SCRIPT_WRITING:   ["claude", "grok", "gemini", "deepseek", "qwen"],
  MUSIC_MARKETING:  ["claude", "grok", "gemini", "deepseek"],
  ARTIST_BRANDING:  ["claude", "grok", "gemini", "deepseek"],
  SOCIAL_CONTENT:   ["claude", "grok", "gemini", "deepseek"],
  ADVERTISEMENT:    ["claude", "grok", "gemini", "deepseek"],
  COPYWRITING:      ["claude", "gemini", "deepseek", "grok"],
  LANDING_PAGE:     ["claude", "gemini", "deepseek"],
  BLOG:             ["claude", "gemini", "deepseek"],
  EMAIL_WRITING:    ["claude", "gemini", "deepseek"],
  PLAYLIST_PITCHING:["claude", "grok", "gemini", "deepseek"],

  // ── Technical — Claude + coder-specialised models ─────────────────────────
  CODING:    ["claude", "qwen-coder", "deepseek-coder", "gemini", "grok"],
  DEBUGGING: ["claude", "qwen-coder", "deepseek-coder", "gemini"],
};
