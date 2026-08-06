-- ============================================================================
-- VUMA — scheduled (fixed-time) rides
-- Run after 027_driver_prepaid_wallet.sql
-- ============================================================================

alter table rides
  add column if not exists is_scheduled boolean not null default false,
  add column if not exists scheduled_at timestamptz,
  -- Mutual-cancellation proposal flow: either party can propose cancelling
  -- a locked scheduled ride, the other party accepts or rejects it. Only
  -- relevant once a ride is inside (or past) its 1-hour lock window —
  -- outside that window, either party can just cancel normally with no
  -- special flow needed.
  add column if not exists scheduled_cancel_status text not null default 'none'
    check (scheduled_cancel_status in ('none', 'proposed', 'accepted', 'rejected')),
  add column if not exists scheduled_cancel_proposed_by uuid references profiles(id),
  add column if not exists scheduled_cancel_reason text,
  add column if not exists no_show_penalty_charged boolean not null default false;

create index if not exists idx_rides_scheduled_at on rides(scheduled_at) where is_scheduled = true;

-- Rider strikes for cancelling a locked scheduled ride (within 1 hour of
-- the appointed time) without mutual agreement. Second strike results in
-- is_suspended = true (a field that already existed on profiles but was
-- never actually enforced anywhere in the app — this migration is what
-- makes it a real ban rather than a dormant flag).
alter table profiles
  add column if not exists scheduled_ride_strikes integer not null default 0;

-- Real enforcement, not just a flag: a suspended rider can no longer
-- create new ride requests. This is the strongest layer since it can't be
-- bypassed by any gap in application code — even a direct API call would
-- be rejected at the database level.
drop policy if exists "rides_insert_rider" on rides;
create policy "rides_insert_rider" on rides
  for insert with check (
    auth.uid() = rider_id
    and not coalesce((select is_suspended from profiles where id = rider_id), false)
  );
