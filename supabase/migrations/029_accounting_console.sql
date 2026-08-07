-- ============================================================================
-- VUMA — accounting console: commission source tracking
-- Run after 028_scheduled_rides.sql
-- ============================================================================

-- Lets the accounting console break commission down by type (subscription
-- rate, referral credit, reward credit, country default, etc.), not just
-- show a single lumped "commission" total.
alter table transactions
  add column if not exists commission_source text;

create index if not exists idx_transactions_created_at on transactions(created_at);
create index if not exists idx_transactions_driver on transactions(driver_id);
create index if not exists idx_transactions_type on transactions(type);
