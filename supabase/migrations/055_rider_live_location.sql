-- ============================================================================
-- RIDER LIVE LOCATION SHARING — for when a pickup address can't be found
-- Run after 054_ride_safety_check.sql
--
-- Deliberately columns on rides rather than a new table — this is
-- ephemeral, single-ride data (turned on, updated a few times, turned
-- off), not something needing its own standalone history or lifecycle.
-- ============================================================================

alter table rides
  add column if not exists rider_live_location_active boolean not null default false,
  add column if not exists rider_live_location_lat numeric(9,6),
  add column if not exists rider_live_location_lng numeric(9,6),
  add column if not exists rider_live_location_updated_at timestamptz;
