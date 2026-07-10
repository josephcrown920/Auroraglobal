// ─── HeyGen Video Agent prompt shaping (Task #274) ───────────────────────────
// Client-safe module: pure helpers + UI copy only. No server imports.
//
// KEY CONSTRAINT: Aurora's HeyGen adapter uses the real v2 avatar-video API
// (POST /v2/video/generate), where the prompt is passed as voice.input_text —
// the presenter reads it ALOUD, word for word. There is no "instruction" layer:
// a literal "Tone: upbeat" or "[0:05] smile" line would be spoken on camera.
// So prompt engineering here means turning the user's raw idea into a clean,
// natural, first-person spoken script — and stripping anything that reads like
// production metadata (timestamps, stage directions, Tone:/Background: labels,
// negative instructions) which HeyGen's own guidance says degrades results.

export const VIDEO_AGENT_MODEL_KEY = "heygen/video-agent";

/** Inline helper copy shown under the prompt box when HeyGen Video Agent is selected. */
export const VIDEO_AGENT_HELPER_TEXT =
  "The presenter reads your text word-for-word, like a script. Write natural, first-person spoken lines — skip timestamps, camera directions, and \u201cdon\u2019t do X\u201d instructions (they\u2019d be read aloud). Or type a rough idea and hit Enhance to turn it into a polished script.";

/** Words-per-second budget for spoken avatar scripts (~145 wpm conversational pace). */
export const SPOKEN_WORDS_PER_SECOND = 2.4;

/** Rough word budget for a target spoken duration. */
export function videoAgentWordTarget(seconds: number): number {
  const s = Number.isFinite(seconds) && seconds > 0 ? seconds : 20;
  return Math.max(12, Math.round(s * SPOKEN_WORDS_PER_SECOND));
}

// Lines that are production metadata rather than speech. Matched at the start
// of a line (after optional list markers) so mid-sentence words like
// "the tone of voice" are never touched.
const META_LABEL_RE =
  /^\s*(?:[-*•]\s*)?(?:script|tone|background|duration|style|voice|camera|scene|setting|music|aspect ratio|orientation)\s*[:=]/i;

// Timestamp prefixes: "0:00", "00:12 -", "[00:05]", "(0:05-0:10)", "0:05–0:10:".
const TIMESTAMP_PREFIX_RE =
  /^\s*[[(]?\d{1,2}:\d{2}(?:\s*[-–—]\s*\d{1,2}:\d{2})?[\])]?\s*[-–—:.]?\s*/;

// Bracketed stage directions anywhere in a line: "[smiles]", "[cut to product]".
// Parentheses are left alone — they're common in legitimate speech.
const STAGE_DIRECTION_RE = /\[[^\]\n]*\]/g;

/**
 * Deterministic post-pass over an enhanced (or hand-written) script:
 * drops metadata label lines, strips timestamp prefixes and bracketed stage
 * directions, and collapses whitespace. Never rewrites actual speech.
 */
export function sanitizeVideoAgentScript(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const raw of lines) {
    if (META_LABEL_RE.test(raw)) continue;
    let line = raw.replace(TIMESTAMP_PREFIX_RE, "");
    line = line.replace(STAGE_DIRECTION_RE, "");
    line = line.trim();
    if (line) kept.push(line);
  }
  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}
