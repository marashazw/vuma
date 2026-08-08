-- ============================================================================
-- VUMA — per-rider monthly wallet accrual cap
-- Run after 032_change_credit_caps_admin.sql
--
-- The two existing change-credit caps are both scoped per-driver: how
-- much one driver can give one rider, and how much one driver can issue
-- in total. Neither accounts for a rider receiving credit from multiple
-- different drivers independently — each staying within their own limit
-- while the rider's total accumulates well past what any single cap
-- implies. This is a third, independent cap: how much one rider can
-- accrue in total, from any number of drivers combined, per month.
-- ============================================================================

alter table fare_settings
  add column if not exists rider_wallet_accrual_monthly numeric(10,2);

update fare_settings set rider_wallet_accrual_monthly = 40
  where country = 'ZA' and rider_wallet_accrual_monthly is null;

update fare_settings set rider_wallet_accrual_monthly = 4
  where country in ('ZW', 'OTHER') and rider_wallet_accrual_monthly is null;
