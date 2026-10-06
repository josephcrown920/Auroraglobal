export type PerformanceAngle = "wide" | "closeup";
export type PerformancePlate = {
  url: string;
  generationId: string;
  approved: boolean;
};
export type PerformanceClip = {
  generationId: string;
  jobId: string;
  previewId: string | null;
};

export type PerformanceWorkflowDraft = {
  version: 1;
  step: number;
  mode: "colors" | "anywhere";
  subjectUrl: string | null;
  wideReferenceUrl: string | null;
  closeupReferenceUrl: string | null;
  outfitReferenceUrl: string | null;
  colorId: string;
  outfit: string;
  location: string;
  widePlate: PerformancePlate | null;
  closeupPlate: PerformancePlate | null;
  wideVideoUrl: string | null;
  closeupVideoUrl: string | null;
  audioUrl: string | null;
  widePrompt: string;
  closeupPrompt: string;
  wideClip: PerformanceClip | null;
  closeupClip: PerformanceClip | null;
};

const PREFIX = "aurora.performance-workflow.v1.";

export function emptyPerformanceWorkflow(mode: PerformanceWorkflowDraft["mode"] = "colors"): PerformanceWorkflowDraft {
  return {
    version: 1,
    step: 0,
    mode,
    subjectUrl: null,
    wideReferenceUrl: null,
    closeupReferenceUrl: null,
    outfitReferenceUrl: null,
    colorId: "obsidian",
    outfit: "",
    location: "",
    widePlate: null,
    closeupPlate: null,
    wideVideoUrl: null,
    closeupVideoUrl: null,
    audioUrl: null,
    widePrompt: "Preserve the real performance faithfully with natural body motion and locked camera framing.",
    closeupPrompt: "Preserve facial identity and lip detail with subtle, faithful performance motion and locked framing.",
    wideClip: null,
    closeupClip: null,
  };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isPlate(value: unknown): value is PerformancePlate {
  if (value === null) return false;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.url === "string" && typeof row.generationId === "string" && typeof row.approved === "boolean";
}

function isClip(value: unknown): value is PerformanceClip {
  if (value === null) return false;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.generationId === "string" && typeof row.jobId === "string" && isNullableString(row.previewId);
}

export function parsePerformanceWorkflow(value: unknown): PerformanceWorkflowDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const mode = row.mode === "anywhere" ? "anywhere" : row.mode === "colors" ? "colors" : null;
  const nullableKeys = [
    "subjectUrl",
    "wideReferenceUrl",
    "closeupReferenceUrl",
    "outfitReferenceUrl",
    "wideVideoUrl",
    "closeupVideoUrl",
    "audioUrl",
  ] as const;
  if (
    row.version !== 1 ||
    !mode ||
    !Number.isInteger(row.step) ||
    (row.step as number) < 0 ||
    !nullableKeys.every((key) => isNullableString(row[key])) ||
    typeof row.colorId !== "string" ||
    typeof row.outfit !== "string" ||
    typeof row.location !== "string" ||
    typeof row.widePrompt !== "string" ||
    typeof row.closeupPrompt !== "string" ||
    !(row.widePlate === null || isPlate(row.widePlate)) ||
    !(row.closeupPlate === null || isPlate(row.closeupPlate)) ||
    !(row.wideClip === null || isClip(row.wideClip)) ||
    !(row.closeupClip === null || isClip(row.closeupClip))
  ) return null;
  return row as PerformanceWorkflowDraft;
}

export function loadPerformanceWorkflow(userId: string): PerformanceWorkflowDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${PREFIX}${userId}`);
    return raw ? parsePerformanceWorkflow(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function savePerformanceWorkflow(userId: string, draft: PerformanceWorkflowDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(draft));
  } catch {
    // The generated media remains server-persisted even if browser storage is unavailable.
  }
}

export function clearPerformanceWorkflow(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${PREFIX}${userId}`);
  } catch {
    // Nothing to clear.
  }
}