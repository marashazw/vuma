-- ============================================================================
-- VUMA — rider wallet (change credit)
-- Run after 008_manual_payments.sql
-- ============================================================================

alter table profiles
  add column if not exists wallet_balance numeric(10,2) not null default 0,
  add column if not exists wallet_currency text;

alter table rides
  add column if not exists wallet_applied numeric(10,2) not null default 0;

-- Full ledger of every wallet movement, for transparency and support/dispute
-- resolution. amount is signed: positive = credit, negative = debit.
create table if not exists wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null references profiles(id) on delete cascade,
  ride_id uuid references rides(id),
  type text not null, -- change_credit | reserved | redeemed | refunded | admin_adjustment
  amount numeric(10,2) not null,
  currency text not null,
  created_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_txn_rider on wallet_transactions(rider_id);

alter table wallet_transactions enable row level security;

drop policy if exists "wallet_txn_select" on wallet_transactions;
create policy "wallet_txn_select" on wallet_transactions
  for select using (auth.uid() = rider_id or is_admin());

-- Riders can insert their own "reserved" entries when applying wallet
-- balance to a new ride request (mirrors how ride_credits are reserved).
-- Debits/credits driven by drivers or completion logic go through server
-- routes using the service role instead.
drop policy if exists "wallet_txn_insert_own_reserve" on wallet_transactions;
create policy "wallet_txn_insert_own_reserve" on wallet_transactions
  for insert with check (auth.uid() = rider_id and type = 'reserved');

do $$ begin
  alter publication supabase_realtime add table wallet_transactions;
exception when duplicate_object then null; end $$;
