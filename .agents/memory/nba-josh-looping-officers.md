---
name: NBA Josh — Looping Officers Music Video
description: Full production spec for NBA Josh's "Looping Officers" viral music video project — character, outfits, scenes, corrections, and generation workflow.
---

# NBA Josh — Looping Officers Music Video

## Project overview
Each video = a **separate standalone post** synced to the same 24-second hook (NOT one composite).
NBA Josh stands on a wet urban street. Officers charge at full aggression behind him but are frozen on an invisible treadmill. At the end Josh turns, smirks calmly, walks away. Officers collapse exhausted.

Guided workflow slug: `nba-josh-looping-officers` in `src/lib/guided-workflows.seed.ts`

## Character spec — MUST match on every generation

**Build:** 6'3" TALL LEAN athletic. Long-limbed. Slender. NOT muscular, NOT thick, NOT bloated. Basketball-player proportions.

**Hair:** Long fully red dreadlocks past shoulders.

**Tattoos (EXACT — do not hallucinate extras):**
- Right shoulder: "NBA" with stars + "JOSH" in gothic lettering
- Left shoulder: portrait tattoo of young Black male face (low-cut Afro, punk version of Josh's own face)
- Both forearms: full sleeve tattoos — clouds, roses, stars, geometric patterns
- **ZERO tattoos on face, neck, chest, or legs** ← biggest AI drift issue

**Jewellery (every outfit):**
- Custom diamond "NBA JOSH 444" pendant on heavy diamond Cuban link chain (iced-out, chunky silver/diamond letters)
- Iced-out AP (Audemars Piguet) diamond watch on left wrist

**Prop (every scene):** Vintage silver retro hanging microphone — dangles from above, always visible.

**Energy:** Completely unbothered. Calm superpower aura. NOT scared or tense.

**Officers:** 4–6 in full uniform, charging maximum aggression, frozen on invisible treadmill — running hard, going nowhere. At end they collapse exhausted.

## Reference image
Josh's blue-lit close-up portrait is stored in Supabase storage at:
`studio/josh-refs/josh-blue-portrait.webp`
→ Get a fresh signed URL before each generation via Supabase admin.
→ Always upload this as the face/identity reference image in Kling v3.

## Generation tech
- **Provider:** Kling v3 via fal.ai
- **Endpoint:** `POST https://fal.run/fal-ai/kling-video/v3/standard/image-to-video`
- **Settings:** 10 seconds · 16:9 · image-to-video mode
- **Tip:** Write JSON payload to temp file then `curl --data @file.json` (avoids heredoc quoting issues)

## Outfit library

| ID | Name | Key elements | Setting |
|----|------|-------------|---------|
| A | Burgundy sport jersey | Dark burgundy sleeveless sport jersey + snake-frame sunglasses | Dark night |
| B ✅ | White mushroom tee | White psychedelic mushroom-eye graphic tee + black leather pants + red Jordan 4s + red crystal belt | Golden hour, palm trees |
| C | NEVER JXST racing | NEVER JXST red/black long-sleeve racing jersey (white side panels) + black distressed jeans + purple crystal belt + white Nike Shox | Dark night OR golden hour |
| D | Crazy Visions Cyber-Punk | Crazy Visions orange beanie + dark vintage wash mushroom-eye tee + red distressed torn jeans + fur/shearling boots + purple crystal belt | Golden hour / moody dusk |
| E | Red puffer + camo | Glossy red puffer jacket + wide-leg camo cargo pants + blue paisley basketball sneakers + textured wavy sculptural sunglasses | Urban street |
| F | Crazy Visions clean | Crazy Visions red/black beanie + white crewneck oversized tee + custom dopamine-theme Nike AF1s + red crystal belt | Any |
| G | Shearling + racing | Distressed shearling fur bomber jacket (brown/tan) + NEVER JXST racing jersey + red leather pants + custom painted Nike AF1 Mid | Bold daytime / dusk |
| H | Minecraft creeper | Minecraft creeper lime green tee + wide-leg camo cargo pants + blue paisley basketball sneakers | Unexpected/playful |
| 🚗 | Red Benz scene | Borrow deep metallic red AMG Mercedes GT 4-door (from IMG_2971). White streetwear jacket + embroidered cargo shorts + purple VaporMax. Josh leans on Benz, officers in background. MUST replace character face with Josh. | Dusk/night urban |

## Benchmark still
**IMG_3735** = almost perfect for Outfit B. Use as quality benchmark. Issues were: extra fake tattoos on arm + proportions slightly off. All other aspects correct.

## Known AI drift issues (always add these corrections)
1. **Extra face/neck tattoos** → add to negative prompt: "no face tattoos, no neck tattoos, clean face, no neck markings"
2. **Too muscular/thick** → add: "slender lean tall basketball player proportions, long limbs, narrow chest, NOT bodybuilder"
3. **Likeness drift** → always upload the blue-lit portrait as reference; shorter prompts drift less
4. **Extra letter on outfit** (e.g. "A" on arm in Outfit A gen) → described explicitly in prompt not to include labels
5. **Wrong glasses** → specify exact style per outfit (red snake-frame for most; wavy textured sculptural for Outfits E/G/Benz)

## Sunglasses reference
- **Red snake/sculptural frame** — used in outfits A, B, C, D (as seen in the generated stills)
- **Wavy textured sculptural sunglasses** (white or iridescent frame, colourful lenses) — outfit E, G, Benz scene
- **Black single-lens narrow visor** (futuristic, one-piece wrap lens) — alternate option (IMG_3278 reference)

## Accessory references (real items)
- NBA JOSH 444 pendant: large diamond iced-out letters "NBA JOSH" with "444" below, on Cuban link chain (IMG_3280)
- AP watch: full iced-out diamond AP Audemars Piguet, spiked bezel (IMG_3280)

## Outfit reference sheets filed
- `attached_assets/IMG_8068_*` — Outfit E sheet (red puffer + camo)
- `attached_assets/IMG_9337_*` — Outfit D/G sheet (Crazy Visions orange beanie + dark mushroom tee)
- `attached_assets/IMG_9341_*` — Outfit F sheet (Crazy Visions red beanie + white tee)
- `attached_assets/IMG_9346_*` — Mix Option 2 (shearling + racing)
- `attached_assets/IMG_9345_*` — Mix Option 1 (cyber-punk)
- `attached_assets/IMG_3280_*` — Real NBA JOSH pendant + AP watch
- `attached_assets/IMG_3278_*` — Black visor sunglasses
- `attached_assets/IMG_2971_*` — Red AMG Benz scene reference
- `attached_assets/IMG_1841_*` — Minecraft creeper tee + camo cargo (Outfit H)
- `attached_assets/IMG_1459_*` — Black skeleton quilted vest (future outfit piece)
- `attached_assets/IMG_1611_*` — Camo tactical plate carrier (future outfit piece)

## Video Agent artifact
Located at `artifacts/video-agent/`. The Video Agent UI shows the NBA Josh project pipeline — outfit tracker, character spec card, and generation controls — under a dedicated "Project" tab alongside the generic HeyGen studio.

## Post-processing (per standalone clip)
1. Lay 24-second hook audio underneath, align movement to beat drop
2. Colour grade per setting (golden hour = warm orange lift + teal shadows; night = deep blue/teal, crushed blacks)
3. Motion blur on officers (sells treadmill illusion)
4. Vignette 25–35%
5. Export 1080×1920 vertical (TikTok/Reels) or 1920×1080 horizontal (YouTube)
6. Caption formula: "[Outfit vibe] 🔥 They ran full speed. Didn't move an inch. #NBAJosh #LoopingOfficers #OutTheMud"

## Status (as of 2026-07-15)
- ✅ Character spec + outfit library locked in guided-workflow seed
- ✅ Reference image in Supabase storage
- ✅ Generated stills reviewed — IMG_3735 closest to correct
- ⏳ NO video clips generated yet — awaiting user "go" signal per outfit
- ⏳ Video Agent artifact updated to show project pipeline
