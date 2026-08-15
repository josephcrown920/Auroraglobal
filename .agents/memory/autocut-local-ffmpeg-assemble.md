---
name: AutoCut local ffmpeg assemble fallback
description: AutoCut no longer depends solely on an external self-hosted GPU worker for the ffmpeg 'assemble' step; it falls back to running ffmpeg in-process.
---

`runAutocut()` (`src/lib/jobs.server.ts`) still prefers an online self-hosted
worker with the `assemble` capability (dispatched via `orch({kind:"assemble",
selfHostedOnly:true})`), but when `hasActiveWorkerForKind("assemble")` is
false it no longer throws immediately and refunds. It falls back to
`runLocalFfmpegAssemble()` in `src/lib/autocut.server.ts`, which runs the
same normalize → concat → optional music-mix pipeline via the system
`ffmpeg`/`ffprobe` binaries directly in the Node process (same binaries
`compress.server.ts` uses), then uploads the result to the `studio` bucket.

**Why:** `gpu_workers` had zero registered rows in production, so every real
AutoCut job failed with "no online assembler" and refunded the user's Aura.
AutoCut's assembly step is pure ffmpeg (no GPU/model weights) — the
container running the app server already has ffmpeg installed — so there
was no reason to require external worker infra for this specific job kind.

**How to apply:** If `hasActiveWorkerForKind` regresses or a future refactor
removes this local path, AutoCut goes back to always refunding. Only if the
*local* ffmpeg run itself fails does it throw the old-style terminal error
(matches `TERMINAL_ERROR_RE` via "requires", still refunds). Deliberately
deviates from the shared Python reference (`workers/aurora_worker.py
run_assemble`, built for kids-story) which always silences original clip
audio — AutoCut preserves a clip's own audio track when present (probed via
ffprobe) since it's editing the user's real footage, not narrated stills.

**Proving the music mix:** assemble SILENT source clips (no audio stream) with a real musicUrl, then assert ffmpeg volumedetect mean_volume > -60 dB — any audible output can only be the looped/ducked music (pure silence ≈ -91 dB). "Output has an audio stream" alone proves nothing (scene normalization always adds AAC). All 24 MUSIC_TRACKS MP3s exist in the studio bucket since 2026-08 (music path fully live).
