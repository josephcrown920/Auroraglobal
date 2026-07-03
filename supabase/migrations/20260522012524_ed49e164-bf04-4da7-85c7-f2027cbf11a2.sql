
-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  display_name text,
  plan text not null default 'free',
  credits integer not null default 5,
  lifetime_credits_purchased integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profile self select" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profile self update" on public.profiles
  for update using (auth.uid() = user_id);
create policy "profile self insert" on public.profiles
  for insert with check (auth.uid() = user_id);

-- credit ledger
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create policy "ledger self select" on public.credit_ledger
  for select using (auth.uid() = user_id);

-- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null default 'paystack',
  reference text not null unique,
  amount_kobo integer not null,
  currency text not null default 'NGN',
  credits_granted integer not null default 0,
  status text not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "payments self select" on public.payments
  for select using (auth.uid() = user_id);

-- generations: add cost column
alter table public.generations add column if not exists credits_cost integer not null default 1;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function public.touch_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, credits)
  values (new.id, new.email, 5)
  on conflict (user_id) do nothing;
  insert into public.credit_ledger (user_id, delta, reason)
  values (new.id, 5, 'signup_bonus');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- atomic deduct (returns true on success, false on insufficient)
create or replace function public.deduct_credits(_user uuid, _amount integer, _reason text, _ref uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare _new int;
begin
  update public.profiles
    set credits = credits - _amount
    where user_id = _user and credits >= _amount
    returning credits into _new;
  if _new is null then
    return false;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id)
    values (_user, -_amount, _reason, _ref);
  return true;
end;
$$;

-- grant credits (used by webhook + admin)
create or replace function public.grant_credits(_user uuid, _amount integer, _reason text, _ref uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, credits)
    values (_user, _amount)
  on conflict (user_id) do update set credits = public.profiles.credits + excluded.credits;
  if _reason = 'purchase' then
    update public.profiles set lifetime_credits_purchased = lifetime_credits_purchased + _amount where user_id = _user;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id)
    values (_user, _amount, _reason, _ref);
end;
$$;
