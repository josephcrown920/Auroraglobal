ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS camera_movement text NULL;
COMMENT ON COLUMN public.generations.camera_movement IS 'Camera preset used during video generation (e.g. static, push_in, pull_out, orbit_cw, orbit_ccw, pan_left, pan_right, tilt_up, tilt_down, zoom_in, zoom_out)';
CREATE INDEX IF NOT EXISTS idx_generations_camera_movement ON public.generations(camera_movement);