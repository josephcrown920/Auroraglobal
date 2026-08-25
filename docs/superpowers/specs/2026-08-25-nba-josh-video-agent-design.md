# NBA Josh Video Agent — Looping Officers

**Date:** 2026-08-25  
**Status:** Design approved in conversation; awaiting written-spec review

## Scope

Build the first reusable Aurora-owned music-video production workflow around NBA
Josh’s “Looping Officers” concept. Aurora owns planning, creator review,
approval, Seedream still generation, Seedance image-to-video generation, job
tracking, and clean-layer delivery. Aurora does not claim to produce the final
composite in this release; the handoff includes Layer A, the reusable Layer B,
and a structured composite recipe for an external editor.

The first release supports a maximum of three independent outfit posts in one
project. Each post is a separate 15-second deliverable using the same hook and
can succeed, fail, retry, or be cancelled independently.

## Source normalization

The supplied PDF and production documents are treated as creative source
material, not as provider or UI contracts. Their reusable requirements are:

- 15 seconds, 16:9, two layers plus a composite handoff.
- Layer A is NBA Josh in the foreground, performing calmly into a hanging
  vintage microphone, glancing and smirking at 12–14 seconds, then exiting at
  14–15 seconds.
- Layer B is the existing officers clip, looped to exactly 15 seconds and
  treated as a reusable background asset.
- Officers remain aggressive but stationary in the loop; the visual contrast is
  Josh’s calm performance against their frantic motion.
- The five-beat timeline is opening (0–3), build (3–8), tension peak (8–12),
  look (12–14), and exit (14–15).
- Delivery is a clean Layer A plus Layer B, with external composite guidance.

The source plan names Kling for generation and CapCut for compositing. The
product decision for Aurora is to use Seedream for conditioned stills and
Seedance for image-to-video motion. External compositing remains an explicit
handoff rather than an implied Aurora capability.

## Asset roles and provenance

The project must store asset role and provenance separately from prompt text.
Filenames are not identity proof and must not be assigned silently.

### Identity set

- `IMG_4236_1787624159897.jpeg`: multi-angle face, tattoo, and accessory sheet.
- `IMG_1011_1787624159897.png`: clean blue-lit side portrait.
- The existing blue-lit portrait in the studio reference location remains an
  optional fallback when it is available and freshly signed.

The project records which identity assets were approved for the generation.
Identity references are never replaced by wardrobe or scene images.

### Wardrobe, accessory, and scene references

- `IMG_2571_1787624159897.jpeg`: black distressed denim.
- `IMG_2570_1787624159897.jpeg`: taupe denim.
- `IMG_2569_1787624159897.jpeg`: light distressed denim.
- `IMG_2573_1787624159897.jpeg` and `IMG_2572_1787624159897.jpeg`: oversized
  visor/goggle options.
- `IMG_2337_1787624263016.jpeg` and `IMG_2338_1787624263016.jpeg`: blue
  galaxy-pattern footwear.
- `IMG_2336_1787624263016.jpeg`: red leather jacket.
- `IMG_2223_1787624263016.jpeg`: black shark tee and tan-jean outfit board.
- `IMG_2224_1787624263016.jpeg`: fashion/accessory reference with a
  photographed person; it is not the primary identity anchor.
- `IMG_1883_1787624263016.jpeg`: black leather Chicago jacket.
- `IMG_1899_1787624263016.jpeg`: tattoo placement reference.
- `IMG_2218_1787624263016.jpeg`: indoor scene and styling reference.
- `IMG_2214_1787624263016.jpeg`, `IMG_4240_1787624159897.jpeg`,
  `IMG_3850_1787624159898.png`, `IMG_3849_1787624159898.png`, and
  `IMG_3851_1787624159898.png`: urban performance, lighting, microphone, and
  composition references.

The supplied officer clip is Layer B when its file is explicitly selected and
passes ownership/readiness checks. If it is absent, the project shows a
blocking missing-input state instead of inventing a replacement.

## Reusable production contract

Keep the existing generic `video_agent_projects` record as the project
envelope and add a typed production-plan payload with stable IDs. The plan
contains:

```text
production:
  template: nba-josh-looping-officers
  authorization: creator-attested likeness/media/audio rights
  identityRefs: [{ assetId, role: identity, approved }]
  audioRef: { assetId, duration, status }
  delivery: { durationSeconds: 15, aspectRatio: "16:9", fps: 60 }
  layers:
    - { id: layer-a, role: foreground, durationSeconds: 10, status }
    - { id: layer-b, role: background, durationSeconds: 15, status }
  outfits:
    - { id, name, refs, prompt, stillStatus, videoStatus, approvals, quote }
  timeline: [{ start, end, label, direction }]
  compositeRecipe: { loop, blur, grade, vignette, export }
```

The payload is validated at the server boundary. The three-outfit maximum,
15-second duration, 16:9 ratio, allowed statuses, reference roles, and
required Layer A/B inputs are enforced server-side. The existing generic scene
contract remains valid for non-production Video Agent projects.

