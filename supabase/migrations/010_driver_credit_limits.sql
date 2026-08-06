-- ============================================================================
-- VUMA — driver change-credit balance, with monthly caps
-- Run after 009_rider_wallet.sql
-- ============================================================================

-- A separate, non-cash balance: decreases when a driver issues rider change
-- credit, increases when a driver redeems (completes) a wallet-covered ride.
-- Spendable only on subscription payments or priority-ranking boosts —
-- never withdrawable as cash/earnings. Allowed to go negative (a driver can
-- give out more credit than they've redeemed back — it's a synthetic
-- ledger, not real money).
alter table driver_profiles
  add column if not exists credit_balance numeric(10,2) not null default 0;

-- Dedicated ledger for the driver-side credit balance — kept separate from
-- wallet_transactions (which is rider-scoped) since this is driver-scoped
-- and has different entry types.
create table if not exists driver_credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  type text not null, -- issued_change_credit | redeemed_change_credit | spent_subscription | spent_priority
  amount numeric(10,2) not null, -- negative = debit, positive = credit
  currency text not null,
  ride_id uuid references rides(id),
  rider_id uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_credit_txn_driver on driver_credit_transactions(driver_id, created_at);
create index if not exists idx_driver_credit_txn_driver_rider on driver_credit_transactions(driver_id, rider_id, created_at);

alter table driver_credit_transactions enable row level security;

drop policy if exists "driver_credit_txn_select" on driver_credit_transactions;
create policy "driver_credit_txn_select" on driver_credit_transactions
  for select using (auth.uid() = driver_id or is_admin());

-- All writes happen server-side via the service role (monthly cap checks
-- must be enforced by trusted code, not left to client-side RLS).

do $$ begin
  alter publication supabase_realtime add table driver_credit_transactions;
exception when duplicate_object then null; end $$;
