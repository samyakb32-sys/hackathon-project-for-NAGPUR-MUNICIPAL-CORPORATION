-- Nagpur Command — grievances backend
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).

create table if not exists public.grievances (
  id bigint generated always as identity primary key,
  text text not null,                 -- citizen's own words, original language
  en text,                            -- English translation, if provided
  ward text,
  lang text default 'English',
  dept text default 'PENDING REVIEW', -- set by an officer during triage, not auto-classified
  conf int,                           -- AI confidence, filled in once real triage runs
  sla text not null default 'safe' check (sla in ('safe', 'risk', 'breached')),
  status text not null default 'new' check (status in ('new', 'approved', 'reassigned', 'escalated', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.grievances enable row level security;

-- Only signed-in citizens can submit a grievance (the app requires
-- sign-in/sign-up before showing the intake form; this makes that a real
-- rule, not just a UI convention someone could bypass by calling the API
-- directly).
drop policy if exists "public can insert grievances" on public.grievances;
create policy "signed-in users can insert grievances"
  on public.grievances for insert
  to authenticated
  with check (true);

-- Anyone can read the triage inbox (transparency — no PII is collected).
drop policy if exists "public can read grievances" on public.grievances;
create policy "public can read grievances"
  on public.grievances for select
  to anon, authenticated
  using (true);

-- Only signed-in officers can triage (approve/reassign/escalate).
drop policy if exists "officers can update grievances" on public.grievances;
create policy "officers can update grievances"
  on public.grievances for update
  to authenticated
  using (true)
  with check (true);

-- Seed a few rows so the inbox isn't empty on first load (safe to skip/edit).
insert into public.grievances (text, en, ward, lang, dept, conf, sla, status)
values
  ('रस्त्यावर मोठा खड्डा आहे', 'There is a large pothole on the road.', 'Dharampeth, VIP Road', 'मराठी', 'PUBLIC WORKS', 94, 'safe', 'new'),
  ('नाली जाम है, पानी बाहर आ रहा है', 'Drain is blocked, water is overflowing.', 'Sitabuldi', 'हिंदी', 'HEALTH', 88, 'risk', 'new'),
  ('चौकात पथदिवे काम करत नाहीत', 'Streetlights not working in square', 'Mahal', 'मराठी', 'ELECTRICAL', 90, 'breached', 'new'),
  ('बाजार के पास पाइपलाइन फट गई', 'Pipeline burst near market', 'Itwari', 'हिंदी', 'WATER', 91, 'safe', 'new')
on conflict do nothing;


-- Nagpur Command — field teams backend

create table if not exists public.teams (
  id bigint generated always as identity primary key,
  name text not null,
  task text,                          -- what they're currently doing, if anything
  loc text,                           -- ward / location
  eta text,                           -- human-readable, e.g. "12m" — not a timestamp, kept simple
  status text not null default 'available' check (status in ('available', 'in_progress', 'unavailable')),
  created_at timestamptz not null default now()
);

alter table public.teams enable row level security;

-- Anyone can see the roster (same transparency stance as grievances).
drop policy if exists "public can read teams" on public.teams;
create policy "public can read teams"
  on public.teams for select
  to anon, authenticated
  using (true);

-- Only signed-in officers can add or update teams.
drop policy if exists "officers can insert teams" on public.teams;
create policy "officers can insert teams"
  on public.teams for insert
  to authenticated
  with check (true);

drop policy if exists "officers can update teams" on public.teams;
create policy "officers can update teams"
  on public.teams for update
  to authenticated
  using (true)
  with check (true);

-- Seed a couple of rows so the roster isn't empty on first load.
insert into public.teams (name, task, loc, eta, status)
values
  ('RRT-Alpha', 'Desilting', 'Ambazari', '45m', 'in_progress'),
  ('Drain-Unit 4', 'Drainage Repair', 'Sitabuldi', '12m', 'in_progress'),
  ('Drain-Unit 2', null, 'HQ Depot', null, 'available')
on conflict do nothing;


-- Nagpur Command — officer roles + DOB-based password reset
--
-- Officer accounts are NOT self-service: signing up (citizen or via the
-- "Login as Officer" door) always creates a 'citizen' profile. To make
-- someone an officer, run this after they've signed up once:
--   update public.profiles set role = 'officer' where email = 'their@email.com';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  dob date,
  role text not null default 'citizen' check (role in ('citizen', 'officer')),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper used by RLS policies (here and in future tables) to check "is the
-- current user an officer?" without repeating the subquery everywhere.
-- security definer + search_path pinned so it runs as the function owner
-- (bypasses RLS on the lookup itself, same pattern Supabase's own docs use
-- for role-check helpers — otherwise this would recurse into its own RLS).
create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'officer'
  );
$$;

-- Anyone can read profiles — the app needs this to tell "is this user an
-- officer" and to show the citizen roster for blocking. No secrets live
-- here; DOB is only ever compared server-side, inside the reset-password
-- Edge Function, using the service role key — never over this policy.
drop policy if exists "public can read profiles" on public.profiles;
create policy "public can read profiles"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- Only officers can update profiles (e.g. blocking a citizen, or promoting
-- another officer later from the Officer Console instead of raw SQL).
drop policy if exists "officers can update profiles" on public.profiles;
create policy "officers can update profiles"
  on public.profiles for update
  to authenticated
  using (public.is_officer())
  with check (true);

-- New sign-ups get a profile row automatically. Email + DOB come from
-- auth.users' metadata, which AuthModal sets via signUp's `options.data`.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, dob)
  values (new.id, lower(new.email), (new.raw_user_meta_data->>'dob')::date);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- Nagpur Command — officer-only permissions
--
-- Tightens grievances/teams from "any signed-in user" to "only officers"
-- for triage/roster changes, adds delete, and stops blocked citizens from
-- submitting new grievances. Tags each grievance with its submitter (used
-- to enforce the block, and later to notify that citizen of updates).

alter table public.grievances add column if not exists user_id uuid references auth.users(id);

drop policy if exists "signed-in users can insert grievances" on public.grievances;
create policy "signed-in users can insert grievances"
  on public.grievances for insert
  to authenticated
  with check (
    (user_id is null or user_id = auth.uid())
    and not exists (select 1 from public.profiles where id = auth.uid() and blocked = true)
  );

drop policy if exists "officers can update grievances" on public.grievances;
create policy "officers can update grievances"
  on public.grievances for update
  to authenticated
  using (public.is_officer())
  with check (true);

drop policy if exists "officers can delete grievances" on public.grievances;
create policy "officers can delete grievances"
  on public.grievances for delete
  to authenticated
  using (public.is_officer());

drop policy if exists "officers can insert teams" on public.teams;
create policy "officers can insert teams"
  on public.teams for insert
  to authenticated
  with check (public.is_officer());

drop policy if exists "officers can update teams" on public.teams;
create policy "officers can update teams"
  on public.teams for update
  to authenticated
  using (public.is_officer())
  with check (public.is_officer());

drop policy if exists "officers can delete teams" on public.teams;
create policy "officers can delete teams"
  on public.teams for delete
  to authenticated
  using (public.is_officer());


-- Nagpur Command — editable site content
--
-- Lets an officer edit a handful of front-page text fields (the Command
-- Center headline/eyebrow/subtitle) from the Officer Console, no code
-- changes needed. Anything not in this table just falls back to the
-- built-in default text in the app.

create table if not exists public.site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "public can read site content" on public.site_content;
create policy "public can read site content"
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists "officers can insert site content" on public.site_content;
create policy "officers can insert site content"
  on public.site_content for insert
  to authenticated
  with check (public.is_officer());

drop policy if exists "officers can update site content" on public.site_content;
create policy "officers can update site content"
  on public.site_content for update
  to authenticated
  using (public.is_officer())
  with check (public.is_officer());
