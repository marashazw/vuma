-- ============================================================================
-- VUMA — track driver arrival confirmation on scheduled trips
-- Run after 039_driver_other_document.sql
--
-- Previously, a driver clicking "Yes, I'm here" in the trip reminder was
-- a pure UI navigation with nothing persisted — the rider's side had no
-- way to know the driver had claimed arrival at all. This closes that
-- gap so the rider can be shown an appropriate, immediate prompt rather
-- than waiting out the normal grace period unaware anything happened.
-- ============================================================================

alter table rides
  add column if not exists driver_confirmed_arrival_at timestamptz;
