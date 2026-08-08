-- ============================================================================
-- VUMA — enable realtime for driver wallet top-ups
-- Run after 036_scheduled_commission_reservation.sql
--
-- driver_wallet_topups was created in migration 027 but never added to the
-- realtime publication — without this, a driver's Wallet page has no way
-- to know their top-up was approved except by manually reloading.
-- ============================================================================

alter publication supabase_realtime add table driver_wallet_topups;
