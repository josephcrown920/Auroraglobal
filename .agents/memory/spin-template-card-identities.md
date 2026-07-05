---
name: Spin template card avatar identities
description: Which brand avatar/identity each of the 6 Spin template picker cards uses, and the visual style contract for regenerating them.
---

The Spin template picker (`src/routes/spin.tsx`, images wired via `src/lib/spin-engine.ts` from `src/assets/spin-templates/*.png`) shows one illustrative card per template. The user explicitly rejected polished/cinematic/stock-photo-style AI images for these cards and wants an authentic candid-UGC look instead (mirror selfie or blurry handheld phone shot, natural lighting, slight grain, imperfect framing — never studio lighting or airbrushed skin), while keeping a distinct "avatar" identity per card so the picker reads as a roster of real creators, not stock photography.

**Why:** first-pass generations used generic stock-photo-style faces/poses and got rejected twice; the user then supplied 9 UGC-style reference photos and said "make ours like these, don't use exactly these, use our avatars."

**How to apply:** if regenerating these cards again, keep prompts anchored to candid phone-camera composition (mirror selfie with phone visible in frame, or blurry-foreground product-in-hand) and to these per-template identities so the roster stays visually distinct:
- `default`/Creators — young brunette woman, warm olive skin, gold hoops, grey sweater, bedroom mirror selfie.
- `rapper` — young man, long red dreadlocks, reflective sunglasses, gold chain, black hoodie, bathroom mirror selfie (loosely inspired by the app's existing "Josh" brand persona, not a literal copy of those assets).
- `product_showcase` — young man, short dark hair, olive skin, white tee, blurry handheld product-bottle shot.
- `fitness_creator` — young Asian man, short black hair, athletic build, grey tank top, gym mirror selfie flexing.
- `fashion_lookbook` — young woman, curly dark brown hair, warm brown skin, oversized blazer OOTD, hallway mirror selfie.
- `beauty_glam` — young woman, long blonde hair, blue eyes, glam makeup, bathroom mirror close-up selfie.

Generated via `generateImage` (text-prompt only — no image-to-image/reference-image conditioning is available in this environment), so "use our avatars" was satisfied by describing each identity in detail rather than compositing the actual existing asset files.
