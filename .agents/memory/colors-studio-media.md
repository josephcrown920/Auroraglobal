---
name: Colors Studio media pipeline
description: Rules for the per-color studio loop MP4s and photoreal scene stills used across /colors and the landing teaser.
---

# Colors Studio media pipeline

- **MP4 loops must be faststart.** ffmpeg-generated MP4s put the moov atom AFTER mdat by default; iOS Safari then paints nothing (black) because it can't parse metadata from a range request. Re-mux with `ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4` and verify moov comes first (`ffprobe -v trace ... | grep -o "type:'\(moov\|mdat\)'"` or check byte offsets).
  - **Why:** the /colors backdrop looked blank on mobile even though assets served 206 range responses correctly — the failure is client-side parsing, not serving.
  - **How to apply:** any time a new loop/clip asset is generated or added to `src/assets/colors-studios/`, re-mux faststart before committing.
- **Never rely on `<video>` autoplay to paint the first frame.** Backdrop components must always paint the photoreal poster as a real eager `<img>` layer, and fade the video in only on the `playing` event (reset that state when the src swaps). Reduced-motion users get the still only.
- Photoreal generated stills: generate PNG then convert `ffmpeg -q:v 4` to JPG (~70–170KB each) before importing; keep 4:3 for setup tiles.