Each outfit stores a plan revision/hash and approval record. A plan change to
identity references, outfit references, prompt, timeline, provider/model,
duration, aspect ratio, or variation count invalidates prior approval and quote.

## Approval and paid execution

Drafting, asset inspection, prompt editing, plan validation, and quoting do not
reserve credits. The creator must attest to rights to use the artist likeness,
audio, supplied images, and branded wardrobe references before a paid action.

For each outfit:

1. The creator reviews the outfit plan, input references, variation count
   (bounded to three), and exact Seedream quote.
2. The server revalidates ownership, authorization, plan hash, model
   availability, and quote before reserving.
3. Seedream generates the approved still variations using identity references
   plus the selected wardrobe and scene references.
4. The creator selects a still and reviews the Seedance quote and motion plan.
5. The server revalidates the still’s ownership, approval, plan hash, and quote.
6. Seedance generates the 10-second Layer A image-to-video clip.
7. Aurora records provider/job state and delivers Layer A alongside the selected
   Layer B and structured composite instructions.

Seedream uses the explicit `fal-ai/seedream-4.5` model key. Seedance uses the
explicit `seedance-2.0-fast` key for the first release. Both requests enter
the existing reservation/finalization path. Seedream is priced as an image
request through shared pricing; Seedance is priced as a video request with
duration and resolution multipliers. Seedance remains subscriber/pinned-only,
and its temporal preview gate is required before final-quality generation.

Explicitly selected models must fail clearly if unavailable. They must not
silently fall back to an identity-blind or different provider. Failed jobs
follow existing release/re-reservation behavior; a retry of a failed job gets a
fresh reservation.

## Agent and Video Agent surfaces

The reusable skill is available to the main Agent/CLI and the Video Agent
workspace through shared server functions. The skill operations are:

- inspect and classify assets;
- create or revise a production plan;
- validate readiness and authorization;
- quote a bounded paid action;
- request and record creator approval;
- generate stills;
- select a still and approve motion;
- generate and monitor video;
- package clean layers and composite guidance.

The Video Agent UI presents a three-outfit queue. Each outfit is media-first:
reference images or generated still/video previews appear above the title,
description, status, quote, and actions. Missing states name the exact required
role. Desktop uses a queue and inspector; tablet moves the inspector below the
selected outfit; mobile stacks media, plan, readiness, quote, and action.

The UI must distinguish:

- missing or unavailable input;
- ready for review;
- awaiting still approval;
- still generation queued/processing/failed/succeeded;
- awaiting motion approval;
- Seedance preview;
- final motion queued/processing/failed/succeeded;
- clean-layer delivery ready.

No empty “demo” containers or text-only generated-result cards are used. The
new supplied images are real visual references; generated Seedream and
Seedance outputs become the primary review media when available. Below-fold
videos use poster images, lazy loading, muted inline playback, and
intersection-based pausing where practical.

## Safety and failure boundaries

- Likeness, audio, and media authorization is explicit and stored with the
  project; no hidden assumption is made from an uploaded filename.
- Identity references are kept distinct from wardrobe, accessory, and scene
  references.
- Prompts preserve the locked identity constraints: tall lean basketball-player
  proportions, long red dreadlocks, exact tattoo placement, no face/neck
  tattoos, required jewelry, calm energy, and visible hanging microphone.
- One outfit’s failure cannot block another approved outfit.
- A plan edit after approval cannot reuse an earlier approval, quote, or
  reservation.
- The existing project/job ownership and finalization fences remain the source
  of truth; browser state cannot authorize or finalize paid work.
- Layer B absence blocks the handoff and is shown as missing; no silent
  substitution is allowed.

## Verification plan

Add focused tests for:

- production-plan schema, three-outfit cap, 15-second/16:9 validation, and
  asset-role validation;
- identity/wardrobe/scene provenance and missing-input states;
- quote parity for Seedream still variations and Seedance video duration;
- no reservation before approval;
- approval invalidation after plan/reference/model changes;
- ownership and authorization checks before reserve;
- explicit Seedream/Seedance model routing and no silent fallback;
- preview-gate enforcement for Seedance;
- failed-job release and fresh reservation on retry;
- independent outfit failure and success;
- clean Layer A/Layer B handoff packaging.

Browser coverage should exercise the visual queue, still selection, per-outfit
approval, missing Layer B state, plan-change invalidation, and result delivery.
Direct server-function tests should cover the paid boundaries and job state
transitions without relying on mocked browser RPC wiring.

## Non-goals

- No Aurora-owned final compositing or CapCut integration in the first release.
- No more than three outfits per project.
- No automatic full-batch paid execution from one broad approval.
- No generic provider fallback when the creator explicitly selected Seedream or
  Seedance.
- No restoration of the retired `artifacts/video-agent` or
  `/video-agent/playground` surfaces.