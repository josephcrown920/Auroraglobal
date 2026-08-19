
# Aurora Video Agent Spec

## Goal
A video agent that lets the user say things like:

- "Use Bullet Time with my uploaded photo"
- "Make this Neon Rim Hero, rooftop, aggressive, 9:16"
- "Turn my photo into a 5-second cinematic music video with cold blue neon"
- "Use Burning City preset and preserve my exact face and outfit"

The agent should:
1. detect the requested preset
2. ingest uploaded image references
3. preserve identity
4. fill preset parameters from the user prompt
5. choose the best model pipeline
6. generate a final model-ready prompt payload

---

## Agent capabilities

### 1. Preset calling
The agent can call a preset by:
- exact name: `Bullet Time`
- slug: `bullet-time`
- alias: `freeze orbit`, `time freeze`, `orbit freeze`

### 2. Uploaded photo binding
If the user uploads a photo, the agent should bind it as:
- `primary_subject_image`
- `identity_lock = true`
- `preserve_face = true`
- `preserve_hair = true`
- `preserve_clothing = true`
- `preserve_body_proportions = true`

### 3. Prompt parsing
The agent extracts:
- preset name
- environment
- camera movement
- energy
- lighting
- duration
- aspect ratio
- realism / stylization
- output model preference

### 4. Model routing
Suggested default routing:
- **Seedream**: identity-preserving image/reference prep
- **FLUX.2**: reference editing / cleanup / scene build
- **Seedance**: premium final video generation
- **Kling**: fallback video generation
- **WAN / ComfyUI**: advanced local workflows

### 5. Output
The agent returns:
- parsed intent
- selected preset
- resolved parameters
- model routing
- final prompt
- negative prompt
- generation payload

---

## Recommended interaction model

### Example user input
"Do Bullet Time with my photo, nightclub, aggressive, 9:16"

### Parsed result
- preset: `bullet-time`
- environment: `nightclub`
- energy: `aggressive`
- aspect_ratio: `9:16`
- input_image: uploaded file
- identity_lock: true

### Final behavior
The agent should construct:
1. a director brief
2. a model-ready image prep prompt
3. a video prompt
4. a structured API payload

---

## Preset schema

```json
{
  "preset_version": "1.0",
  "id": "bullet_time",
  "name": "Bullet Time",
  "slug": "bullet-time",
  "aliases": ["freeze orbit", "time freeze"],
  "category": "cinematic",
  "description": "Time-slice hero shot with dramatic orbit or freeze-push camera motion.",
  "visual_description": "The subject appears frozen in a high-impact moment while the camera glides around them with glossy cinematic lighting and dramatic spatial tension.",
  "input": {
    "type": "image",
    "required": true,
    "max_images": 5,
    "accept_video": false,
    "identity_lock": true
  },
  "parameters": {
    "environment": ["diner", "nightclub", "street", "bedroom", "rooftop", "concert", "studio"],
    "camera": ["360_orbit", "180_orbit", "freeze_push", "orbit_zoom", "low_angle_orbit"],
    "energy": ["slow", "cinematic", "aggressive", "chaotic"],
    "aspect_ratio": ["9:16", "16:9", "1:1"]
  },
  "defaults": {
    "environment": "street",
    "camera": "low_angle_orbit",
    "energy": "cinematic",
    "aspect_ratio": "9:16",
    "duration": 5
  },
  "director": {
    "subject_action": "heroic stillness with subtle natural movement",
    "lighting": "high contrast cinematic practicals with controlled highlights",
    "motion": "subtle cloth and hair movement",
    "lens": "cinematic lens with shallow depth of field",
    "composition": "subject-centered, premium music-video framing",
    "color_grade": "rich cinematic contrast",
    "atmosphere": "suspended time and controlled chaos"
  },
  "image_pipeline": {
    "primary_model": "seedream",
    "fallback_model": "flux2",
    "reference_strategy": "identity-preserving subject extraction and enhancement",
    "identity_preservation": true
  },
  "video_pipeline": {
    "primary_model": "seedance",
    "fallback_model": "kling",
    "motion_strategy": "camera-first cinematic motion with subject stability",
    "camera_control": true,
    "subject_consistency": true
  },
  "prompt_template": "Create a high-end cinematic music-video shot using the uploaded person as the exact primary subject. Preserve identity, facial structure, hairstyle, clothing, body proportions, and recognizable features. Preset: {name}. Visual feel: {visual_description}. Environment: {environment}. Camera: {camera}. Energy: {energy}. Lighting: {lighting}. Motion: {motion}. Lens: {lens}. Composition: {composition}. Color grade: {color_grade}. Atmosphere: {atmosphere}. Output vertical {aspect_ratio}, {duration} seconds, photorealistic, premium film grain, realistic cloth physics, subtle natural body movement.",
  "negative_prompt": "identity drift, changed face, altered hairstyle, different clothing, extra people, duplicate limbs, deformed hands, unrealistic motion, cartoon look, oversmoothing, blur, low detail, text, watermark",
  "controls": {
    "camera_intensity": 0.8,
    "motion_intensity": 0.55,
    "stylization": 0.45,
    "realism": 0.92
  }
}
```

