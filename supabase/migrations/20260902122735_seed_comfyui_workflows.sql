/*
# Seed ComfyUI workflows for GPU backend

1. Data
- Inserts three ComfyUI workflow templates into the `workflows` table:
  - SDXL Image Generation (image category)
  - LatentSync Lip Sync (video category)
  - MimicMotion Motion Control (video category)
- These are seeded from the workflow JSON files in supabase/functions/comfyui/workflows/
2. Security
- No schema changes. The `workflows` table already has RLS enabled with anon+authenticated CRUD policies.
3. Notes
- Idempotent: uses ON CONFLICT (name) DO NOTHING so re-running won't duplicate.
*/

INSERT INTO workflows (name, description, workflow_json, category, icon)
SELECT
  'ComfyUI SDXL Image',
  'GPU-accelerated SDXL image generation via ComfyUI. Supports 1024x576 cinematic output with negative prompts.',
  '{"3":{"class_type":"KSampler","inputs":{"seed":0,"steps":30,"cfg":7.5,"sampler_name":"euler_ancestral","scheduler":"normal","denoise":1.0,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"sdxl_base_1.0.safetensors"}},"5":{"class_type":"EmptyLatentImage","inputs":{"width":1024,"height":576,"batch_size":1}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"","clip":["4",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"low quality, blurry, deformed","clip":["4",1]}},"8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"aurora_sdxl","images":["8",0]}}}'::jsonb,
  'image',
  'Image'
WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'ComfyUI SDXL Image');

INSERT INTO workflows (name, description, workflow_json, category, icon)
SELECT
  'ComfyUI LatentSync Lip Sync',
  'GPU lip sync via LatentSync. Drives a face image with an audio track to produce a talking-head video.',
  '{"1":{"class_type":"LatentSyncLoader","inputs":{"model_name":"latentsync_unet.pt","config":"default"}},"2":{"class_type":"LoadImage","inputs":{"image":"face_input"}},"3":{"class_type":"LoadAudio","inputs":{"audio":"voice_input"}},"4":{"class_type":"LatentSyncInference","inputs":{"latentsync_model":["1",0],"image":["2",0],"audio":["3",0],"face_region_padding":0.3,"mask_type":"full"}},"5":{"class_type":"SaveVideo","inputs":{"filename_prefix":"aurora_lipsync","video":["4",0]}}}'::jsonb,
  'video',
  'AudioLines'
WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'ComfyUI LatentSync Lip Sync');

INSERT INTO workflows (name, description, workflow_json, category, icon)
SELECT
  'ComfyUI MimicMotion Motion Control',
  'GPU motion transfer via MimicMotion. Applies a pose reference sequence to a character image to produce motion video.',
  '{"1":{"class_type":"MimicMotionModelLoader","inputs":{"model_name":"MimicMotion.pth","dtype":"fp16"}},"2":{"class_type":"LoadImage","inputs":{"image":"pose_reference"}},"3":{"class_type":"LoadImage","inputs":{"image":"character_image"}},"4":{"class_type":"MimicMotionInference","inputs":{"mimicmotion_model":["1",0],"pose_image":["2",0],"ref_image":["3",0],"motion_length":16,"num_inference_steps":25,"denoise_strength":0.5}},"5":{"class_type":"SaveVideo","inputs":{"filename_prefix":"aurora_motion","video":["4",0]}}}'::jsonb,
  'video',
  'Move3d'
WHERE NOT EXISTS (SELECT 1 FROM workflows WHERE name = 'ComfyUI MimicMotion Motion Control');
