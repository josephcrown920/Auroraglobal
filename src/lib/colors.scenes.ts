// Photoreal scene-set previews for the non-cyclorama Colors Studio setups
// (indoor / outdoor / street). One hyper-real, ultra-HD empty set per setup —
// the UI lays the selected color over it as a gel wash so every swatch
// previews the scene in its own color.
//
// Cyclorama setups (performance / studio kinds) use the real per-color
// animated studio sets from colors.studios.ts instead.

import indoorBedroom from "@/assets/colors-studios/scenes/indoor-bedroom.jpg";
import indoorKitchen from "@/assets/colors-studios/scenes/indoor-kitchen.jpg";
import indoorLounge from "@/assets/colors-studios/scenes/indoor-lounge.jpg";
import rooftop from "@/assets/colors-studios/scenes/rooftop.jpg";
import rooftopNight from "@/assets/colors-studios/scenes/rooftop-night.jpg";
import neonStreet from "@/assets/colors-studios/scenes/neon-street.jpg";
import alley from "@/assets/colors-studios/scenes/alley.jpg";

export const SETUP_SCENES: Record<string, string> = {
  "indoor-bedroom": indoorBedroom,
  "indoor-kitchen": indoorKitchen,
  "indoor-lounge": indoorLounge,
  rooftop,
  "rooftop-night": rooftopNight,
  "neon-street": neonStreet,
  alley,
};

/** Resolve a setup id to its photoreal scene still (undefined for cyclorama setups). */
export function getSetupScene(setupId: string): string | undefined {
  return SETUP_SCENES[setupId];
}
