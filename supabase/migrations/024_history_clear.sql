-- ============================================================================
-- VUMA — let riders select and clear items from their own trip history
-- Run after 023_deluxe_security_benefit.sql
-- ============================================================================

-- Soft-hide only — never actually deletes the ride. Preserves driver
-- history, commission/financial records, and admin analytics untouched;
-- this only affects what the rider themselves sees in their own list.
-- Already covered by the existing rides_update RLS policy (a rider can
-- update their own ride), so no new policy is needed here.
alter table rides
  add column if not exists hidden_by_rider boolean not null default false;
