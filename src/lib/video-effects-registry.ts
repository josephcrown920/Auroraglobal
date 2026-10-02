export type VideoEffectCategory = "motion" | "optics" | "stylize" | "transition" | "composite";

export type VideoEffectDefinition = {
  id: string;
  label: string;
  category: VideoEffectCategory;
  implementation: string;
  defaults: Record<string, number | string | boolean>;
  description: string;
};

export const VIDEO_EFFECTS: readonly VideoEffectDefinition[] = [
  { id: "speed_ramp", label: "Speed Ramp", category: "motion", implementation: "speedRamp", defaults: { inSpeed: 1, peakSpeed: 0.4, outSpeed: 1, peakAt: 0.5 }, description: "Controlled acceleration/deceleration around a selected beat or action." },
  { id: "freeze_frame", label: "Freeze Frame", category: "motion", implementation: "freezeFrame", defaults: { duration: 0.6 }, description: "Hold a selected frame while the timeline continues." },
  { id: "motion_blur", label: "Motion Blur", category: "motion", implementation: "motionBlur", defaults: { intensity: 0.45 }, description: "Adds directional blur during fast movement or speed changes." },
  { id: "camera_push", label: "Camera Push", category: "motion", implementation: "cameraPush", defaults: { amount: 0.08, easing: "easeInOut" }, description: "Digital push-in for emphasis." },
  { id: "camera_pull", label: "Camera Pull", category: "motion", implementation: "cameraPull", defaults: { amount: 0.08, easing: "easeInOut" }, description: "Digital pull-back reveal." },
  { id: "parallax_depth", label: "Parallax Depth", category: "motion", implementation: "parallax", defaults: { amount: 0.06 }, description: "Depth-aware movement for still images and layered scenes." },
  { id: "bloom", label: "Bloom", category: "optics", implementation: "bloom", defaults: { threshold: 0.72, intensity: 0.25, radius: 8 }, description: "Soft highlight glow." },
  { id: "diffusion", label: "Diffusion", category: "optics", implementation: "diffusion", defaults: { amount: 0.18 }, description: "Softens highlights and creates an editorial lens feel." },
  { id: "vignette", label: "Vignette", category: "optics", implementation: "vignette", defaults: { amount: 0.28, softness: 0.65 }, description: "Edge darkening to focus attention." },
  { id: "film_grain", label: "Film Grain", category: "optics", implementation: "filmGrain", defaults: { amount: 0.16, size: 0.55 }, description: "Fine analog texture." },
  { id: "chromatic_aberration", label: "Chromatic Aberration", category: "optics", implementation: "chromaticAberration", defaults: { amount: 0.012 }, description: "Subtle RGB edge separation." },
  { id: "lens_flare", label: "Lens Flare", category: "optics", implementation: "lensFlare", defaults: { intensity: 0.35, positionX: 0.72, positionY: 0.25 }, description: "Controlled optical flare overlay." },
  { id: "sharpen", label: "Sharpen", category: "optics", implementation: "sharpen", defaults: { amount: 0.15 }, description: "Recovers perceived detail after transformations." },
  { id: "vhs", label: "VHS", category: "stylize", implementation: "vhs", defaults: { distortion: 0.25, noise: 0.18, scanlines: 0.12 }, description: "Analog tape degradation and scanline treatment." },
  { id: "neon_glow", label: "Neon Glow", category: "stylize", implementation: "neonGlow", defaults: { intensity: 0.3, threshold: 0.65 }, description: "Colored highlight glow for music-video looks." },
  { id: "noir", label: "Noir", category: "stylize", implementation: "noir", defaults: { contrast: 1.25, saturation: 0 }, description: "High-contrast monochrome treatment." },
  { id: "rgb_split", label: "RGB Split", category: "stylize", implementation: "rgbSplit", defaults: { amount: 0.008 }, description: "Stylized channel separation for transitions." },
  { id: "dip_black", label: "Dip to Black", category: "transition", implementation: "dipToBlack", defaults: { duration: 0.3 }, description: "Editorial fade transition." },
  { id: "whip", label: "Whip Transition", category: "transition", implementation: "whip", defaults: { duration: 0.25, direction: "right" }, description: "Directional motion transition." },
  { id: "glitch", label: "Glitch", category: "transition", implementation: "glitch", defaults: { duration: 0.22, intensity: 0.4 }, description: "Digital corruption transition." },
  { id: "flash", label: "Flash", category: "transition", implementation: "flash", defaults: { duration: 0.12, intensity: 0.8 }, description: "Beat-synced flash transition." },
  { id: "mask", label: "Mask", category: "composite", implementation: "mask", defaults: { feather: 0.12 }, description: "Feathered compositing mask." },
  { id: "blend_overlay", label: "Overlay Blend", category: "composite", implementation: "blendOverlay", defaults: { opacity: 0.35 }, description: "Texture/light overlay compositing." },
] as const;

export function getVideoEffect(id: string) {
  return VIDEO_EFFECTS.find((effect) => effect.id === id);
}
