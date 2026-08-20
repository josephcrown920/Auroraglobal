import { buildSequencePrompt, sequence, shotCode, type Shot } from "@/lib/storyboard";

export type LayerProject = {
  id: string;
  name: string;
  prompt: string;
  model: string;
  createdAt: number;
  sourceUrl?: string;
  characterId?: string;
  characterName?: string;
  characterVersion?: number;
  layers: Shot[];
};

const KEY = "aurora.projects.v1";

function safeParse(raw: string | null): LayerProject[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    // migrate legacy projects whose layers had no explicit order
    return (v as LayerProject[]).map((p) => ({ ...p, layers: sequence(p.layers ?? []) }));
  } catch {
    return [];
  }
}

export function loadProjects(): LayerProject[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY)).sort((a, b) => b.createdAt - a.createdAt);
}

export function saveProject(project: LayerProject): LayerProject[] {
  const all = loadProjects().filter((p) => p.id !== project.id);
  const next = [project, ...all].slice(0, 12); // keep storage sane
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // quota: drop the oldest and retry once
    const trimmed = next.slice(0, 4);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    return trimmed;
  }
  return next;
}

export function deleteProject(id: string): LayerProject[] {
  const next = loadProjects().filter((p) => p.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function dataUrlToBase64(dataUrl: string) {
  return dataUrl.split(",")[1] ?? "";
}

export async function exportProjectZip(project: LayerProject) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "project";
  const shots = sequence(project.layers);

  if (project.sourceUrl) {
    zip.file(`${slug}/00-source.png`, dataUrlToBase64(project.sourceUrl), { base64: true });
  }
  shots.forEach((shot) => {
    zip.file(`${slug}/${shotCode(shot.order)}.png`, dataUrlToBase64(shot.dataUrl), { base64: true });
  });
  const last = shots[shots.length - 1];
  if (last) {
    zip.file(`${slug}/final-composite.png`, dataUrlToBase64(last.dataUrl), { base64: true });
  }
  zip.file(
    `${slug}/storyboard.txt`,
    buildSequencePrompt(
      shots,
      project.characterName
        ? `CHARACTER: ${project.characterName} · bible v${project.characterVersion ?? 1}`
        : "",
    ),
  );
  zip.file(
    `${slug}/recipe.txt`,
    [
      `Aurora Performance Studio — ${project.name}`,
      `Image engine: ${project.model}`,
      project.characterName
        ? `Character bible: ${project.characterName} v${project.characterVersion ?? 1}`
        : "Character bible: none",
      `Created: ${new Date(project.createdAt).toISOString()}`,
      "",
      ...shots.map((s) => `${shotCode(s.order)} ${s.beat ? `[${s.beat}] ` : ""}${s.prompt}`),
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, `${slug}.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
