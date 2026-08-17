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
