-- Add a text-output column for the new `text` modality of the AI router.
-- Image/video/audio outputs already have homes (result_image_url, result_video_url,
-- audio_url); text generations need their own column.
alter table public.generations
  add column if not exists result_text text;
