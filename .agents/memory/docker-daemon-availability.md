---
name: Docker daemon availability in this container
description: docker build works in the main Replit container; use --target stage builds for cheap Dockerfile validation.
---

The Docker daemon IS available in this repo's main container (`docker build` succeeds) — contrary to the usual Replit assumption.

**Why it matters:** Dockerfile changes (e.g. the RunPod worker image) can be genuinely validated instead of shipped blind.

**How to apply:**
- `docker build --target <early-stage>` validates COPY paths, build contexts, and file layout in seconds without pulling multi-GB bases or downloading model weights.
- For images that must build from TWO contexts (repo root for GitHub-based cloud builders, subdir for legacy local commands): use a tiny alpine `src` stage that does `COPY . /ctx` then normalizes (`if [ -d /ctx/workers ] … cp` else cp /ctx) into a fixed path; later stages `COPY --from=src`. Pair with a root `.dockerignore` (`*` + `!workers`) so root-context uploads stay small.
- Remove test images afterward (`docker rmi`) — disk is shared with the dev server.
