-- ============================================================================
-- VUMA — admin-configurable change-credit caps
-- Run after 031_accounting_integrity.sql
--
-- Previously hardcoded in lib/constants.ts (R20/R50 for ZA, $2/$5 for
-- ZW/OTHER). Moved here for the same reason deluxe_multiplier and
-- scheduled_multiplier already live here: an admin should be able to tune
-- this without a code deploy. Defaults match the previous hardcoded
-- values exactly, so this migration changes nothing behaviorally on its
-- own — it only makes the numbers editable going forward.
-- ============================================================================

alter table fare_settings
  add column if not exists change_credit_per_rider_monthly numeric(10,2),
  add column if not exists change_credit_driver_monthly numeric(10,2);

update fare_settings set change_credit_per_rider_monthly = 20, change_credit_driver_monthly = 50
  where country = 'ZA' and change_credit_per_rider_monthly is null;

update fare_settings set change_credit_per_rider_monthly = 2, change_credit_driver_monthly = 5
  where country in ('ZW', 'OTHER') and change_credit_per_rider_monthly is null;
