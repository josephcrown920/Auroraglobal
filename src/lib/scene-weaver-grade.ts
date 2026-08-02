import type { Grade } from "./scene-weaver-types";
export type { Grade } from "./scene-weaver-types";
export { NEUTRAL_GRADE } from "./scene-weaver-types";

export const PRESETS = [
  { key: "neutral", label: "Neutral", blurb: "Straight off the plate.", grade: { exposure: 1, contrast: 1, saturation: 1, temp: 0, hue: 0, diffusion: 0, vignette: 0 } },
  { key: "night-teal", label: "Night Teal", blurb: "Cool shadows and crushed blacks.", grade: { exposure: .96, contrast: 1.18, saturation: 1.05, temp: -32, hue: -6, diffusion: 12, vignette: 34 } },
  { key: "warm-film", label: "Warm Film", blurb: "Golden highlights and soft roll-off.", grade: { exposure: 1.05, contrast: 1.08, saturation: 1.12, temp: 36, hue: 3, diffusion: 18, vignette: 20 } },
  { key: "noir", label: "Noir", blurb: "Graphic monochrome contrast.", grade: { exposure: .98, contrast: 1.42, saturation: 0, temp: -8, hue: 0, diffusion: 8, vignette: 46 } },
  { key: "neon", label: "Neon City", blurb: "Saturated magenta and cyan.", grade: { exposure: 1, contrast: 1.22, saturation: 1.45, temp: -18, hue: 12, diffusion: 26, vignette: 30 } },
] satisfies Array<{ key: string; label: string; blurb: string; grade: Grade }>;

export function presetByKey(key: string) {
  return PRESETS.find((preset) => preset.key === key);
}

export function gradeCss(g: Grade) {
  return `brightness(${g.exposure}) contrast(${g.contrast}) saturate(${g.saturation}) hue-rotate(${g.hue}deg)`;
}

export function tintRgba(g: Grade) {
  const alpha = Math.min(.35, Math.abs(g.temp) / 100 * .35);
  if (!alpha) return "transparent";
  return g.temp > 0 ? `rgba(255,168,74,${alpha})` : `rgba(74,150,255,${alpha})`;
}

export function drawGraded(ctx: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number, g: Grade) {
  ctx.save();
  ctx.filter = gradeCss(g);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.filter = "none";
  if (g.diffusion > 0) {
    ctx.globalAlpha = Math.min(.5, g.diffusion / 200);
    ctx.filter = `blur(${Math.max(2, g.diffusion / 100 * Math.min(w, h) / 40)}px)`;
    ctx.drawImage(img, 0, 0, w, h);
  }
  ctx.restore();
}