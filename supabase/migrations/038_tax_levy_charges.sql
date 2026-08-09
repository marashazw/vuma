-- ============================================================================
-- VUMA — tax & levy charges, deducted per ride from the driver
-- Run after 037_wallet_topups_realtime.sql
--
-- Deliberately a generic "charge types" table, not a single hardcoded
-- "tax" field — the requirement is explicitly to let admin add other
-- custom charges as they become necessary (e.g. VAT, a municipal levy, a
-- road fund levy, each potentially with a different rate). Each active
-- charge for a ride's country is deducted at trip-start, the same moment
-- commission already is, and applies regardless of whether the driver is
-- on per-ride commission or an active subscription — this is
-- deliberately independent of the commission resolution logic.
--
-- These are NOT Vuma revenue — money collected on behalf of a regulator
-- passes through the platform, it isn't earned. Tracked with its own
-- transaction type specifically so the Income Statement can show it as a
-- liability (due to regulator) rather than mixing it into commission
-- revenue, which would misstate both figures.
-- ============================================================================

create table if not exists charge_types (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                                    -- e.g. "VAT", "Road Fund Levy", admin-defined
  country text not null,                                  -- ZA | ZW | OTHER — rates and applicable charges differ by jurisdiction
  charge_kind text not null check (charge_kind in ('percentage', 'flat')),
  rate numeric(6,3),                                      -- percentage value if charge_kind = 'percentage', e.g. 15.000 for 15%
  flat_amount numeric(10,2),                              -- flat amount if charge_kind = 'flat'
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_charge_types_active on charge_types(country, is_active);

alter table charge_types enable row level security;

-- Any authenticated user can read active charges — a driver should be
-- able to see what's being deducted from their own fares, same
-- transparency principle as commission rates already being visible.
drop policy if exists "charge_types_select" on charge_types;
create policy "charge_types_select" on charge_types
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- Writes are service-role only (admin API routes), matching every other
-- admin-managed setting in this app.

-- Stores exactly what was charged, for audit consistency with how
-- commission is already stored on the ride (wallet_commission_charged).
alter table rides
  add column if not exists tax_levy_charged numeric(10,2),
  add column if not exists tax_levy_breakdown jsonb;

-- New transaction type for admin reporting — deliberately separate from
-- 'ride_commission' so the Income Statement can distinguish Vuma's own
-- revenue from money collected on behalf of a regulator.
alter type txn_type add value if not exists 'tax_levy';

-- Human-readable name of which specific charge this transaction row
-- represents (e.g. "VAT") — avoids needing a join back to charge_types
-- for reporting, and remains meaningful even if that charge is later
-- deactivated or renamed.
alter table transactions
  add column if not exists charge_name text;

-- New driver wallet transaction type, distinct from commission_deduction,
-- so a driver's own wallet history clearly shows what a deduction was for.
alter table driver_wallet_transactions drop constraint if exists driver_wallet_transactions_type_check;
alter table driver_wallet_transactions add constraint driver_wallet_transactions_type_check
  check (type in ('topup', 'commission_deduction', 'no_show_penalty', 'admin_adjustment', 'subscription_payment', 'wallet_applied_reimbursement', 'tax_levy_deduction'));
