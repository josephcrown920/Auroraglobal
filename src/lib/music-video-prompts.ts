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

const MIN_LINE_GAP_SECONDS = 0.4;

/**
 * Snap lyric lines onto detected beat timestamps. Each line's ideal start is
 * its even-split position (i * duration / lineCount); that start is moved to
 * the nearest beat, keeping starts strictly increasing with a minimum gap so
 * captions never overlap or collapse. Lines whose ideal position has no
 * remaining beats keep their even-split start, so this always produces one
 * sane segment per line. No usable beats → identical to buildEvenLyricSegments.
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
  const minGap = Math.min(MIN_LINE_GAP_SECONDS, segLen);
  const starts: number[] = [];
  let beatIdx = 0;

  for (let i = 0; i < lines.length; i++) {
    const ideal = i * segLen;
    const earliest = i === 0 ? 0 : starts[i - 1] + minGap;
    // Skip beats that would overlap the previous line, then walk forward
    // while the next beat is closer to the ideal position.
    while (beatIdx < beats.length && beats[beatIdx] < earliest) beatIdx++;
    while (
      beatIdx + 1 < beats.length &&
      Math.abs(beats[beatIdx + 1] - ideal) <= Math.abs(beats[beatIdx] - ideal)
    ) {
      beatIdx++;
    }
    let start: number;
    if (beatIdx < beats.length) {
      start = Math.max(beats[beatIdx], earliest);
      beatIdx++;
    } else {
      start = Math.max(ideal, earliest);
    }
    starts.push(Math.min(start, durationSeconds));
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return lines.map((text, i) => {
    const start = r2(starts[i]);
    const end = r2(i + 1 < lines.length ? starts[i + 1] : durationSeconds);
    return { start, end: Math.max(end, start), text };
  });
}
