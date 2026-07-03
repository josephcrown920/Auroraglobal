export type ChangelogEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
  badge: "new" | "update" | "fix" | "coming-soon";
  icon: string;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "c-20260702-scene-templates",
    date: "Jul 2, 2026",
    title: "Fixed color studio scene templates",
    description: "Each color now has a locked, named studio set (Royal Blue Cyclorama, Hot Pink Stage, etc.) embedded directly into every generation prompt — no more generic backgrounds.",
    badge: "update",
    icon: "🎨",
  },
  {
    id: "c-20260702-variation-matrix",
    date: "Jul 2, 2026",
    title: "Spin variation matrix upgrade",
    description: "The bulk campaign engine now builds a 10×10×8×8×8 variation matrix first, guaranteeing no two posts share the same location, outfit, lighting, camera angle or mood.",
    badge: "update",
    icon: "⚡",
  },
  {
    id: "c-20260701-piapi",
    date: "Jul 1, 2026",
    title: "PiAPI added — Midjourney & Kling",
    description: "Midjourney Imagine and Kling video generation are now available as explicit model options (piapi/midjourney-imagine, piapi/kling-video).",
    badge: "new",
    icon: "🎬",
  },
  {
    id: "c-20260630-duration-caps",
    date: "Jun 30, 2026",
    title: "Per-tier duration caps",
    description: "Free accounts cap at 10s, Pro at 15s. Duration is now enforced at the API layer before any charge — rejected requests never spend Aura.",
    badge: "update",
    icon: "🔒",
  },
  {
    id: "c-20260629-preview-gate",
    date: "Jun 29, 2026",
    title: "Preview-first on all video renders",
    description: "Every video and motion render now shows a 480p / ≤5s preview at half cost before charging for the full quality version.",
    badge: "new",
    icon: "👁️",
  },
  {
    id: "c-20260628-cost-stats",
    date: "Jun 28, 2026",
    title: "Admin cost analytics fixed",
    description: "The spend dashboard was silently dropping all studio renders due to a status filter bug. All historical spend is now accurate.",
    badge: "fix",
    icon: "📊",
  },
  {
    id: "c-20260625-identity-lock",
    date: "Jun 25, 2026",
    title: "Identity lock on all generation prompts",
    description: "\"DO NOT change face identity, race or facial structure\" is now baked into every Spin, UGC, and Colors render call — not just a suggestion.",
    badge: "update",
    icon: "🧬",
  },
  {
    id: "c-20260622-aurora-theme",
    date: "Jun 22, 2026",
    title: "Dark / Light theme toggle",
    description: "Full dark and light mode support across every page. Toggle lives in the sidebar footer.",
    badge: "new",
    icon: "🌙",
  },
  {
    id: "c-20260618-mcp-server",
    date: "Jun 18, 2026",
    title: "Aurora MCP server",
    description: "Connect Claude Desktop or any MCP-compatible client to Aurora. Generate images, videos, and full campaigns from a chat interface.",
    badge: "new",
    icon: "🤖",
  },
  {
    id: "c-20260614-gpu-workers",
    date: "Jun 14, 2026",
    title: "Self-hosted GPU worker support",
    description: "Connect your own ComfyUI or RunPod instance. Workers advertise their capabilities and Aurora routes matching jobs automatically.",
    badge: "new",
    icon: "⚙️",
  },
  {
    id: "c-20260610-colors-studio",
    date: "Jun 10, 2026",
    title: "Colors Studio launched",
    description: "12 signature color cycloramas, per-color mic staging, studio/indoor/outdoor/street setups. One-tap triptych and all-setups batch generation.",
    badge: "new",
    icon: "🎨",
  },
  {
    id: "c-20260605-motion",
    date: "Jun 5, 2026",
    title: "Motion Studio",
    description: "Pose-to-animate, motion transfer, and performance reskin — three ways to bring any image to life with consistent identity across frames.",
    badge: "new",
    icon: "🎥",
  },
];

export function getUnreadCount(lastSeenId: string | null): number {
  if (!lastSeenId) return CHANGELOG.length;
  const idx = CHANGELOG.findIndex((e) => e.id === lastSeenId);
  return idx === -1 ? CHANGELOG.length : idx;
}
