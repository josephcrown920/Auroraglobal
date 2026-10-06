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
  GENERAL_CHAT:     ["gemini", "openai", "grok", "qwen", "deepseek", "openrouter-auto"],
  CUSTOMER_SUPPORT: ["gemini", "openai", "qwen", "openrouter-auto", "claude"],
  FAQ:              ["gemini", "openai", "deepseek", "qwen", "openrouter-auto"],
  PRICING:          ["gemini", "openai", "deepseek", "qwen", "openrouter-auto"],
  PRODUCT_DISCOVERY:["gemini", "openai", "grok", "claude", "deepseek", "openrouter-auto"],

  // ── Premium creative — Claude leads ───────────────────────────────────────
  VIDEO_DIRECTION:  ["claude", "openai", "gemini", "deepseek", "qwen", "openrouter-auto"],
  VIDEO_PROMPTS:    ["claude", "openai", "gemini", "deepseek", "qwen", "openrouter-auto"],
  IMAGE_PROMPTS:    ["claude", "openai", "gemini", "deepseek", "qwen", "openrouter-auto"],
  SCRIPT_WRITING:   ["claude", "openai", "grok", "gemini", "deepseek", "qwen", "openrouter-auto"],
  MUSIC_MARKETING:  ["claude", "openai", "grok", "gemini", "deepseek", "openrouter-auto"],
  ARTIST_BRANDING:  ["claude", "openai", "grok", "gemini", "deepseek", "openrouter-auto"],
  SOCIAL_CONTENT:   ["claude", "openai", "grok", "gemini", "deepseek", "openrouter-auto"],
  ADVERTISEMENT:    ["claude", "openai", "grok", "gemini", "deepseek", "openrouter-auto"],
  COPYWRITING:      ["claude", "openai", "gemini", "deepseek", "grok", "openrouter-auto"],
  LANDING_PAGE:     ["claude", "openai", "gemini", "deepseek", "openrouter-auto"],
  BLOG:             ["claude", "openai", "gemini", "deepseek", "openrouter-auto"],
  EMAIL_WRITING:    ["claude", "openai", "gemini", "deepseek", "openrouter-auto"],
  PLAYLIST_PITCHING:["claude", "openai", "grok", "gemini", "deepseek", "openrouter-auto"],

  // ── Technical — Claude + coder-specialised models ─────────────────────────
  CODING:    ["claude", "openai", "qwen-coder", "deepseek-coder", "gemini", "grok", "openrouter-auto"],
  DEBUGGING: ["claude", "openai", "qwen-coder", "deepseek-coder", "gemini", "openrouter-auto"],
};

