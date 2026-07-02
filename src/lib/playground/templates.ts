// Starter templates for the code playground, plus the ambient type definitions
// Monaco uses so `aurora.` autocompletes inside the editor.

export type PlaygroundTemplate = {
  id: string;
  label: string;
  description: string;
  code: string;
};

/** Ambient d.ts injected into Monaco for autocomplete inside scripts. */
export const AURORA_DTS = `
/** Result of a generation call. */
interface AuroraResult {
  ok: boolean;
  /** URL of the generated asset (image/video/audio) or text output. */
  url?: string;
  /** Text output for kind:"text" runs. */
  text?: string;
  /** Aura actually charged for this generation. */
  creditsCost?: number;
  /** True when a video ran as a cheap 480p preview (confirm to run full quality). */
  preview?: boolean;
  /** Pass as confirmPreviewId to re-run the SAME video at full quality. */
  previewGenerationId?: string;
  [key: string]: unknown;
}

interface AuroraGenerateOptions {
  /** What to make: "image" | "video" | "lipsync" | "text" | "audio". */
  kind: string;
  prompt?: string;
  /** Model id, e.g. "google/nano-banana", "seedance-2.0-fast". */
  model?: string;
  /** "480p" | "720p" | "1080p" | "2160p" */
  resolution?: string;
  durationSeconds?: number;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  /** Re-run a previewed video at full quality. */
  confirmPreviewId?: string;
  [key: string]: unknown;
}

/** A job in the Aurora render queue. */
interface AuroraJob {
  id: string;
  kind: string;
  /** "queued" | "processing" | "succeeded" | "failed" | "cancelled" */
  status: string;
  attempts: number;
  error?: string | null;
  generation_id?: string | null;
  created_at: string;
  finished_at?: string | null;
  /** Present once the job succeeds — includes the output URL. */
  result?: { url?: string; [key: string]: unknown } | null;
  [key: string]: unknown;
}

interface AuroraJobSubmitOptions {
  /** What to queue: "image" | "video" | "lipsync" | "upscale". */
  kind: string;
  prompt?: string;
  imageUrls?: string[];
  audioUrl?: string;
  videoUrl?: string;
  duration?: number;
  /** "480p" | "720p" | "1080p" | "2160p" */
  resolution?: string;
  model?: string;
  /** Re-run a previewed temporal render at full quality. */
  confirmPreviewId?: string;
  [key: string]: unknown;
}

/** Pre-authenticated Aurora client — every call spends YOUR Aura balance. */
declare const aurora: {
  /** Full-control generation call (hits /api/public/generate as you). */
  generate(options: AuroraGenerateOptions): Promise<AuroraResult>;
  /** Shorthand: generate an image from a prompt. */
  image(prompt: string, options?: Partial<AuroraGenerateOptions>): Promise<AuroraResult>;
  /** Shorthand: generate a video ({ prompt, imageUrl?, model?, ... }). */
  video(options: Partial<AuroraGenerateOptions>): Promise<AuroraResult>;
  /** Shorthand: lip-sync ({ audioUrl, imageUrl | videoUrl, ... }). */
  lipsync(options: Partial<AuroraGenerateOptions>): Promise<AuroraResult>;
  /** Shorthand: text generation (free-form LLM helper). */
  text(prompt: string, options?: Partial<AuroraGenerateOptions>): Promise<AuroraResult>;
  /** Background render queue — submit now, poll for the finished result. */
  jobs: {
    /** Queue a render (reserves Aura up front). Returns { jobId, generationId, preview }. */
    submit(options: AuroraJobSubmitOptions): Promise<{ jobId: string; generationId: string; preview: boolean }>;
    /** Your 50 most recent jobs, newest first. */
    list(): Promise<AuroraJob[]>;
    /** One job by id (or null if not found). */
    get(id: string): Promise<AuroraJob | null>;
    /** Cancel a still-queued job and release its reserved Aura. */
    cancel(id: string): Promise<{ ok: true }>;
    /** Poll until the job finishes. onTick fires on every poll. */
    wait(id: string, options?: { intervalMs?: number; timeoutMs?: number; onTick?: (job: AuroraJob) => void }): Promise<AuroraJob>;
  };
  /** Report batch progress — renders a progress bar in the console panel. */
  progress(current: number, total: number, label?: string): void;
  /** Show an asset card in the console panel (image/video/audio preview). */
  show(url: string, label?: string, kind?: string): void;
  /** Pause the script for the given number of milliseconds. */
  sleep(ms: number): Promise<void>;
};
`;

