// Real per-color COLORS-style studio environments — one bold seamless
// cyclorama set per color preset, each with a short subtle looping motion clip
// (drifting haze + gentle light shift) and a matched first-frame poster.
//
// Generated assets live under src/assets/colors-studios/loops/<id>.{mp4,jpg}.
// The poster is the video's first frame, so the poster → video hand-off is
// seamless. Reduced-motion users get the poster still (see ColorStudioBackdrop).

import hotPinkLoop from "@/assets/colors-studios/loops/hot-pink.mp4";
import hotPinkPoster from "@/assets/colors-studios/loops/hot-pink.jpg";
import royalBlueLoop from "@/assets/colors-studios/loops/royal-blue.mp4";
import royalBluePoster from "@/assets/colors-studios/loops/royal-blue.jpg";
import neonGreenLoop from "@/assets/colors-studios/loops/neon-green.mp4";
import neonGreenPoster from "@/assets/colors-studios/loops/neon-green.jpg";
import sunsetOrangeLoop from "@/assets/colors-studios/loops/sunset-orange.mp4";
import sunsetOrangePoster from "@/assets/colors-studios/loops/sunset-orange.jpg";
import electricPurpleLoop from "@/assets/colors-studios/loops/electric-purple.mp4";
import electricPurplePoster from "@/assets/colors-studios/loops/electric-purple.jpg";
import cyberYellowLoop from "@/assets/colors-studios/loops/cyber-yellow.mp4";
import cyberYellowPoster from "@/assets/colors-studios/loops/cyber-yellow.jpg";
import crimsonRedLoop from "@/assets/colors-studios/loops/crimson-red.mp4";
import crimsonRedPoster from "@/assets/colors-studios/loops/crimson-red.jpg";
import iceWhiteLoop from "@/assets/colors-studios/loops/ice-white.mp4";
import iceWhitePoster from "@/assets/colors-studios/loops/ice-white.jpg";
import obsidianLoop from "@/assets/colors-studios/loops/obsidian.mp4";
import obsidianPoster from "@/assets/colors-studios/loops/obsidian.jpg";
import aquaLoop from "@/assets/colors-studios/loops/aqua.mp4";
import aquaPoster from "@/assets/colors-studios/loops/aqua.jpg";
import roseGoldLoop from "@/assets/colors-studios/loops/rose-gold.mp4";
import roseGoldPoster from "@/assets/colors-studios/loops/rose-gold.jpg";
import limePopLoop from "@/assets/colors-studios/loops/lime-pop.mp4";
import limePopPoster from "@/assets/colors-studios/loops/lime-pop.jpg";

export type ColorStudio = {
  /** Short, muted, auto-looping motion clip of the studio set. */
  loop: string;
  /** Matched first-frame poster (also the reduced-motion static fallback). */
  poster: string;
};

export const COLOR_STUDIOS: Record<string, ColorStudio> = {
  "hot-pink": { loop: hotPinkLoop, poster: hotPinkPoster },
  "royal-blue": { loop: royalBlueLoop, poster: royalBluePoster },
  "neon-green": { loop: neonGreenLoop, poster: neonGreenPoster },
  "sunset-orange": { loop: sunsetOrangeLoop, poster: sunsetOrangePoster },
  "electric-purple": { loop: electricPurpleLoop, poster: electricPurplePoster },
  "cyber-yellow": { loop: cyberYellowLoop, poster: cyberYellowPoster },
  "crimson-red": { loop: crimsonRedLoop, poster: crimsonRedPoster },
  "ice-white": { loop: iceWhiteLoop, poster: iceWhitePoster },
  obsidian: { loop: obsidianLoop, poster: obsidianPoster },
  aqua: { loop: aquaLoop, poster: aquaPoster },
  "rose-gold": { loop: roseGoldLoop, poster: roseGoldPoster },
  "lime-pop": { loop: limePopLoop, poster: limePopPoster },
};

/** Resolve a color id to its studio, falling back to royal-blue. */
export function getColorStudio(colorId: string): ColorStudio {
  return COLOR_STUDIOS[colorId] ?? COLOR_STUDIOS["royal-blue"];
}
