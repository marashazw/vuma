-- ============================================================================
-- VUMA — drivers forum: clear resolved alerts, ask-a-question / reply threads
-- Run after 025_drivers_forum.sql
-- ============================================================================

-- Feature: any driver can mark an alert as resolved (the truck's been
-- moved, the road's clear again) — cleared alerts stop appearing in both
-- the forum list and the route-matching check.
alter table road_alerts
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references profiles(id);

-- Feature: ask-a-question threads, separate from direct alerts — "Is Seke
-- Road congested right now?" style. Same same-day-only visibility as
-- alerts, filtered at query time.
create table if not exists road_questions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  country country_code not null,
  road_name text not null,
  question text not null,
  created_at timestamptz not null default now()
);

create table if not exists road_question_replies (
  id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references road_questions(id) on delete cascade,
  driver_id uuid not null references profiles(id) on delete cascade,
  reply text not null,
  -- Set once a driver taps "Log it" on their own reply, turning it into a
  -- proper road_alerts entry — prevents logging the same reply twice.
  logged_as_alert_id uuid references road_alerts(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_road_questions_country_created on road_questions(country, created_at);
create index if not exists idx_road_question_replies_question on road_question_replies(question_id);

alter table road_questions enable row level security;
alter table road_question_replies enable row level security;

drop policy if exists "road_questions_select" on road_questions;
create policy "road_questions_select" on road_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "road_questions_insert_own" on road_questions;
create policy "road_questions_insert_own" on road_questions
  for insert with check (auth.uid() = driver_id);

drop policy if exists "road_question_replies_select" on road_question_replies;
create policy "road_question_replies_select" on road_question_replies
  for select using (auth.role() = 'authenticated');

drop policy if exists "road_question_replies_insert_own" on road_question_replies;
create policy "road_question_replies_insert_own" on road_question_replies
  for insert with check (auth.uid() = driver_id);

-- Needed so the "Log it" action can mark a reply as logged (set
-- logged_as_alert_id) — restricted to the reply's own author.
drop policy if exists "road_question_replies_update_own" on road_question_replies;
create policy "road_question_replies_update_own" on road_question_replies
  for update using (auth.uid() = driver_id);
