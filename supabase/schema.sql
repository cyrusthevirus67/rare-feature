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
  -- The owner's email becomes the admin automatically on first sign-in.
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, lower(new.email) = 'cyrus@rareft.com')
  on conflict (id) do nothing;
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
  with check (client_id = auth.uid() and kind in ('support', 'change', 'booking') and status = 'open');

-- Website contact form: anyone can submit a request; only admins can read them.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 200),
  email text not null check (char_length(email) <= 320),
  type text check (char_length(type) <= 50),
  handle text check (char_length(handle) <= 300),
  interest text check (char_length(interest) <= 100),
  message text check (char_length(message) <= 5000),
  status text not null default 'new',               -- new | contacted | closed
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
drop policy if exists "anyone can submit a lead" on public.leads;
create policy "anyone can submit a lead" on public.leads for insert to anon, authenticated with check (status = 'new');
drop policy if exists "admin manages leads" on public.leads;
create policy "admin manages leads" on public.leads for all using (public.is_admin()) with check (public.is_admin());

-- Automation: Stripe purchases create portals (supabase/functions/stripe-webhook) and
-- new leads / client requests email the owner (supabase/functions/notify).
alter table public.client_plans add column if not exists stripe_customer_id text;
alter table public.client_plans add column if not exists stripe_subscription_id text;
alter table public.client_plans add column if not exists stripe_session_id text;
alter table public.leads add column if not exists notified_at timestamptz;
alter table public.requests add column if not exists notified_at timestamptz;

create extension if not exists pg_net;

create or replace function public.ping_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://hjvezrxvrshdlprnalin.supabase.co/functions/v1/notify',
    body := '{}'::jsonb,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
exception when others then
  return new; -- never block a lead or request because a notification failed
end;
$$;
drop trigger if exists leads_notify on public.leads;
create trigger leads_notify after insert on public.leads for each row execute function public.ping_notify();
drop trigger if exists requests_notify on public.requests;
create trigger requests_notify after insert on public.requests for each row execute function public.ping_notify();

-- Agreements and e-signatures.
-- The row id doubles as the private signing-link token (sign.html?id=<id>): it is a random UUID,
-- so only someone who was sent the link can open or sign that agreement.
create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  template text not null,                 -- client-service | starter | contractor | talent-release
  template_version text not null,
  title text not null,
  body_html text not null,                -- the exact text presented for signature; frozen at creation
  body_sha256 text,                       -- fingerprint of body_html, set by the database
  fields jsonb not null default '{}',
  party_name text not null,               -- the person signing
  party_email text,
  party_org text,
  status text not null default 'sent',    -- sent | signed | void
  provider_signed_name text,              -- signed for Rare Feature when the agreement is created
  provider_signed_at timestamptz,
  signed_name text,
  signed_at timestamptz,
  signed_consent boolean,
  signed_ip text,
  signed_user_agent text,
  signed_drawing text,                    -- optional hand-drawn signature (PNG data URL)
  created_by uuid references public.profiles,
  created_at timestamptz not null default now()
);

-- Stamp new agreements, and make sure nothing about a document can change after it exists.
create or replace function public.agreements_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.body_sha256 := encode(sha256(convert_to(new.body_html, 'UTF8')), 'hex');
    new.party_email := nullif(lower(trim(new.party_email)), '');
    new.created_by := auth.uid();
    new.created_at := now();
    new.status := 'sent';
    new.provider_signed_at := case when new.provider_signed_name is not null then now() end;
    new.signed_name := null; new.signed_at := null; new.signed_consent := null;
    new.signed_ip := null; new.signed_user_agent := null; new.signed_drawing := null;
    return new;
  end if;
  if new.body_html is distinct from old.body_html or new.body_sha256 is distinct from old.body_sha256
     or new.title is distinct from old.title or new.template is distinct from old.template
     or new.fields is distinct from old.fields or new.party_name is distinct from old.party_name
     or new.provider_signed_name is distinct from old.provider_signed_name
     or new.provider_signed_at is distinct from old.provider_signed_at then
    raise exception 'An agreement cannot be edited after it is created. Void it and create a new one.';
  end if;
  if old.status <> 'sent' then
    raise exception 'This agreement is % and can no longer be changed.', old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists agreements_guard on public.agreements;
create trigger agreements_guard before insert or update on public.agreements
  for each row execute function public.agreements_guard();

create or replace function public.agreements_no_delete() returns trigger
language plpgsql as $$
begin
  if old.status = 'signed' then raise exception 'A signed agreement cannot be deleted.'; end if;
  return old;
end;
$$;
drop trigger if exists agreements_no_delete on public.agreements;
create trigger agreements_no_delete before delete on public.agreements
  for each row execute function public.agreements_no_delete();

alter table public.agreements enable row level security;
drop policy if exists "admin manages agreements" on public.agreements;
create policy "admin manages agreements" on public.agreements for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "signer sees own agreements" on public.agreements;
create policy "signer sees own agreements" on public.agreements for select
  using (party_email is not null and party_email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Opening an agreement from its private link (no login needed).
create or replace function public.get_agreement(p_id uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', id, 'template', template, 'template_version', template_version, 'title', title,
    'body_html', body_html, 'body_sha256', body_sha256, 'status', status,
    'party_name', party_name, 'party_org', party_org,
    'provider_signed_name', provider_signed_name, 'provider_signed_at', provider_signed_at,
    'signed_name', signed_name, 'signed_at', signed_at, 'signed_ip', signed_ip, 'signed_drawing', signed_drawing,
    'created_at', created_at)
  from public.agreements where id = p_id;
$$;

-- Signing it. Records who signed, when, and from where; works once.
create or replace function public.sign_agreement(p_id uuid, p_name text, p_consent boolean, p_drawing text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  hdr json := nullif(current_setting('request.headers', true), '')::json;
  n integer;
begin
  if p_consent is not true then raise exception 'You must agree to sign electronically.'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 or char_length(p_name) > 200 then raise exception 'Please type your full legal name.'; end if;
  if p_drawing is not null and (p_drawing not like 'data:image/png;base64,%' or char_length(p_drawing) > 400000) then
    raise exception 'The drawn signature could not be saved.';
  end if;
  update public.agreements set
    status = 'signed', signed_name = trim(p_name), signed_at = now(), signed_consent = true,
    signed_ip = nullif(trim(split_part(coalesce(hdr ->> 'x-forwarded-for', hdr ->> 'cf-connecting-ip', ''), ',', 1)), ''),
    signed_user_agent = left(hdr ->> 'user-agent', 400),
    signed_drawing = p_drawing
  where id = p_id and status = 'sent';
  get diagnostics n = row_count;
  if n = 0 then raise exception 'This agreement is not available for signing. It may already be signed or have been withdrawn.'; end if;
  return public.get_agreement(p_id);
end;
$$;
revoke all on function public.get_agreement(uuid) from public;
revoke all on function public.sign_agreement(uuid, text, boolean, text) from public;
grant execute on function public.get_agreement(uuid) to anon, authenticated;
grant execute on function public.sign_agreement(uuid, text, boolean, text) to anon, authenticated;

-- To make another person an admin later:
--   update public.profiles set is_admin = true where email = 'someone@example.com';
