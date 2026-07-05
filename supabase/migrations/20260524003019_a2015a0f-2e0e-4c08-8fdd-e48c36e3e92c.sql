-- Roles
do $$ begin
  create type public.app_role as enum ('admin', 'user');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

drop policy if exists "self read roles" on public.user_roles;
create policy "self read roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role);
$$;

-- Replace signup trigger: auto-admin + 10k credits for Joseph
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare _is_admin boolean := lower(new.email) = 'josephcrown920@gmail.com';
        _credits  int := case when _is_admin then 10000 else 5 end;
begin
  insert into public.profiles (user_id, email, credits)
  values (new.id, new.email, _credits)
  on conflict (user_id) do nothing;

  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, _credits, case when _is_admin then 'admin_grant' else 'signup_bonus' end);

  if _is_admin then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill the admin if already signed up
do $$
declare _uid uuid;
begin
  select id into _uid from auth.users where lower(email) = 'josephcrown920@gmail.com' limit 1;
  if _uid is not null then
    insert into public.user_roles (user_id, role) values (_uid, 'admin') on conflict do nothing;
    insert into public.profiles (user_id, credits) values (_uid, 10000)
      on conflict (user_id) do update set credits = greatest(public.profiles.credits, 10000);
    insert into public.credit_ledger (user_id, delta, reason)
      values (_uid, 10000, 'admin_backfill');
  end if;
end $$;

-- Admin read-all policies on generations & payments & profiles
drop policy if exists "admin read all gens" on public.generations;
create policy "admin read all gens" on public.generations
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin read all payments" on public.payments;
create policy "admin read all payments" on public.payments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));