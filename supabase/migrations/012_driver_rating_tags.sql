-- ============================================================================
-- VUMA — structured rating tags + driver warning/suspension escalation
-- Run after 011_driver_referrals.sql
-- ============================================================================

-- Optional structured tags a rider can attach to a driver rating, alongside
-- the existing star rating and free-text `comment` (reused here for the
-- "Other" comment option rather than adding a duplicate column).
alter table ratings
  add column if not exists tag_politeness text,  -- 'polite' | 'rude'
  add column if not exists tag_punctuality text, -- 'on_time' | 'very_late'
  add column if not exists tag_cleanliness text; -- 'clean' | 'dirty'

-- One row per warning issued to a driver for a specific recurring issue.
-- A 3rd warning for the *same category* triggers an automatic 7-day
-- suspension (see driver_profiles.suspended_until below).
create table if not exists driver_warnings (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  category text not null, -- 'rude' | 'very_late' | 'dirty'
  warning_number integer not null, -- 1, 2, or 3 (3 = also triggers suspension)
  triggered_by_count integer not null, -- how many adverse tags this cycle
  period_start timestamptz not null, -- start of the calendar month this warning covers
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_warnings_driver on driver_warnings(driver_id, category);
-- Guarantees at most one warning per driver/category/calendar-month cycle.
create unique index if not exists idx_driver_warnings_unique_cycle on driver_warnings(driver_id, category, period_start);

alter table driver_profiles
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text;

-- Hard enforcement, not just a UI gate: a suspended driver can't submit
-- bids even if they bypass the app's UI. Combines with the existing
-- capacity check from migration 006.
drop policy if exists "offers_insert_driver" on ride_offers;
create policy "offers_insert_driver" on ride_offers
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1
      from rides r
      join driver_profiles dp on dp.user_id = auth.uid()
      where r.id = ride_offers.ride_id
        and coalesce(dp.vehicle_seats, 0) >= r.seats_required
        and (dp.suspended_until is null or dp.suspended_until <= now())
    )
  );

alter table driver_warnings enable row level security;
drop policy if exists "driver_warnings_select" on driver_warnings;
create policy "driver_warnings_select" on driver_warnings
  for select using (auth.uid() = driver_id or is_admin());

-- All writes happen server-side via the service role (the detection logic
-- must run with trusted, consistent counting — not left to client RLS).

do $$ begin
  alter publication supabase_realtime add table driver_warnings;
exception when duplicate_object then null; end $$;
