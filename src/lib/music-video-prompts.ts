export type MusicVideoStyle = "trap" | "afrobeats" | "drill" | "luxury";
export type MusicVideoMode =
  | "text-to-video"
  | "image-to-video"
  | "ai-performance"
  | "beat-sync"
  | "lyric-style"
  | "style-transfer";

export const MUSIC_VIDEO_STYLES: Record<
  MusicVideoStyle,
  { label: string; description: string; emoji: string; colorClass: string }
> = {
  trap: {
    label: "Trap",
    description: "gritty urban, dark cinematic, muted tones",
    emoji: "🌆",
    colorClass: "from-zinc-900 to-zinc-800 border-zinc-600",
  },
  afrobeats: {
    label: "Afrobeats",
    description: "warm tones, summer vibe, vibrant energy",
    emoji: "🌅",
    colorClass: "from-orange-950 to-amber-900 border-amber-600",
  },
  drill: {
    label: "Drill",
    description: "London street energy, aggressive mood, desaturated",
    emoji: "🏙️",
    colorClass: "from-slate-900 to-slate-800 border-slate-500",
  },
  luxury: {
    label: "Luxury",
    description: "gold tones, rich cinematic, high fashion",
    emoji: "👑",
    colorClass: "from-yellow-950 to-stone-900 border-yellow-600",
  },
};

const STYLE_DETAILS: Record<MusicVideoStyle, string> = {
  trap: "trap aesthetic, gritty urban environment, desaturated dark tones, grimy textures",
  afrobeats: "afrobeats summer vibe, warm golden tones, vibrant energy, lush tropical setting",
  drill: "UK drill scene, London street energy, aggressive mood, cold desaturated color grade",
  luxury: "luxury lifestyle aesthetic, gold and rich tones, opulent setting, high-fashion cinematic",
};

export const MUSIC_VIDEO_MODES: {
  key: MusicVideoMode;
  label: string;
  description: string;
  needsImage: boolean;
}[] = [
  {
    key: "text-to-video",
    label: "Text → Video",
    description: "Generate a scene from a prompt",
    needsImage: false,
  },
  {
    key: "image-to-video",
    label: "Image → Video",
    description: "Animate your cover art or still",
    needsImage: true,
  },
  {
    key: "ai-performance",
    label: "AI Performance",
    description: "Artist performing to camera",
    needsImage: false,
  },
  {
    key: "beat-sync",
    label: "Beat-Sync",
    description: "Fast-cut visuals synced to a beat",
    needsImage: false,
  },
  {
    key: "lyric-style",
    label: "Lyric Style",
    description: "Caption / lyric video direction",
    needsImage: false,
  },
  {
    key: "style-transfer",
    label: "Style Transfer",
    description: "Regrading existing footage",
    needsImage: true,
  },
];

export function buildMusicVideoPrompt(
  mode: MusicVideoMode,
  style: MusicVideoStyle,
  location = "urban night street",
  subject = "a music artist",
): string {
  const styleDetail = STYLE_DETAILS[style];

  switch (mode) {
    case "text-to-video":
      return `A dark cinematic music video scene, ${styleDetail}, shot in ${location}, featuring ${subject}. Lighting is dramatic, high contrast, neon accents, volumetric fog, lens flares. Camera movement: slow tracking shot, handheld energy, slight shake. Mood: intense, emotional, atmospheric, urban night vibe. Highly detailed, 4K, film grain, shallow depth of field.`;

    case "image-to-video":
      return `Animate this image into a cinematic music video scene with ${styleDetail}. Add subtle motion: smoke drifting, lights flickering, camera slowly pushing in. Keep subject consistent. Add depth, parallax effect. Dark, moody lighting, music video style, smooth motion.`;

    case "ai-performance":
      return `${subject} performing to camera, expressive movements, confident energy, ${styleDetail}. Urban street background, night setting, cinematic lighting. Camera close-up and mid shots, slight handheld motion. Realistic facial expressions, performance intensity. Shallow depth of field, 4K photoreal.`;

    case "beat-sync":
      return `Fast-cut music video visuals synced to a strong beat, ${styleDetail}. Quick transitions, flashing lights, motion blur, dynamic camera angles. Urban night scenes, crowd energy, performance vibe. High intensity, rhythmic motion, cinematic lighting. Each shot holds 1–2 seconds, hard cut on the beat.`;

    case "lyric-style":
      return `Animated lyric captions in bold modern typography, ${styleDetail} color palette. Kinetic text synced to music rhythm. Glitch effects, neon highlights, smooth transitions. High contrast, readable, engaging for short-form vertical video.`;

    case "style-transfer":
      return `Transform this video into a ${MUSIC_VIDEO_STYLES[style].label} music video. Apply consistent color grading (${styleDetail}), cinematic lighting style, and atmospheric tone. Preserve motion but enhance mood and visual energy. Film grain, color grade, professional post-production look.`;
  }
}

export const LOCATION_SUGGESTIONS = [
  "urban night street",
  "rooftop with city skyline",
  "underground club",
  "neon-lit alley",
  "luxury penthouse",
  "warehouse studio",
  "beachfront at sunset",
  "city highway overpass",
];

export const SUBJECT_SUGGESTIONS = [
  "a solo rap artist",
  "a female singer-songwriter",
  "a DJ behind the decks",
  "a group of three artists",
  "a dancer mid-routine",
  "a hooded silhouette figure",
];

export type LyricSegment = { start: number; end: number; text: string };

