import { gradeCss, tintRgba } from "@/lib/scene-weaver-grade";
import type { Grade } from "@/lib/scene-weaver-types";

export function GradedImage({ src, grade, alt = "" }: { src: string; grade: Grade; alt?: string }) {
  return (
    <span className="relative block h-full w-full overflow-hidden">
      <img src={src} alt={alt} className="h-full w-full object-cover" style={{ filter: gradeCss(grade) }} />
      <span className="pointer-events-none absolute inset-0" style={{ background: tintRgba(grade), opacity: grade.diffusion ? .35 : 0 }} />
      <span className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 ${grade.vignette / 2}px rgba(0,0,0,${grade.vignette / 150})` }} />
    </span>
  );
}