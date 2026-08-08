-- ============================================================================
-- VUMA — reserve commission for scheduled trips at acceptance
-- Run after 035_driver_notices.sql
--
-- The problem this fixes: commission is only ever deducted at trip-start.
-- For an immediate trip that's fine, since start happens soon after
-- acceptance. For a scheduled trip, there can be a long gap — hours or
-- days — between acceptance and the actual scheduled time, during which
-- nothing stops the driver's balance being spent down on other, unrelated
-- trips in the meantime. By the time the scheduled trip's moment arrives,
-- the driver could have nothing left to cover it.
--
-- reserved_balance tracks the running total currently held across all of
-- a driver's accepted-but-not-yet-started scheduled trips. Their true
-- *available* balance for new bids/going online is
-- prepaid_wallet_balance - reserved_balance, not the raw balance alone.
-- commission_reserved on the ride itself records exactly how much was
-- held for that specific ride, so it can be released precisely if
-- cancelled, or converted into the real deduction at trip-start.
-- ============================================================================

alter table driver_profiles
  add column if not exists reserved_balance numeric(10,2) not null default 0;

alter table rides
  add column if not exists commission_reserved numeric(10,2);
