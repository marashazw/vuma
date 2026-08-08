-- ============================================================================
-- VUMA — rider suspension reason, for manual admin freezes
-- Run after 033_rider_wallet_accrual_cap.sql
--
-- driver_profiles already has suspension_reason (used by the rating-based
-- and scheduled-ride-strike auto-suspension systems). profiles never
-- needed an equivalent, since a rider's only suspension source was the
-- single, fixed "second scheduled-ride flag" reason. A manual admin
-- freeze needs a specific, freeform reason, so this closes that gap.
-- ============================================================================

alter table profiles
  add column if not exists suspension_reason text;
