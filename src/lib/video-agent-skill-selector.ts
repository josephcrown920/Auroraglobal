import { CINEMATIC_SHOT_PROMPT, CINEMATIC_SYSTEM_PROMPT, SEEDANCE_REFERENCE_GUIDE } from "./video-agent-skills";

export type VideoSkill = { id: string; prompt: string };

const SKILLS: VideoSkill[] = [
  { id: "cinematic-director", prompt: CINEMATIC_SYSTEM_PROMPT },
  { id: "cinematic-shot-engineering", prompt: CINEMATIC_SHOT_PROMPT },
  { id: "seedance-reference-system", prompt: SEEDANCE_REFERENCE_GUIDE },
];

export function selectVideoSkills(instruction: string): VideoSkill[] {
  const text = instruction.toLowerCase();
  const selected = SKILLS.filter((skill) => {
    if (skill.id === "seedance-reference-system") return /seedance|reference|first frame|last frame|start frame|end frame|image|video asset/.test(text);
    if (skill.id === "cinematic-shot-engineering") return /shot|scene|camera|lens|lighting|cinematic|storyboard|music video|commercial/.test(text);
    return true;
  });
  return selected.length ? selected : SKILLS.slice(0, 1);
}
