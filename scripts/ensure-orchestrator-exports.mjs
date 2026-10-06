import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/orchestrator.server.ts";
const source = await readFile(path, "utf8");

// Keep the source/runtime contract intact when a partial merge has dropped the
// free-mode guard exports. This is intentionally idempotent: once the exports
// exist, the build does nothing.
if (!source.includes("export async function assertFreeModeServable")) {
  const patch = `\n\n// ─── Free-GPU-only guard (build-time compatibility repair) ────────────────────\n// Kept here because studio/lipsync server functions import this guard directly.\n// Paid adapters must never be reached while free-GPU-only mode is enabled.\nimport { isFreeGpuOnlyMode } from "./app-settings.server";\n\nexport const FREE_MODE_NO_WORKER_MSG =\n  "Free GPU only mode is on — start a GPU worker for this operation before trying again.";\n\nexport async function assertFreeModeServable(kind: GenerateKind): Promise<void> {\n  if (!(await isFreeGpuOnlyMode())) return;\n\n  // Images have the existing $0 hosted path and therefore do not require a\n  // self-hosted worker. Temporal workloads must have an active GPU worker.\n  if (kind === "image") return;\n\n  if (await hasActiveWorkerForKind(kind)) return;\n\n  throw new Error(FREE_MODE_NO_WORKER_MSG);\n}\n`;
  await writeFile(path, source + patch, "utf8");
  console.log("[aurora] restored missing free-mode exports in orchestrator.server.ts");
} else {
  console.log("[aurora] free-mode exports already present");
}
