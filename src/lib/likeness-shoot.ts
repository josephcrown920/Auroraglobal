// ─── Locked Digital Likeness — Studio Shoot recipe (pure, no server imports) ──
// A locked likeness is a frozen character (face + build + hair + wardrobe cues)
// captured from one or more reference photos. The shoot pipeline holds identity
// and outfit CONSTANT and varies only camera angle, framing and pose per beat —
// so the result feels like a real studio shoot / music-video cover deck rather
// than a bunch of unrelated generations. Fully clothed. Nothing sexualized.
//
// This module is the single source of truth for the shot deck, price, model and
// prompt builders. Both the server functions and the client UI import from here
// so behaviour stays in lockstep.

export const LIKENESS_MODEL = "google/gemini-3.1-flash-image-preview";

/** Per-image price (Aura). Kept identical to the reshoot recipe. */
export const LIKENESS_COST_PER_IMAGE = 1;

/** Hard cap on shots requested in one shoot (protects credits + rate limits). */
export const LIKENESS_MAX_SHOTS = 12;

export type ShootShot = {
  /** Stable key. Used as the ledger + result id. */
  id: string;
  label: string;
  /** Camera + framing directive injected into the prompt. */
  angle: string;
  /** Subject posing / performance directive. */
  pose: string;
  /** Beat cue this shot is meant to land on (used to sync editing later). */
  beat: "downbeat" | "off-beat" | "drop" | "breath" | "tail";
};

/** 12-shot studio deck, in cutting order. Each shot changes ONE thing (angle
 *  and pose) — outfit, environment and lighting are held by the reference. */
export const SHOOT_DECK: readonly ShootShot[] = [
  { id: "wide_hero",       label: "Wide hero",           angle: "Wide full-body shot, camera at eye level, subject centered, 9:16 vertical framing, soft studio backdrop.", pose: "Standing tall, weight on back foot, chin slightly up, hands relaxed at sides.", beat: "downbeat" },
  { id: "mid_lean_in",     label: "Mid lean-in",         angle: "Medium shot from chest up, camera slightly below eye line, subject leaning toward the lens.", pose: "Leaning forward into camera, one shoulder dropped, calm confident look.", beat: "downbeat" },
  { id: "profile_left",    label: "Left profile",        angle: "Side profile from the subject's left, sharp studio rim-light behind the head, seamless backdrop.", pose: "Looking straight past camera, chin level, arms relaxed.", beat: "off-beat" },
  { id: "profile_right",   label: "Right profile",       angle: "Side profile from the subject's right, matching studio lighting, seamless backdrop.", pose: "Head turned to the right, mouth softly closed, jaw set.", beat: "off-beat" },
  { id: "over_shoulder",   label: "Over-shoulder",       angle: "Over-the-shoulder shot from behind at 45°, subject looking back to camera, shallow depth of field.", pose: "Torso angled away, head turned back over the shoulder toward the lens.", beat: "off-beat" },
  { id: "low_hero",        label: "Low hero",            angle: "Low camera angle, tilted up, wide-ish lens, subject towering into the frame.", pose: "Feet planted shoulder-width, chest open, chin slightly lifted, calm superpower energy.", beat: "drop" },
  { id: "high_topdown",    label: "High top-down",       angle: "High angle from ~45° above, camera tilted down, background falling away behind the subject.", pose: "Looking straight up into the lens, arms loose, one hand near collar.", beat: "drop" },
  { id: "closeup_still",   label: "Close-up still",      angle: "Tight close-up on the face, cinematic shallow depth of field, sharp catchlights in the eyes.", pose: "Neutral direct-to-lens gaze, lips relaxed, subtle micro-smile.", beat: "breath" },
  { id: "closeup_look",    label: "Close-up look-away",  angle: "Tight close-up, subject looking off to camera-left as if reacting to something off-frame.", pose: "Eyes tracking off-frame, jaw set, controlled breathing.", beat: "breath" },
  { id: "three_quarter",   label: "3/4 turn",            angle: "Three-quarter turn shot, camera at eye level, half-body framing.", pose: "Body turned 45° from camera, head turned back to lens, hand near chest.", beat: "downbeat" },
  { id: "action_gesture",  label: "Action gesture",      angle: "Medium-wide shot capturing a mid-motion beat, slight motion blur on the hand, everything else crisp.", pose: "Mid-gesture: one hand rising toward the camera, other hand at side, mouth mid-word as if performing.", beat: "drop" },
  { id: "tail_walkaway",   label: "Tail walk-away",      angle: "Wide shot from behind as the subject walks away from camera down the length of the studio, backdrop softly out of focus.", pose: "Walking away from the lens, unbothered stride, head level.", beat: "tail" },
] as const;

/** Suggested clip length grid (seconds) at common BPM values. Purely
 *  informational for the UI — the render is a still, not a clip. */
export function beatWindowSec(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) return 0.5;
  return Math.max(0.15, Math.min(2, 60 / bpm));
}

export type ShootBrief = {
  /** Wardrobe + styling notes, held constant across every shot. */
  wardrobe: string;
  /** Environment/scene notes, held constant across every shot. */
  scene: string;
  /** Song / mood cue — folded into every prompt for tonal consistency. */
  song?: string;
  /** BPM — only used for UI beat timing; the render itself is a still. */
  bpm?: number;
};

/** Build the generation prompt for one shot of the deck. The reference image is
 *  authoritative; the brief and identity spec are supplementary context. The
 *  wording is deliberately clean/non-sexual — Aurora identity-lock providers
 *  reject prompts implying bare skin. */
export function buildShotPrompt(
  shot: ShootShot,
  brief: ShootBrief,
  spec: string | null,
): string {
  const bpmNote = brief.bpm
    ? ` This shot lands on the "${shot.beat}" beat of a ${brief.bpm} BPM track (~${beatWindowSec(brief.bpm).toFixed(2)}s window).`
    : "";
  const songNote = brief.song ? ` Song mood: ${brief.song}.` : "";

  const base =
    "Re-photograph the person in the attached reference image, who is the ABSOLUTE " +
    "source of truth for facial identity, likeness, hair, build and skin tone. " +
    "Keep the same face, hair, physique and vibe across every shot in this deck. " +
    `Wardrobe (identical across the entire shoot): ${brief.wardrobe}. ` +
    `Environment / studio (identical across the entire shoot): ${brief.scene}. ` +
    "Keep the wardrobe, environment and lighting IDENTICAL from shot to shot — " +
    "this is a music-video studio shoot; only the camera and pose change. " +
    `Shot: ${shot.label}. Camera: ${shot.angle} Pose: ${shot.pose}` +
    bpmNote + songNote +
    " Output a single photorealistic 9:16 vertical portrait (tall, full-height). " +
    "Subject is fully clothed at all times. No exposed skin beyond hands, neck and face. " +
    "No nudity, no lingerie, no sexualized posing. No text, watermarks, logos or borders.";

  return spec
    ? `${base}\n\nIdentity spec (secondary — the reference image wins any conflict):\n${spec}`
    : base;
}
