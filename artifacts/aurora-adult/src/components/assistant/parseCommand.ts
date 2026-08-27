// Lightweight plain-English command parser for the in-studio Assistant.
// Not a full NLU stack — just enough pattern-matching to resolve the
// "create N <look> shots of @model" and "turn it into a video" requests the
// tour teaches, plus friendly guidance when the roster mention doesn't match.
import { LOOKS, MODELS, resolveModelMention, type LookId } from "@/lib/models";

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
};

const LOOK_KEYWORDS: [RegExp, LookId][] = [
  [/\bbeach|golden ?hour|sunset|outdoor/, "golden"],
  [/\bboudoir|silk|bedroom/, "boudoir"],
  [/\bvelvet|jewel.?tone/, "velvet"],
  [/\bneon|cyberpunk|blade ?runner/, "neon"],
  [/\bluxury|suite|hotel|marble/, "luxury"],
  [/\bnoir|black and white|monochrome/, "noir"],
  [/\bethereal|angelic|dreamy|high.?key/, "ethereal"],
  [/\bpower|bold|editorial cover/, "power"],
];

export type AssistantAction =
  | { type: "generate"; count: number; modelId: string; lookId: LookId; mediaKind: "image" | "video"; prompt: string }
  | { type: "video-from-last"; prompt: string }
  | { type: "needs-model"; mention: string }
  | { type: "unrecognized" };

export function parseAssistantCommand(raw: string): AssistantAction {
  const text = raw.trim();
  const lower = text.toLowerCase();

  const mentionMatch = lower.match(/@([a-z0-9_]+)/);
  const wantsVideo =
    /\bvideo\b/.test(lower) &&
    (/(turn|make|convert|animate|into a video|as a video)/.test(lower) || !mentionMatch);

  if (wantsVideo && !mentionMatch) {
    return { type: "video-from-last", prompt: text };
  }

  let count = 1;
  const digitMatch = lower.match(/\b(\d+)\b/);
  if (digitMatch) {
    count = parseInt(digitMatch[1], 10);
  } else {
    for (const [word, n] of Object.entries(NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) {
        count = n;
        break;
      }
    }
  }
  count = Math.max(1, Math.min(8, count));

  let lookId: LookId = "golden";
  for (const [re, id] of LOOK_KEYWORDS) {
    if (re.test(lower)) {
      lookId = id;
      break;
    }
  }

  if (mentionMatch) {
    const model = resolveModelMention(mentionMatch[1]);
    if (!model) return { type: "needs-model", mention: mentionMatch[1] };
    return { type: "generate", count, modelId: model.id, lookId, mediaKind: wantsVideo ? "video" : "image", prompt: text };
  }

  // No @mention — if the message otherwise looks like a generation request
  // (mentions a look keyword, "shot(s)", "photo(s)", or "image(s)"), default
  // to the featured model rather than failing outright.
  if (/\bshots?|photos?|images?|pictures?\b/.test(lower) || LOOK_KEYWORDS.some(([re]) => re.test(lower))) {
    return { type: "generate", count, modelId: MODELS[0].id, lookId, mediaKind: wantsVideo ? "video" : "image", prompt: text };
  }

  return { type: "unrecognized" };
}
