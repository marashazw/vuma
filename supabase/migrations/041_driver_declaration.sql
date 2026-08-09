-- ============================================================================
-- VUMA — mandatory driver declaration at verification submission
-- Run after 040_driver_arrival_confirmation.sql
--
-- Timestamped (not just a boolean) so there's a real record of when the
-- declaration was made, same reasoning already applied to wallet top-up
-- consent — useful evidence if this is ever disputed later.
-- ============================================================================

alter table driver_profiles
  add column if not exists declaration_accepted_at timestamptz;
