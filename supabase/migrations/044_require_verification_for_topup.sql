-- ============================================================================
-- VUMA — require verification before a driver can submit a wallet top-up
-- Run after 043_subscription_holidays.sql
--
-- Previously wallet_topups_insert_own only checked auth.uid() = driver_id —
-- any authenticated driver could submit a top-up request regardless of
-- verification status, including one who'd never even submitted documents
-- for review. Enforced here at the database level, not just hidden in the
-- UI, matching how anything else financial in this app is protected —
-- the UI check alone is never the actual boundary.
-- ============================================================================

drop policy if exists "wallet_topups_insert_own" on driver_wallet_topups;
create policy "wallet_topups_insert_own" on driver_wallet_topups
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1 from driver_profiles
      where user_id = auth.uid() and verification_status = 'verified'
    )
  );
