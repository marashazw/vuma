-- ============================================================================
-- VUMA — ride receipt snapshot fields
-- Run after 006_vehicle_capacity.sql
-- ============================================================================

-- The contact-reveal policy (shares_active_ride) only grants access to a
-- driver's name/phone while the ride is accepted/in_progress — by design,
-- it revokes once the ride ends. That's correct for privacy, but a rider
-- still needs to see who drove them for a receipt or their ride history.
-- Snapshotting these fields at completion time (same pattern as the SOS
-- alert snapshot) solves this without reopening broader profile access.
alter table rides
  add column if not exists driver_name_snapshot text,
  add column if not exists vehicle_snapshot text,
  add column if not exists plate_snapshot text;
