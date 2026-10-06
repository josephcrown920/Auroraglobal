# Seedance Real-Person Reference Routing

## Why the console is rejecting the current request

BytePlus/ModelArk documents that Seedance 2.x supports image references, video references, and combined image/video/audio references, but it does **not** accept raw reference images or videos containing real human faces through the normal direct-reference path.

For authorized real-person material, BytePlus provides the LAS material/virtual portrait library. After the account feature is enabled and the authorized material is uploaded, the generated asset ID is supplied as:

`asset://<ASSET_ID>`

Aurora must therefore distinguish **raw media** from **authorized LAS assets** instead of blindly retrying a rejected request.

## Aurora routing contract

1. Inspect every reference before generation.
2. Keep the original media unchanged.
3. Reference video controls motion, camera language, pacing, composition, shot structure, or edit rhythm.
4. Reference images can control appearance, wardrobe, scene, props, or style.
5. If a real person's identity is required, use an authorized LAS asset.
6. If BytePlus returns a real-person review block, stop retrying the same raw input.
7. Return an actionable error:
   - authorize/upload the person to the LAS material library;
   - replace the raw person reference with `asset://<ASSET_ID>`;
   - or use the video only as a motion/composition reference and use a different authorized character asset.
8. Do not claim that Aurora can bypass BytePlus safety/review.

## Current Seedance 2.5 limits

- Multimodal reference images: up to 30.
- Output duration: 4–30 seconds.
- Supported reference modalities include image, video, and audio.
- Direct real-person reference media can be blocked; authorized LAS assets are the supported route.

## API shape

The native ModelArk content request should preserve roles:

```json
{
  "type": "image_url",
  "image_url": { "url": "asset://AUTHORIZED_PERSON_ID" },
  "role": "reference_image"
}
```

```json
{
  "type": "video_url",
  "video_url": { "url": "https://public.example/reference.mp4" },
  "role": "reference_video"
}
```

```json
{
  "type": "audio_url",
  "audio_url": { "url": "https://public.example/audio.mp3" },
  "role": "reference_audio"
}
```

For person replacement/editing through LAS Video Edit Enhanced, use the documented person-replacement template and asset API when the account is allowlisted. Do not invent undocumented provider parameters for the normal Seedance generation endpoint.

## Product behavior

Aurora should expose:

- Reference images
- Reference video URL / asset
- Reference audio URL / asset
- Authorized character / LAS asset
- Reference safety status
- Actionable "real person requires authorized asset" error
- Reference-to-edit analysis

The Dola agent should reason about the reference first and route the actual generation/editing job only after the references are valid for the selected provider.