---

## Agent logic

### Natural language command examples
- "Bullet Time with my photo"
- "Use Neon Rim Hero on this uploaded picture"
- "Make this Burning City, rooftop, chaotic, 16:9"
- "Take my uploaded photo and turn it into Cold Vision"

### Resolution order
1. Match preset by exact name
2. Match by slug
3. Match by alias
4. If no match, infer nearest preset from style words

### Required tool behavior
When a photo is uploaded:
- always attach it as primary identity reference
- default to identity lock on
- preserve clothing unless user asks to change it
- preserve hairstyle unless user asks to change it

### If the user says only:
"Bullet Time"
and uploads a photo

The agent should infer:
- subject = uploaded person
- use Bullet Time preset defaults
- aspect = 9:16
- duration = 5s
- identity lock = true

---

## Suggested system prompt for the video agent

You are Aurora's Video Agent.
Your job is to convert user requests into preset-driven video generation payloads.

Rules:
- If the user uploaded an image, treat it as the exact primary subject.
- Preserve identity, face, hair, clothing, body proportions, and recognizable features unless the user explicitly requests changes.
- Detect preset names, aliases, style cues, and parameter overrides from the prompt.
- If a preset is requested, load that preset configuration and merge it with user overrides.
- If no preset is requested, infer the closest preset from the user's language.
- Always produce:
  1. selected preset
  2. resolved parameters
  3. director brief
  4. image prep step
  5. video generation step
  6. final prompt
  7. negative prompt
  8. JSON payload

---

## Suggested API contract

### Request
```json
{
  "user_prompt": "Do Bullet Time with my photo, nightclub, aggressive, 9:16",
  "uploaded_images": ["image_001.png"],
  "preferred_models": {
    "image": "seedream",
    "video": "seedance"
  }
}
```

### Response
```json
{
  "selected_preset": "bullet-time",
  "resolved_parameters": {
    "environment": "nightclub",
    "camera": "low_angle_orbit",
    "energy": "aggressive",
    "aspect_ratio": "9:16",
    "duration": 5
  },
  "identity_binding": {
    "primary_subject_image": "image_001.png",
    "identity_lock": true,
    "preserve_face": true,
    "preserve_hair": true,
    "preserve_clothing": true,
    "preserve_body_proportions": true
  },
  "model_routing": {
    "image_model": "seedream",
    "video_model": "seedance",
    "fallback_video_model": "kling"
  },
  "final_prompt": "Create a high-end cinematic music-video shot using the uploaded person as the exact primary subject...",
  "negative_prompt": "identity drift, changed face...",
  "payload": {}
}
```
