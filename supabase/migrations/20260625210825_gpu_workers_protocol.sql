-- Extend gpu_workers with RunPod native contract support.
-- Backward compatible: existing rows keep protocol='custom' (no change in behaviour).
-- auth_token RLS protection (REVOKE SELECT on authenticated/anon) is preserved from
-- the original table definition and is unaffected by this migration.

ALTER TABLE public.gpu_workers
  ADD COLUMN IF NOT EXISTS protocol text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS worker_role text;

COMMENT ON COLUMN public.gpu_workers.protocol IS
  'Request contract the worker speaks. '
  'custom = POST /generate (flat body) → { url }. '
  'runpod = POST /runsync or /run with { input: { kind, prompt, image_urls, audio_url, video_url, model, duration, resolution } }; '
  'output URL read from RunPod response shape.';

COMMENT ON COLUMN public.gpu_workers.worker_role IS
  'Optional role / model tag for display and routing hints. '
  'One of: comfyui (image/upscale), kling (video), lipsync, motion (video).';
