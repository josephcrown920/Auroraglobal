import shot1 from "@/assets/showcase-1.jpg";
import shot5 from "@/assets/showcase-5.jpg";

export type Recipe = {
  id: string;
  title: string;
  tag: string;
  blurb: string;
  /** Poster image (always present — used as <video poster> when video is set). */
  image: string;
  /** Optional CDN video URL — when present the tile renders a looping muted clip. */
  video?: string;
  steps: string[];
  prompt: string;
};

export const RECIPES: Recipe[] = [
  {
    id: "colors",
    title: "Colors-style performance",
    tag: "Wide · Hot Pink",
    blurb:
      "The iconic Colors Show look: bold single-color cyclorama, vintage hanging mic, full-body performance pose. Drop a selfie and you're on the wall.",
    image: shot1,
    steps: [
      "Pick a backdrop color (hot pink, royal blue, sunset orange).",
      "Upload a selfie — or use ours.",
      "Aurora stages the cyclorama, mic, lighting, and platform.",
    ],
    prompt:
      "Place the subject into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use an exact suspended vintage studio microphone — photoreal shape, size, material, cable — hanging from ceiling at chest level. Environment is a seamless hot pink cyclorama studio — background and floor are one continuous hot pink color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the hot pink tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.",
  },
  {
    id: "urban-cuts",
    title: "Urban cuts",
    tag: "Street · Cinematic",
    blurb:
      "Gritty urban storytelling — alley, subway, crosswalk. Wet pavement, anamorphic flares, ARRI color science. The look that prints on a music-video billboard.",
    image: shot5,
    steps: [
      "Selfie locks identity, outfit reference locks wardrobe.",
      "Pick an Urban preset (Alley, Subway, Crosswalk) or stack them.",
      "Re-angle for a side profile, then animate with Seedance.",
    ],
    prompt:
      "Cinematic urban street portrait of the subject — wet pavement reflecting neon and street lamps, brick walls and graffiti softly out of focus, a single hard key light from above with deep shadows, anamorphic lens flares, 35mm ARRI Alexa look, filmic grain. Preserve exact facial likeness, outfit, beard, hairstyle, and proportions. Shallow depth of field with the subject tack-sharp, gritty editorial music-video mood, 4K photoreal quality, no text or logos.",
  },
];
