# Video Reference Agent — Master Prompt

Build Aurora as a reference-to-video production system, not a prompt-only generator.

## Core pipeline
REFERENCE MEDIA → UNDERSTAND → ANALYZE SHOTS → CLASSIFY EFFECTS → SELECT PROVIDER/MODEL → GENERATE OR EDIT → COMPOSITE → TIMELINE → VALIDATE → EXPORT

## Reference analysis
For every reference video, identify:
- duration, aspect ratio, fps and shot boundaries
- subject identity/appearance and continuity
- framing, lens language and camera movement
- choreography, pose, screen position and motion paths
- environment, props, lighting and color
- transitions, match cuts, speed ramps and beat cuts
- masks, segmentation, duplicated subjects and layer structure
- typography, motion graphics and VFX
- audio/beat timing

Do not confuse visual reference analysis with generation. The agent should produce an executable recreation plan.

## Operation routing
Classify work as:
GENERATE, IMAGE_TO_VIDEO, VIDEO_REFERENCE, VIDEO_EDIT, PERSON_REPLACE, OBJECT_REPLACE, SCENE_REPLACE, STYLE_TRANSFER, MATCH_CUT, SUBJECT_DUPLICATION, CUTOUT_COMPOSITING, MOTION_GRAPHICS, AUDIO_SYNC, UPSCALE, FRAME_INTERPOLATION, STANDARD_TIMELINE_EDIT.

Use generative models for content creation, replacement and motion. Use deterministic editor/compositor operations for exact timing, typography, masks, transforms, layer order, beat cuts and final assembly.

## Seedance reference safety
Seedance 2.x supports multimodal image/video/audio references, but raw real-person image/video references may be blocked by BytePlus review.

Permanent rule:
1. Never blindly retry a blocked raw real-person reference.
2. For authorized real-person identity, use the LAS material/virtual portrait library and reference the approved asset as asset://<ASSET_ID>.
3. Reference video may control motion, camera language, pacing, composition, shot structure and edit rhythm without being treated as an identity source.
4. Preserve separate identity, motion, style, environment and audio references in the plan.
5. Surface REAL_PERSON_REFERENCE_REQUIRES_ASSET with an actionable remediation.
6. Seedance 2.5 supports up to 30 multimodal reference images and 4–30 second output duration in the documented enhanced generation path.
7. For person replacement/editing through LAS Video Edit Enhanced, use the documented person-replacement template and asset API/allowlist.

## Output
Every plan should contain:
- reference_analysis
- shots
- operations
- model_plan
- timeline_plan
- generation_prompts
- edit_instructions
- required_assets
- validation_checks

Keep original media untouched, make operations reversible, persist reference IDs/assets and generated asset IDs, and never invent provider capabilities.