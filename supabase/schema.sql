-- Rare Feature client portal — database setup.
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  business_name text,
  instagram text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.client_plans (
  client_id uuid primary key references public.profiles on delete cascade,
  plan text not null,
  price_cents integer not null default 0,
  billing text not null default 'monthly',          -- monthly | one-time
  status text not null default 'active',            -- onboarding | active | paused | cancel_requested | cancelled
  started_on date,
  minimum_term_ends date,
  next_billing_on date,
  videos_per_month integer not null default 0,
  sessions_per_month integer not null default 0,
  platforms text,
  updated_at timestamptz not null default now()
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles on delete cascade,
  title text not null,
  month date not null,
  platform text,
  status text not null default 'planned',           -- planned | filming | editing | review | approved | scheduled | posted
  view_url text,
  client_feedback text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.filming_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles on delete cascade,
  starts_at timestamptz not null,
  location text,
  notes text,
  status text not null default 'scheduled',         -- scheduled | completed | cancelled
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles on delete cascade,
  month date not null,
  headline text,
  summary text,
  url text,
  created_at timestamptz not null default now()
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles on delete cascade,
  kind text not null default 'support',             -- support | change | cancellation
  message text,
  status text not null default 'open',              -- open | in_progress | done
  created_at timestamptz not null default now()
);

-- Is the signed-in user an admin?
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Create a profile automatically when someone signs in for the first time.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Things a client is allowed to change, exposed as functions so they can't touch anything else.
create or replace function public.update_my_profile(p_full_name text, p_business_name text, p_instagram text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set full_name = p_full_name, business_name = p_business_name, instagram = p_instagram
  where id = auth.uid();
$$;

create or replace function public.review_deliverable(p_id uuid, p_approve boolean, p_feedback text) returns void
language sql security definer set search_path = public as $$
  update public.deliverables
  set status = case when p_approve then 'approved' else 'editing' end,
      approved_at = case when p_approve then now() else null end,
      client_feedback = p_feedback
  where id = p_id and client_id = auth.uid() and status = 'review';
$$;

create or replace function public.request_cancellation(p_message text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.requests (client_id, kind, message) values (auth.uid(), 'cancellation', p_message);
  update public.client_plans set status = 'cancel_requested', updated_at = now()
  where client_id = auth.uid() and status in ('active', 'paused', 'onboarding');
end;
$$;

-- Row-level security: clients read only their own rows; admins can do everything.
alter table public.profiles enable row level security;
alter table public.client_plans enable row level security;
alter table public.deliverables enable row level security;
alter table public.filming_sessions enable row level security;
alter table public.reports enable row level security;
alter table public.requests enable row level security;

drop policy if exists "own profile or admin" on public.profiles;
create policy "own profile or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['client_plans', 'deliverables', 'filming_sessions', 'reports', 'requests'] loop
    execute format('drop policy if exists "own rows or admin" on public.%I', t);
    execute format('create policy "own rows or admin" on public.%I for select using (client_id = auth.uid() or public.is_admin())', t);
    execute format('drop policy if exists "admin manages" on public.%I', t);
    execute format('create policy "admin manages" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "client creates own requests" on public.requests;
create policy "client creates own requests" on public.requests for insert
  with check (client_id = auth.uid() and kind in ('support', 'change') and status = 'open');

-- After you sign in to the portal once with your own email, make yourself the admin:
--   update public.profiles set is_admin = true where email = 'cyrus@rarefeature.com';
