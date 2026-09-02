import { createFileRoute } from "@tanstack/react-router";

/**
 * Route metadata for the Video Agent Studio.
 * The paired `.lazy.tsx` file owns the client component so the heavy studio
 * stays code-split while the generated route tree has a canonical route entry.
 */
export const Route = createFileRoute("/video-agent-studio")({});
