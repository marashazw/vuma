-- ============================================================================
-- IN-APP CALLS — WebRTC call session tracking between a ride's rider/driver
-- Run after 055_rider_live_location.sql
--
-- No phone numbers ever appear here or anywhere in this feature — calls are
-- browser-to-browser audio (WebRTC), signaled through a Supabase Realtime
-- broadcast channel scoped to the ride, not routed through any telephony
-- provider. This table exists purely for call history / eligibility
-- checks, not for the calls themselves.
-- ============================================================================

create table if not exists ride_calls (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid not null references rides(id) on delete cascade,
  caller_id uuid not null references profiles(id),
  callee_id uuid not null references profiles(id),
  status text not null default 'initiated' check (status in ('initiated', 'answered', 'declined', 'missed', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer
);

create index if not exists idx_ride_calls_ride on ride_calls(ride_id, started_at);

alter table ride_calls enable row level security;

-- Only the two people actually on that specific ride can see or create a
-- call record for it — same principle as everywhere else sensitive,
-- ride-scoped data lives in this app.
drop policy if exists "ride_calls_select_participant" on ride_calls;
create policy "ride_calls_select_participant" on ride_calls
  for select using (
    auth.uid() = caller_id
    or auth.uid() = callee_id
    or exists (select 1 from rides r where r.id = ride_id and (r.rider_id = auth.uid() or r.driver_id = auth.uid()))
  );

drop policy if exists "ride_calls_insert_participant" on ride_calls;
create policy "ride_calls_insert_participant" on ride_calls
  for insert with check (
    auth.uid() = caller_id
    and exists (select 1 from rides r where r.id = ride_id and (r.rider_id = auth.uid() or r.driver_id = auth.uid()))
  );

drop policy if exists "ride_calls_update_participant" on ride_calls;
create policy "ride_calls_update_participant" on ride_calls
  for update using (auth.uid() = caller_id or auth.uid() = callee_id);
