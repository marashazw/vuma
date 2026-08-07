-- ============================================================================
-- VUMA — scheduled ride policy overhaul, wallet consent, appeals, fee factor
-- Run after 029_accounting_console.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Unified flag-based cancellation consequences (replaces the driver's
--    50% monetary penalty). Tracked with timestamps (not a bare counter) so
--    "a second occurrence within 3 months" can actually be calculated —
--    a counter alone can't express a rolling time window.
-- ---------------------------------------------------------------------------
create table if not exists cancellation_strikes (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('driver', 'rider')),
  ride_id uuid references rides(id),
  reason text not null default 'Late cancellation or no-show on a scheduled ride',
  created_at timestamptz not null default now()
);

create index if not exists idx_cancellation_strikes_profile on cancellation_strikes(profile_id, created_at);

alter table cancellation_strikes enable row level security;

drop policy if exists "cancellation_strikes_select_own_or_admin" on cancellation_strikes;
create policy "cancellation_strikes_select_own_or_admin" on cancellation_strikes
  for select using (auth.uid() = profile_id or is_admin());

-- Riders now get a genuine time-bound suspension (matching how
-- driver_profiles.suspended_until already works) instead of a permanent
-- boolean ban. is_suspended is kept for now so nothing that already reads
-- it breaks, but suspended_until is the field enforcement actually checks
-- going forward.
alter table profiles
  add column if not exists suspended_until timestamptz;

-- Real enforcement update: a rider is blocked from new ride requests only
-- while suspended_until is in the future, not permanently.
drop policy if exists "rides_insert_rider" on rides;
create policy "rides_insert_rider" on rides
  for insert with check (
    auth.uid() = rider_id
    and not coalesce((select suspended_until > now() from profiles where id = rider_id), false)
  );

-- ---------------------------------------------------------------------------
-- 2. Suspension appeals — available to either role, admin has final say.
-- ---------------------------------------------------------------------------
create table if not exists suspension_appeals (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('driver', 'rider')),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_suspension_appeals_status on suspension_appeals(status, created_at);

alter table suspension_appeals enable row level security;

drop policy if exists "suspension_appeals_select_own_or_admin" on suspension_appeals;
create policy "suspension_appeals_select_own_or_admin" on suspension_appeals
  for select using (auth.uid() = profile_id or is_admin());

drop policy if exists "suspension_appeals_insert_own" on suspension_appeals;
create policy "suspension_appeals_insert_own" on suspension_appeals
  for insert with check (auth.uid() = profile_id);

-- ---------------------------------------------------------------------------
-- 3. Wallet top-up consent — the checkbox statement is enforced by the UI,
--    but the timestamp of when consent was given is recorded here so
--    there's a real record of it, not just a client-side checkbox with no
--    trace.
-- ---------------------------------------------------------------------------
alter table driver_wallet_topups
  add column if not exists consented_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Admin-configurable scheduled-trip fee factor — same mechanism as
--    deluxe_multiplier, stacks with it (a scheduled Deluxe ride gets both
--    factors applied, not one overriding the other).
-- ---------------------------------------------------------------------------
alter table fare_settings
  add column if not exists scheduled_multiplier numeric(4,2) not null default 1.2;

-- ---------------------------------------------------------------------------
-- 5. Two new wallet transaction types: paying a subscription directly from
--    wallet balance, and reimbursing a driver when a rider's own change
--    credit covered part of a fare (the driver received less cash than
--    the agreed fare, so Vuma owes them the difference).
-- ---------------------------------------------------------------------------
alter table driver_wallet_transactions drop constraint if exists driver_wallet_transactions_type_check;
alter table driver_wallet_transactions add constraint driver_wallet_transactions_type_check
  check (type in ('topup', 'commission_deduction', 'no_show_penalty', 'admin_adjustment', 'subscription_payment', 'wallet_applied_reimbursement'));
