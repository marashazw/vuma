-- ============================================================================
-- VUMA — driver prepaid wallet (real-time commission collection)
-- Run after 026_forum_qa_and_clear.sql
--
-- Why this exists: commission was previously only ever *recorded* at ride
-- completion (a transactions row), with no actual mechanism for Vuma to
-- collect it from a per-ride (non-subscription) driver — nothing stopped a
-- driver from taking rides indefinitely without ever settling what they
-- owed. This makes commission a real-time deduction against a balance the
-- driver has to keep funded, the same way prepaid airtime works.
-- ============================================================================

alter table driver_profiles
  add column if not exists prepaid_wallet_balance numeric(10,2) not null default 0;

-- Set at trip-start when the wallet deduction happens, so ride completion
-- can reuse the exact same figures rather than re-resolving commission
-- from scratch — guarantees the two can never disagree.
alter table rides
  add column if not exists wallet_commission_charged numeric(10,2),
  add column if not exists wallet_commission_pct numeric(5,2);

-- Top-up requests — same manual-payment-with-admin-approval pattern already
-- used for subscriptions, deliberately: proof of payment, reviewed by an
-- admin, never auto-approved.
create table if not exists driver_wallet_topups (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null,
  reference_code text,
  proof_of_payment_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  constraint driver_wallet_topup_has_evidence check (reference_code is not null or proof_of_payment_path is not null)
);

-- Full ledger — every deduction and top-up, so a driver (and admin) can see
-- exactly why their balance is what it is.
create table if not exists driver_wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  ride_id uuid references rides(id),
  type text not null check (type in ('topup', 'commission_deduction', 'no_show_penalty', 'admin_adjustment')),
  amount numeric(10,2) not null, -- positive = credited, negative = deducted
  balance_after numeric(10,2) not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_wallet_tx_driver on driver_wallet_transactions(driver_id, created_at);

alter table driver_wallet_topups enable row level security;
alter table driver_wallet_transactions enable row level security;

drop policy if exists "wallet_topups_select_own_or_admin" on driver_wallet_topups;
create policy "wallet_topups_select_own_or_admin" on driver_wallet_topups
  for select using (auth.uid() = driver_id or is_admin());

drop policy if exists "wallet_topups_insert_own" on driver_wallet_topups;
create policy "wallet_topups_insert_own" on driver_wallet_topups
  for insert with check (auth.uid() = driver_id);

drop policy if exists "wallet_tx_select_own_or_admin" on driver_wallet_transactions;
create policy "wallet_tx_select_own_or_admin" on driver_wallet_transactions
  for select using (auth.uid() = driver_id or is_admin());

-- Private bucket for wallet top-up proof-of-payment uploads, same pattern
-- as payment-proofs for subscriptions.
insert into storage.buckets (id, name, public)
values ('wallet-proofs', 'wallet-proofs', false)
on conflict (id) do nothing;

drop policy if exists "wallet_proofs_insert_own" on storage.objects;
create policy "wallet_proofs_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'wallet-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "wallet_proofs_select_own_or_admin" on storage.objects;
create policy "wallet_proofs_select_own_or_admin" on storage.objects
  for select using (
    bucket_id = 'wallet-proofs'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );
