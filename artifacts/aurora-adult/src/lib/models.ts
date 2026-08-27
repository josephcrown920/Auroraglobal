// ── Shared model roster ────────────────────────────────────────────────────────
// Models are visible to ALL signed-in creators.
// Individual generation history is scoped privately per user via Supabase RLS.

const BASE = import.meta.env.BASE_URL ?? "/aurora-adult/";

export interface Model {
  id: string;
  name: string;
  /** @handle used by the Assistant to resolve "@name" mentions and roster search. */
  handle: string;
  niche: string;
  /** Public photos used as identity anchors — fetched by the generate call. */
  photos: string[];
  /** Card cover shown in the model grid. */
  cover: string;
  tag?: string;
}

export const MODELS: Model[] = [
  {
    id: "yuki",
    name: "Yuki",
    handle: "yuki",
    niche: "Fashion · Editorial",
    cover: `${BASE}models/model-yuki-1.jpg`,
    photos: [
      `${BASE}models/model-yuki-1.jpg`,
      `${BASE}models/model-yuki-2.jpg`,
    ],
    tag: "Featured",
  },
  {
    id: "lily",
    name: "Lily",
    handle: "lily",
    niche: "Travel · Outdoor",
    cover: `${BASE}eromify/avatar-lily.jpg`,
    photos: [`${BASE}eromify/avatar-lily.jpg`],
  },
  {
    id: "aria",
    name: "Aria",
    handle: "aria",
    niche: "Lifestyle",
    cover: `${BASE}eromify/avatar-aria.jpg`,
    photos: [`${BASE}eromify/avatar-aria.jpg`],
  },
  {
    id: "maya",
    name: "Maya",
    handle: "maya",
    niche: "Beauty · Glam",
    cover: `${BASE}eromify/avatar-maya.jpg`,
    photos: [`${BASE}eromify/avatar-maya.jpg`],
  },
];

export function getModel(id: string): Model | undefined {
  return MODELS.find((m) => m.id === id);
}

/** Resolves a bare name or "@handle" mention (case-insensitive) to a roster model. */
export function resolveModelMention(mention: string): Model | undefined {
  const clean = mention.replace(/^@/, "").trim().toLowerCase();
  return MODELS.find((m) => m.handle === clean || m.name.toLowerCase() === clean);
}

// ── Look presets ───────────────────────────────────────────────────────────────
export const LOOKS = [
  {
    id: "boudoir",
    label: "Boudoir",
    swatch: "from-rose-700 to-rose-950",
    prompt:
      "Magazine-grade boudoir editorial portrait — luxurious silk sheets, soft morning window light, warm amber glow, intimate but tasteful composition. Preserve facial likeness exactly. ARRI cinema look, 85mm f/1.4, 8K ultra-HD.",
  },
  {
    id: "velvet",
    label: "Velvet",
    swatch: "from-violet-700 to-violet-950",
    prompt:
      "Cinematic editorial portrait in deep velvet surroundings — velvet chaise, rich jewel-tone colors, atmospheric side lighting, dramatic shadows. Preserve facial likeness. 50mm anamorphic, 8K ultra-HD.",
  },
  {
    id: "golden",
    label: "Golden Hour",
    swatch: "from-amber-600 to-amber-950",
    prompt:
      "Golden hour outdoor editorial — warm backlit rim light, soft bokeh background, glowing skin, sun-kissed look. Preserve facial likeness exactly. 85mm shallow DOF, 8K ultra-HD cinematic.",
  },
  {
    id: "neon",
    label: "Neon",
    swatch: "from-fuchsia-600 to-pink-950",
    prompt:
      "Moody neon-lit editorial portrait — Blade Runner color palette with magenta and cyan gels, atmospheric haze, wet reflections. Preserve facial likeness. 35mm anamorphic, 8K ultra-HD.",
  },
  {
    id: "luxury",
    label: "Luxury Suite",
    swatch: "from-stone-600 to-stone-950",
    prompt:
      "Five-star hotel suite editorial — marble surfaces, designer furnishings, warm chandelier light, aspirational editorial look. Preserve facial likeness exactly. 50mm, 8K ultra-HD.",
  },
  {
    id: "noir",
    label: "Noir",
    swatch: "from-gray-600 to-gray-950",
    prompt:
      "Classic film noir editorial portrait — high contrast black and white, single hard spotlight, venetian blind shadow patterns, old Hollywood glamour. Preserve facial likeness. 50mm, 8K ultra-HD.",
  },
  {
    id: "ethereal",
    label: "Ethereal",
    swatch: "from-purple-600 to-indigo-950",
    prompt:
      "Ethereal high-key editorial portrait — soft diffused light, dreamy atmosphere, white and cream tones, delicate shadows, angelic editorial look. Preserve facial likeness exactly. 85mm f/1.2, 8K ultra-HD.",
  },
  {
    id: "power",
    label: "Power",
    swatch: "from-red-600 to-red-950",
    prompt:
      "Bold power editorial portrait — strong directional dramatic lighting, high contrast, confident pose framing, fashion magazine cover quality. Preserve facial likeness. 50mm, 8K ultra-HD.",
  },
] as const;

export type LookId = (typeof LOOKS)[number]["id"];
