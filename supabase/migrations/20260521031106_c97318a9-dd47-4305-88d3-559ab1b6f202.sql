ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS result_video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text;