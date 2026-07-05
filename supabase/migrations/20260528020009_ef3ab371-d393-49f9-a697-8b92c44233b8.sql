ALTER TABLE public.generations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;