---
name: Perform Anywhere product framing
description: Owner's product boundary between Perform Anywhere and Motion Control
---

# Perform Anywhere product framing

**The rule:** "Perform Anywhere" = the user films themselves performing on their phone, uploads the clip, and Aurora swaps them into a new scene/outfit/music video using their character photo. Camera-move features (dolly/orbit/whip "Motion Control") are an *editing* concern that belongs in the Director's Room — never the headline framing of the Perform surfaces.

**Why:** Owner clarified this explicitly after earlier copy conflated the two on the motion page and tools grid.

**How to apply:** Any new Perform surface (web or mobile) leads with the clip-upload reskin flow; camera-move controls link out to Director's Room. Reskin needs a motion-capable GPU worker — surfaces must degrade gracefully (offer the photo→still→animate fallback) when none is online, and any client entry path must reuse the same server enqueue core rather than reconstructing it.
