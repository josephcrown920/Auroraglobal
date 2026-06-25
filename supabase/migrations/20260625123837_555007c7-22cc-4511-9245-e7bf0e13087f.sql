-- Extend gpu_workers for RunPod-native serverless contract support.
-- Backward compatible: existing rows default to the custom POST /generate contract,
-- so already-registered workers and the provider failover chain keep working.

ALTER TABLE public.gpu_workers
  ADD COLUMN IF NOT EXISTS protocol text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS worker_role text,
  ADD COLUMN IF NOT EXISTS runpod_sync boolean NOT NULL DEFAULT false;

-- protocol  : request contract the worker speaks
--   'custom' = POST {endpoint}/generate  (flat JSON body -> { url } | { output_url })
--   'runpod' = RunPod serverless: POST {endpoint}/run (async, poll /status/{id})
--              or {endpoint}/runsync (sync), body wrapped as { "input": {...} }
-- worker_role: optional clarity tag for the pipeline role this worker fills
--   comfyui (image/upscale) | kling (video) | lipsync | motion (video)
-- runpod_sync: when true and protocol='runpod', call /runsync instead of /run + poll

COMMENT ON COLUMN public.gpu_workers.protocol IS 'Request contract: custom (POST /generate) or runpod (POST /run|/runsync with { input })';
COMMENT ON COLUMN public.gpu_workers.worker_role IS 'Optional pipeline role tag: comfyui | kling | lipsync | motion';
COMMENT ON COLUMN public.gpu_workers.runpod_sync IS 'When protocol=runpod, use /runsync (synchronous) instead of /run + poll';

-- Keep the per-worker auth_token (RunPod API key / bearer) hidden from client reads.
-- Re-assert column-level REVOKE (defense-in-depth on top of the admin-only RLS policy).
REVOKE SELECT (auth_token) ON public.gpu_workers FROM authenticated;
REVOKE SELECT (auth_token) ON public.gpu_workers FROM anon;