export const TEMPLATES: PlaygroundTemplate[] = [
  {
    id: "hello",
    label: "Hello Aurora",
    description: "The basics: logs, one 1-Aura image, showing the result.",
    code: `// Welcome to the Aurora Playground.
// Scripts run in a sandbox in YOUR browser — every aurora.* call
// spends from your real Aura balance, exactly like the Studio.

console.log("Generating one image (1 Aura)…");

const res = await aurora.image("a tiny astronaut sticker, bold outlines, white background");

console.log("Done — cost:", res.creditsCost, "Aura");
aurora.show(res.url, "Tiny astronaut", "image");
`,
  },
  {
    id: "variations",
    label: "Batch: prompt variations",
    description: "Generate N variations of one concept with a progress bar.",
    code: `// Generate a small batch of image variations.
// Cost: 1 Aura per image — raise COUNT once you like the results.
const COUNT = 3;
const CONCEPT = "album cover, retro-futuristic synthwave city";
const ANGLES = [
  "wide shot at golden hour",
  "neon-soaked night, rain reflections",
  "minimalist poster style, bold typography",
  "aerial view, dramatic clouds",
  "close-up detail, chrome and glass",
];

for (let i = 0; i < COUNT; i++) {
  const prompt = CONCEPT + ", " + ANGLES[i % ANGLES.length];
  aurora.progress(i, COUNT, prompt);
  const res = await aurora.image(prompt);
  aurora.show(res.url, "Variation " + (i + 1), "image");
  console.log("#" + (i + 1), "→", res.creditsCost, "Aura");
}
aurora.progress(COUNT, COUNT, "All variations done");
console.log("Batch complete.");
`,
  },
  {
    id: "image-to-video",
    label: "Image → video pipeline",
    description: "Make a still, then animate it (video runs as a cheap 480p preview first).",
    code: `// Two-stage pipeline: still image → animated clip.
// Videos run as a cheap 480p / 5s PREVIEW first; re-run the same call
// with confirmPreviewId to get full quality.

aurora.progress(0, 2, "Generating the still…");
const still = await aurora.image(
  "product shot of a glass perfume bottle on wet stone, soft window light"
);
aurora.show(still.url, "Base still", "image");

aurora.progress(1, 2, "Animating (480p preview)…");
const clip = await aurora.video({
  prompt: "slow cinematic push-in, mist drifting, light shifting",
  imageUrl: still.url,
  model: "seedance-2.0-fast",
});
aurora.show(clip.url, clip.preview ? "Video (preview) — confirm to render full quality" : "Video", "video");
aurora.progress(2, 2, "Pipeline done");

if (clip.preview) {
  console.log("Preview cost:", clip.creditsCost, "Aura");
  console.log("To render FULL quality, call aurora.video again with:");
  console.log("  confirmPreviewId:", clip.previewGenerationId);
}
`,
  },
  {
    id: "prompt-writer",
    label: "AI prompt writer",
    description: "Use the text model to write prompts, then render the best one.",
    code: `// Let the text model brainstorm prompts, then render one.
const brief = "moody jazz club poster for an indie artist";

console.log("Asking the text model for prompt ideas…");
const ideas = await aurora.text(
  "Write 3 short, vivid image-generation prompts for: " + brief +
  ". One per line, no numbering."
);
console.log(ideas.text ?? ideas.url ?? "(no output)");

const first = String(ideas.text ?? "").split("\\n").map(s => s.trim()).filter(Boolean)[0];
if (!first) throw new Error("The text model returned no usable prompt");

console.log("Rendering:", first);
const img = await aurora.image(first);
aurora.show(img.url, "Rendered from AI prompt", "image");
console.log("Cost:", img.creditsCost, "Aura");
`,
  },
  {
    id: "job-queue",
    label: "Job queue: submit & poll",
    description: "Queue renders in the background, then poll until they finish.",
    code: `// The job queue renders in the background — submit now, poll later.
// Aura is reserved when you submit and settled when the job finishes.

const PROMPTS = [
  "isometric cutaway of a cozy recording studio",
  "isometric cutaway of a neon arcade at night",
];

// 1) Submit everything up front.
const submitted = [];
for (const prompt of PROMPTS) {
  const job = await aurora.jobs.submit({ kind: "image", prompt });
  console.log("Queued", job.jobId.slice(0, 8), "→", prompt);
  submitted.push({ id: job.jobId, prompt });
}

// 2) Poll each job until it finishes.
for (let i = 0; i < submitted.length; i++) {
  const { id, prompt } = submitted[i];
  aurora.progress(i, submitted.length, "Waiting on " + id.slice(0, 8) + "…");
  const done = await aurora.jobs.wait(id, {
    intervalMs: 3000,
    onTick: (j) => console.log(id.slice(0, 8), "status:", j.status),
  });
  if (done.status === "succeeded" && done.result && done.result.url) {
    aurora.show(done.result.url, prompt, "image");
  } else {
    console.error(id.slice(0, 8), "ended as", done.status, done.error ?? "");
  }
}
aurora.progress(submitted.length, submitted.length, "Queue drained");

// Tip: aurora.jobs.list() shows your 50 latest jobs;
// aurora.jobs.cancel(id) frees the Aura of a still-queued job.
`,
  },
];

export const DEFAULT_TEMPLATE_ID = "hello";

export function getTemplate(id: string): PlaygroundTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
