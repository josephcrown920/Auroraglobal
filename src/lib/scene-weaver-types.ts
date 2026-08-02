export type AssetKind = "source" | "plate" | "angle";

export interface Grade {
  exposure: number;
  contrast: number;
  saturation: number;
  temp: number;
  hue: number;
  diffusion: number;
  vignette: number;
}

export const NEUTRAL_GRADE: Grade = {
  exposure: 1,
  contrast: 1,
  saturation: 1,
  temp: 0,
  hue: 0,
  diffusion: 0,
  vignette: 0,
};

export interface GalleryEntry {
  id: string;
  itemId: string;
  itemName: string;
  kind: AssetKind;
  label: string;
  src: string;
  grade: Grade;
}

export interface Shot {
  id: string;
  src: string;
  name: string;
  caption: string;
  shotType: string;
  selected: boolean;
  grade: Grade;
}

export interface Clip {
  id: string;
  src: string;
  name: string;
  duration: number;
  grade: Grade;
}

export const SHOT_TYPES = [
  "Establishing",
  "Wide",
  "Medium",
  "Close-up",
  "Insert",
  "Over-the-shoulder",
  "Aerial",
  "POV",
];