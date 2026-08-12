-- ============================================================================
-- VUMA — subscription holiday offers (Vuma Associates member benefit)
-- Run after 042_vuma_associates.sql
--
-- A time-windowed, admin-created offer that eligible drivers can claim for
-- a free period on a specific subscription plan — no payment required.
-- Deliberately built on top of the existing driver_subscriptions table
-- (which already has amount_paid, waived_by/waived_reason — this app
-- already had a concept for "granted for free," this reuses it rather
-- than inventing a parallel one) instead of a separate tracking mechanism,
-- so a claimed holiday automatically feeds into every existing
-- "has active subscription" check (commission resolution, bid gating,
-- the driver dashboard) with no duplicated logic anywhere.
-- ============================================================================

create table if not exists subscription_holiday_offers (
  id uuid primary key default uuid_generate_v4(),
  plan_id uuid not null references subscription_plans(id),
  duration_days integer not null check (duration_days > 0),
  claim_window_starts_at timestamptz not null,
  claim_window_ends_at timestamptz not null,
  is_active boolean not null default true,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_holiday_offers_window on subscription_holiday_offers(is_active, claim_window_starts_at, claim_window_ends_at);

alter table subscription_holiday_offers enable row level security;

drop policy if exists "subscription_holiday_offers_select" on subscription_holiday_offers;
create policy "subscription_holiday_offers_select" on subscription_holiday_offers
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- One claim per driver per offer — the unique constraint is what actually
-- prevents a driver from repeatedly claiming the same holiday, not
-- application-level logic alone.
create table if not exists subscription_holiday_claims (
  id uuid primary key default uuid_generate_v4(),
  offer_id uuid not null references subscription_holiday_offers(id) on delete cascade,
  driver_id uuid not null references driver_profiles(user_id) on delete cascade,
  driver_subscription_id uuid references driver_subscriptions(id),
  claimed_at timestamptz not null default now(),
  unique (offer_id, driver_id)
);

alter table subscription_holiday_claims enable row level security;

drop policy if exists "subscription_holiday_claims_select_own_or_admin" on subscription_holiday_claims;
create policy "subscription_holiday_claims_select_own_or_admin" on subscription_holiday_claims
  for select using (auth.uid() = driver_id or is_admin());
