alter table public.generations
  add column if not exists motion_seed bigint;