// Aurora AI Intelligence Router — Keyword Classifier
// Maps a request to one of 20 task categories using weighted keyword scoring.
// Zero API calls, zero latency — runs synchronously before model selection.
// Falls back to GENERAL_CHAT when the request is ambiguous.

import type { RequestCategory } from "./categories";

type KeywordMap = Partial<Record<RequestCategory, string[]>>;

// Keywords are checked case-insensitively against the full prompt text.
// Higher-scoring categories win ties. Each match adds 1 point.
const KEYWORD_MAP: KeywordMap = {
  CODING: [
    "code", "function", "write a function", "implement", "typescript", "javascript",
    "python", "css", "html", "sql", "api", "endpoint", "component", "class", "algorithm",
    "syntax", "import", "export", "const ", "let ", "var ", "async", "await", "hook",
  ],
  DEBUGGING: [
    "debug", "error", "bug", "fix this", "not working", "broken", "crash", "exception",
    "stack trace", "undefined", "null", "type error", "runtime error", "why is this",
    "what's wrong", "fails", "failing", "doesn't work",
  ],
  SCRIPT_WRITING: [
    "write a script", "script for", "video script", "ad script", "ugc script",
    "hook line", "opening line", "call to action", "cta line", "screenplay",
    "dialogue", "narration", "voiceover", "write the words", "what should i say",
  ],
  VIDEO_PROMPTS: [
    "video prompt", "generate video", "video of", "cinematic shot", "camera angle",
    "motion prompt", "lipsync", "lip sync", "talking head", "b-roll prompt",
    "video generation prompt", "kling prompt", "sora prompt",
  ],
  IMAGE_PROMPTS: [
    "image prompt", "photo prompt", "generate image", "picture of", "illustration of",
    "stable diffusion prompt", "midjourney prompt", "flux prompt", "image of a",
    "portrait of", "photo realistic", "dalle prompt",
  ],
  VIDEO_DIRECTION: [
    "direct", "director", "shot list", "storyboard", "cinematography", "visual story",
    "scene breakdown", "film like", "cinematic", "production plan", "shot sequence",
    "visual direction", "art direction",
  ],
  SOCIAL_CONTENT: [
    "instagram caption", "tiktok caption", "tweet", "post idea", "social media post",
    "content ideas", "reel idea", "short idea", "carousel", "hashtags", "post copy",
    "caption for", "what to post", "content calendar", "social content",
  ],
  MUSIC_MARKETING: [
    "music marketing", "promote my song", "market my music", "release strategy",
    "rollout plan", "music rollout", "pre-save", "listening party", "music campaign",
    "promote my track", "music promotion", "dsp", "spotify marketing",
  ],
  PLAYLIST_PITCHING: [
    "playlist pitch", "pitch to playlist", "playlist curator", "editorial playlist",
    "spotify playlist", "apple music playlist", "playlist submission", "curator email",
    "pitch email", "playlist placement",
  ],
  ARTIST_BRANDING: [
    "artist brand", "brand identity", "visual identity", "color palette", "logo",
    "artist name", "stage name", "brand voice", "aesthetic", "mood board",
    "artist image", "personal brand", "brand story",
  ],
  ADVERTISEMENT: [
    "advertisement", "ad copy", "ugc ad", "sponsored content", "product ad",
    "ad creative", "paid ad", "facebook ad", "google ad", "run ads", "ad campaign",
    "performance marketing", "conversion ad",
  ],
  COPYWRITING: [
    "copywriting", "write copy", "sales copy", "persuasive", "headline", "subheading",
    "tagline", "value proposition", "elevator pitch", "write the copy for",
    "compelling copy", "engaging copy",
  ],
  LANDING_PAGE: [
    "landing page", "sales page", "squeeze page", "opt-in page", "hero section",
    "above the fold", "page copy", "conversion page", "lp copy",
  ],
  BLOG: [
    "blog post", "blog article", "write an article", "long form", "blog content",
    "seo article", "content piece", "write about", "article on", "guest post",
  ],
  EMAIL_WRITING: [
    "email", "newsletter", "email campaign", "email sequence", "drip campaign",
    "email copy", "subject line", "cold email", "follow-up email", "email blast",
  ],
  CUSTOMER_SUPPORT: [
    "not working", "help me with", "support ticket", "i need help", "having trouble",
    "can't figure out", "how do i fix", "contact support", "refund", "account issue",
    "billing problem", "cancel subscription", "my account",
  ],
  FAQ: [
    "how does", "what is", "can aurora", "does aurora", "is there a way",
    "feature question", "how to use", "tutorial", "quick question", "what features",
  ],
  PRICING: [
    "price", "pricing", "cost", "aura credits", "how much", "subscription", "plan",
    "pro plan", "upgrade", "credits", "aura", "billing", "monthly", "annually",
    "free plan", "free tier",
  ],
  PRODUCT_DISCOVERY: [
    "tell me about aurora", "what can aurora do", "aurora features", "what tools",
    "explore aurora", "show me what", "getting started", "onboarding", "new here",
    "what's possible", "what should i try",
  ],
  GENERAL_CHAT: [
    "hi", "hello", "hey", "thanks", "thank you", "good morning", "what's up",
    "how are you", "nice", "great", "awesome", "cool", "ok", "okay", "sure",
  ],
};

/** Score a body of text against all category keyword maps. */
function scoreText(text: string): Map<RequestCategory, number> {
  const lower = text.toLowerCase();
  const scores = new Map<RequestCategory, number>();

  for (const [cat, keywords] of Object.entries(KEYWORD_MAP) as [RequestCategory, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > 0) scores.set(cat, score);
  }
  return scores;
}

/**
 * Classify a request into one of the 20 task categories.
 * Uses weighted keyword scoring — zero API calls, zero latency.
 * Returns GENERAL_CHAT when no keywords match (safe default).
 */
export function classifyRequest(text: string): RequestCategory {
  if (!text?.trim()) return "GENERAL_CHAT";

  const scores = scoreText(text);
  if (scores.size === 0) return "GENERAL_CHAT";

  // Find the highest-scoring category.
  let best: RequestCategory = "GENERAL_CHAT";
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  return best;
}

/** Classify and return the top-3 candidates with scores (for debugging/logging). */
export function classifyWithScores(text: string): Array<{ category: RequestCategory; score: number }> {
  const scores = scoreText(text);
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, score]) => ({ category, score }));
}
