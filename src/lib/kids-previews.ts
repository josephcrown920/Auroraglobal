// Animated cartoon previews for the Kids Story Studio (/kids).
//
// Each preset character has a short, soft-storybook looping clip plus a matching
// still poster (the poster is extracted from the first frame, so it doubles as
// the reduced-motion fallback). Vite hashes/bundles these imports and applies
// the artifact base path automatically — see src/lib/colors.studios.ts for the
// same pattern.

import fuzzLoop from "@/assets/kids/fuzz.mp4";
import fuzzPoster from "@/assets/kids/fuzz.jpg";
import pipLoop from "@/assets/kids/pip.mp4";
import pipPoster from "@/assets/kids/pip.jpg";
import ollieLoop from "@/assets/kids/ollie.mp4";
import olliePoster from "@/assets/kids/ollie.jpg";
import sunnyLoop from "@/assets/kids/sunny.mp4";
import sunnyPoster from "@/assets/kids/sunny.jpg";
import showcaseBedtimeLoop from "@/assets/kids/showcase-bedtime.mp4";
import showcaseBedtimePoster from "@/assets/kids/showcase-bedtime.jpg";
import showcaseMeadowLoop from "@/assets/kids/showcase-meadow.mp4";
import showcaseMeadowPoster from "@/assets/kids/showcase-meadow.jpg";

export type CartoonClip = { loop: string; poster: string };

/** Keyed by KIDS_CHARACTERS id (see kids-story.server.ts). */
export const KIDS_CHARACTER_PREVIEWS: Record<string, CartoonClip> = {
  fuzz: { loop: fuzzLoop, poster: fuzzPoster },
  pip: { loop: pipLoop, poster: pipPoster },
  ollie: { loop: ollieLoop, poster: olliePoster },
  sunny: { loop: sunnyLoop, poster: sunnyPoster },
};

/** Finished-output samples shown so first-time visitors see what they'll get. */
export const KIDS_STORY_SHOWCASE: {
  id: string;
  title: string;
  blurb: string;
  clip: CartoonClip;
}[] = [
  {
    id: "bedtime",
    title: "Twinkle, the little star",
    blurb: "Bedtime · ages 3–5",
    clip: { loop: showcaseBedtimeLoop, poster: showcaseBedtimePoster },
  },
  {
    id: "meadow",
    title: "Pip & Ollie's meadow day",
    blurb: "Adventure · ages 5–8",
    clip: { loop: showcaseMeadowLoop, poster: showcaseMeadowPoster },
  },
];
