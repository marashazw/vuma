-- ============================================================================
-- VUMA — restrict rapid-response security provider to Vuma Deluxe rides
-- Run after 022_ride_stops.sql
-- ============================================================================

-- Snapshot whether the ride was Deluxe at the moment the alert was raised,
-- same reasoning as the existing vehicle_plate/involved_driver_name
-- snapshots: a notified driver isn't the ride's rider or assigned driver,
-- so they can't read the rides table directly under RLS — this makes the
-- alert self-contained instead.
alter table sos_alerts
  add column if not exists is_deluxe boolean not null default false;