/**
 * Evenly distribute pasted lyric lines across a song's duration. There is no
 * ASR/beat alignment here — each non-blank line simply gets an equal time
 * slice, in order. That is a deliberate simplification (see task notes):
 * aligning captions to *singing* is unreliable, whereas an even split always
 * produces a sane, reviewable timing the user can nudge by editing lines.
 */
export function buildEvenLyricSegments(durationSeconds: number, rawLines: string[]): LyricSegment[] {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const segLen = durationSeconds / lines.length;
  return lines.map((text, i) => ({
    start: Math.round(i * segLen * 100) / 100,
    end: Math.round((i + 1) * segLen * 100) / 100,
    text,
  }));
}

export type LyricBeatGate = "no-audio" | "pending" | "ready";

/**
 * Decide whether lyric-video generation may be submitted. Beat detection
 * auto-starts as soon as a song is uploaded; while it is pending the user
 * must NOT be able to generate, or they would silently get the even-split
 * timing this feature replaced. Once detection settles — done (with or
 * without usable beats) or failed — generation opens, with the even split
 * as the explicit fallback. "idle" with an uploaded song means the analysis
 * effect hasn't run yet, which is still pending.
 */
export function lyricBeatGate(opts: {
  hasAudio: boolean;
  beatStatus: "idle" | "analyzing" | "done" | "error";
  analysisFailed: boolean;
}): LyricBeatGate {
  if (!opts.hasAudio) return "no-audio";
  if (opts.analysisFailed) return "ready";
  if (opts.beatStatus === "done" || opts.beatStatus === "error") return "ready";
  return "pending";
}

/**
 * Marker bookkeeping for the lyric auto-analysis effect's cleanup. The
 * per-URL marker is cleared unless that URL's analysis completed — so
 * leaving Lyric mode mid-download (or swapping songs) lets a later return
 * re-run analysis instead of skipping it forever, while a finished analysis
 * is reused instead of re-downloaded.
 */
export function lyricAnalysisMarkerAfterCleanup(
  marker: string | null,
  url: string,
  beatStatus: "idle" | "analyzing" | "done" | "error",
): string | null {
  if (marker !== url) return marker;
  return beatStatus === "done" ? marker : null;
}

const MIN_LINE_GAP_SECONDS = 0.4;

/**
 * Snap lyric lines onto detected beat timestamps. Each line's ideal start is
 * its even-split position (i * duration / lineCount); that start is moved to
 * the nearest beat within half a slot of the ideal (a beat further away says
 * nothing about when the line is sung, so the line keeps its even start).
 * Two invariants are enforced for every line: its start is at least
 * min(minGap, slot) after the previous line's start, and enough room is
 * reserved for every remaining line — so starts are strictly increasing and
 * no segment can collapse onto the end of the track. No usable beats →
 * identical to buildEvenLyricSegments.
 */
export function buildBeatAlignedSegments(
  durationSeconds: number,
  rawLines: string[],
  beatTimestamps: number[],
): LyricSegment[] {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];

  const beats = beatTimestamps
    .filter((t) => Number.isFinite(t) && t >= 0 && t < durationSeconds)
    .sort((a, b) => a - b);
  if (beats.length === 0) return buildEvenLyricSegments(durationSeconds, lines);

  const segLen = durationSeconds / lines.length;
  // Segment boundaries are rounded to centiseconds. When a line's slot is
  // shorter than 0.01s, strictly increasing boundaries are mathematically
  // impossible at that precision — keep the even split's behavior for such
  // inputs rather than emitting a half-beat-aligned half-collapsed hybrid.
  if (segLen < 0.01) return buildEvenLyricSegments(durationSeconds, lines);
  const minGap = Math.min(MIN_LINE_GAP_SECONDS, segLen);
  const n = lines.length;
  const starts: number[] = [];
  let beatIdx = 0;

  for (let i = 0; i < n; i++) {
    const ideal = i * segLen;
    const earliest = i === 0 ? 0 : starts[i - 1] + minGap;
    // Reserve room for the remaining lines (this one included) so a late
    // beat can never collapse the tail into zero-length segments.
    const latest = durationSeconds - minGap * (n - i);
    // Only consider beats near this line's even position.
    const lower = Math.max(earliest, ideal - segLen / 2);
    const upper = Math.min(latest, ideal + segLen / 2);
    while (beatIdx < beats.length && beats[beatIdx] < lower) beatIdx++;
    // Walk to the beat nearest the ideal position, staying inside the window.
    while (
      beatIdx + 1 < beats.length &&
      beats[beatIdx + 1] <= upper &&
      Math.abs(beats[beatIdx + 1] - ideal) <= Math.abs(beats[beatIdx] - ideal)
    ) {
      beatIdx++;
    }
    let start: number;
    if (beatIdx < beats.length && beats[beatIdx] <= upper) {
      start = beats[beatIdx];
      beatIdx++;
    } else {
      start = Math.min(Math.max(ideal, earliest), latest);
    }
    starts.push(start);
  }

  const r2 = (x: number) => Math.round(x * 100) / 100;
  const segments: LyricSegment[] = [];
  for (let i = 0; i < n; i++) {
    let start = r2(starts[i]);
    if (i > 0 && start <= segments[i - 1].start) {
      // Sub-0.01s per-line slices can round onto each other; nudge forward
      // so rounded boundaries stay monotonic like the even split's.
      start = Math.min(r2(segments[i - 1].start + 0.01), r2(durationSeconds));
    }
    segments.push({ start, end: start, text: lines[i] });
  }
  for (let i = 0; i < n; i++) {
    segments[i].end = i + 1 < n ? segments[i + 1].start : r2(durationSeconds);
    if (segments[i].end < segments[i].start) segments[i].end = segments[i].start;
  }
  return segments;
}
