import { createFileRoute } from "@tanstack/react-router";
import { VIDEO_PRESET_IDS, CINEMATIC_PRESET_IDS, VIRAL_PRESET_IDS } from "../../../lib/byteplus-agent/presets";
import { VIDEO_WORKFLOWS } from "../../../lib/byteplus-agent/workflow-registry";

export const Route = createFileRoute("/api/video-agent/capabilities")({
  server: { handlers: { GET: async () => Response.json({ provider: "modelark", workflows: Object.values(VIDEO_WORKFLOWS), presets: VIDEO_PRESET_IDS, cinematicPresets: CINEMATIC_PRESET_IDS, viralPresets: VIRAL_PRESET_IDS }) } },
});
