# Segmind Seedance 2 Mini in Aurora

Aurora now has a server-only Segmind Seedance 2.0 Mini client at `src/lib/segmind.server.ts`.

Segmind lists Seedance 2.0 Mini as a lower-cost Seedance variant supporting text-to-video, image-to-video, reference-guided generation, 480p/720p output, and synchronized audio.

## Production use cases

### Vertical product ads

Use `9:16`, normally `720p`, 5 seconds, and native audio when the ad needs ambient sound. Generate multiple variants while keeping the product description stable, then promote only the winning concepts to final renders.

The included `verticalProductAds` preset is a clean running-shoe studio shot with a smooth camera orbit.

### Film and VFX previz

Use `16:9`, 720p when blocking needs to be readable, or 480p for rapid exploration. Describe one continuous scene and one main action rather than an overloaded shot list. Keep audio atmospheric rather than overly specific foley.

The included `filmPreviz` preset demonstrates a rain-soaked night alley with a restrained tracking camera.

### High-volume drafting

Use `480p` for internal review, animatics, social-concept selection, and other work where fidelity is not the final deliverable. Move approved shots to 720p or a higher-tier model only after review.

The included `volumeDraft` and `verticalVolumeDraft` presets cover short horizontal and 15-second vertical drafting.

## Spend controls

Resolution is a major cost lever. Aurora should expose 480p as the default draft path and make 720p an explicit production choice.

Duration also affects Seedance token usage. Draft short, review, then re-render approved takes instead of generating every concept at final duration and resolution.

**Billing rule:** never hard-code a claimed per-clip cost for Seedance 2 Mini. Capture the provider-reported billing header (`x-cost`, with `x-credit-cost` as compatibility fallback). If the provider does not return a cost header, record `null` rather than inventing spend.

The exact sample prices supplied in product notes are therefore treated as observed examples, not Aurora pricing constants. Segmind's live pricing and response billing data are authoritative.

## Environment

```text
SEGMIND_API_KEY=...
```

Keep the key server-side. Never expose it to browser code or logs.

## API contract

Current Segmind documentation lists the Seedance 2.0 Mini v1 endpoint at `POST https://api.segmind.com/v1/seedance-2.0-mini` with `x-api-key` authentication and controls including prompt, duration, resolution, aspect ratio, audio, seed, bitrate mode, and reference media.

Segmind also documents a v2 asynchronous path for long-running video jobs. If Aurora moves production traffic to v2, preserve the same billing rule and capture the provider's returned cost/metrics.

## Validation gate

The client and unit tests are repository-side only. No paid live generation is performed automatically.

Before inserting Segmind into the automatic Aurora orchestrator/model picker, validate live authentication, text-to-video, image-to-video, 480p/720p, 16:9/9:16, audio, timeout/retry behavior, moderation/error/refund behavior, returned media handling, and provider-reported billing.
