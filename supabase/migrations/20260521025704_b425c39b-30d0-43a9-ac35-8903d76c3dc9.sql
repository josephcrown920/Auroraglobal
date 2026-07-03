
-- Generations table
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prompt text not null,
  mode text not null default 'performance',
  status text not null default 'pending',
  input_images jsonb not null default '[]'::jsonb,
  motion_video_url text,
  result_image_url text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.generations enable row level security;

create policy "own generations select" on public.generations
  for select using (auth.uid() = user_id);
create policy "own generations insert" on public.generations
  for insert with check (auth.uid() = user_id);
create policy "own generations update" on public.generations
  for update using (auth.uid() = user_id);
create policy "own generations delete" on public.generations
  for delete using (auth.uid() = user_id);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('studio', 'studio', true);

create policy "studio read public" on storage.objects
  for select using (bucket_id = 'studio');
create policy "studio user upload" on storage.objects
  for insert with check (
    bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "studio user update" on storage.objects
  for update using (
    bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "studio user delete" on storage.objects
  for delete using (
    bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]
  );
