import {
  COST_TIKTOK_REMIX_CUT,
  LIPSYNC_TIER_AURA,
  computeCost,
} from "./pricing";

export type ToolDirectoryItem = {
  number: string;
  name: string;
  label?: string;
  description: string;
  price: string;
  to:
    | "/motion"
    | "/colors"
    | "/spin"
    | "/video-agent"
    | "/music-video"
    | "/lipsync"
    | "/canvas"
    | "/layers";
};

/** Shared live-tool metadata used by the landing directory and Studio shortcuts. */
export const TOOL_DIRECTORY: ReadonlyArray<ToolDirectoryItem> = [
  {
    number: "00",
    name: "Perform Anywhere",
    label: "Flagship",
    description: "Phone performance → cinematic scene",
    price: `From ${computeCost({ features: ["video", "motion"], model: "seedance-2.0-fast" }).total} Aura`,
    to: "/motion",
  },
  {
    number: "01",
    name: "Performance Studio",
    label: "Motion",
    description: "Transfer your performance into a new character, outfit, and scene",
    price: `From ${computeCost({ features: ["video", "motion"], model: "seedance-2.0-fast" }).total} Aura`,
    to: "/motion",
  },
  {
    number: "02",
    name: "Music Video",
    label: "Director",
    description: "Build cinematic music-video shots from your song and references",
    price: `From ${computeCost({ features: ["video"], model: "seedance-2.0-fast" }).total} Aura`,
    to: "/music-video",
  },
  {
    number: "03",
    name: "Lip Sync",
    label: "Performance",
    description: "Turn vocals and a character reference into synced performance video",
    price: `From ${LIPSYNC_TIER_AURA.budget} Aura`,
    to: "/lipsync",
  },
  {
    number: "04",
    name: "Aurora Video Agent",
    label: "Director",
    description: "Plan, storyboard, edit, then render",
    price: `From ${computeCost({ features: ["video"], model: "heygen/video-agent" }).total} Aura`,
    to: "/video-agent",
  },
  {
    number: "05",
    name: "Layers",
    label: "Edit",
    description: "Turn any finished image into editable, movable layers",
    price: `From ${computeCost({ features: ["image"] }).total} Aura`,
    to: "/layers",
  },
  {
    number: "06",
    name: "Colors",
    description: "Performance photo generation",
    price: `From ${computeCost({ features: ["image"] }).total} Aura`,
    to: "/colors",
  },
  {
    number: "07",
    name: "TikTok30",
    description: "UGC campaign engine",
    price: `From ${COST_TIKTOK_REMIX_CUT} Aura`,
    to: "/spin",
  },
  {
    number: "08",
    name: "Canvas",
    label: "New",
    description: "Build connected creative workflows",
    price: `From ${computeCost({ features: ["image"] }).total} Aura`,
    to: "/canvas",
  },
] as const;
