# Segmind Seedance 2 Mini in Aurora

Aurora now has a server-only Segmind Seedance 2.0 Mini client at `src/lib/segmind.server.ts`.

## Why this path exists

Segmind lists Seedance 2.0 Mini as a lower-cost Seedance variant supporting text-to-video, image-to-video, reference-guided generation, 480p/720p output, and synchronized audio. The provider also recommends its asynchronous v2 API for long-running video workloads; the Aurora client currently uses the simple v1 synchronous endpoint for compatibility and straightforward billing capture.

**Production rule:** do not hard-code a per-clip price for Mini. Segmind's billing is dynamic and the provider response is the source of truth. Aurora records `x-cost` when present, with `x-credit-cost` retained as a compatibility fallback. If neither header is returned, the recorded provider cost is `null` rather than an invented estimate.

## Production use cases

### 1. Vertical product ads

Use `9:16`, normally `720p`, 5 seconds, and native audio when the ad needs ambient sound. This is intended for rapid creative-variant testing: change camera movement, framing, lighting, or product action while keeping the product description stable.

Recommended pattern:

1. Generate one clean reference/product shot.
2. Draft multiple variants with the same seed and prompt structure.
3. Review object consistency, lighting continuity, shadow behavior, and vertical framing.
4. Re-render only the winning concepts at delivery resolution.

The included `verticalProductAds` preset is based on a white running-shoe studio shot with a smooth orbit.

### 2. Film and VFX previz

Use `16:9`, 720p when the blocking needs to be readable, or 480p for rapid concept exploration. Describe one continuous scene and one main action rather than an overloaded shot list. Atmospheric audio is preferable to highly specific foley instructions.

The included `filmPreviz` preset demonstrates a rain-soaked night alley with a restrained tracking camera.

### 3. High-volume drafting

Use `480p` for internal review, animatics, social-concept selection, and other work where fidelity is not the final deliverable. Move approved shots to 720p or a higher-tier model only after review.

The included `volumeDraft` preset is a 4-second 480p product-style shot. `verticalVolumeDraft` demonstrates a 15-second 9:16 drafting pattern.

## Spend controls

Resolution is a major cost lever. Aurora should expose 480p as the default draft path and make 720p an explicit production choice for this provider.

Duration also scales cost for token-priced Seedance workloads. Keep drafts short, then re-render approved takes rather than generating every concept at final duration and resolution.

Always log the provider-reported cost on every successful call. Do not replace the observed provider cost with an application estimate when the provider supplies a billing header.

## Environment

Set:

```text
SEGMIND_API_KEY=...
```

Never expose this key to browser code, client bundles, logs, or generated prompts.

## API contract notes

Current Segmind documentation lists:

- `POST https://api.segmind.com/v1/seedance-2.0-mini`
- `x-api-key` authentication
- `prompt`
- `duration`
- `resolution` (`480p` / `720p`)
- `aspect_ratio`
- `generate_audio`
- `seed`
- reference image/video/audio controls
- `bitrate_mode`

The provider's current documentation also describes a v2 asynchronous endpoint. If Aurora moves long-running production traffic to v2, preserve the same billing rule: capture the provider's returned cost/metrics instead of calculating spend locally.

## Validation status

The client and unit tests are repository-side only until `SEGMIND_API_KEY` is configured in a safe environment. No live paid generation is performed automatically by tests.

Before enabling it as an automatic fallback, validate:

- live authentication
- text-to-video
- image-to-video
- 480p and 720p
- 16:9 and 9:16
- native audio on/off
- timeout/retry behavior
- returned video URL/bytes
- provider-reported billing cost
- moderation/error/refund behavior
