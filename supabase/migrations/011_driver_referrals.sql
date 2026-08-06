-- ============================================================================
-- VUMA — driver-to-driver referral program
-- Run after 010_driver_credit_limits.sql
-- ============================================================================

-- Admin-configured, per country: how many referred drivers must each
-- complete at least `min_rides_to_qualify` rides before the referrer earns
-- one reward credit.
create table if not exists driver_referral_settings (
  country country_code primary key,
  required_referrals integer not null default 3,
  credit_amount numeric(10,2) not null default 0.5,
  currency text not null default 'USD',
  min_rides_to_qualify integer not null default 2,
  is_active boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into driver_referral_settings (country, required_referrals, credit_amount, currency, min_rides_to_qualify)
values
  ('ZA', 3, 8, 'ZAR', 2),
  ('ZW', 3, 0.5, 'USD', 2),
  ('OTHER', 3, 0.5, 'USD', 2)
on conflict (country) do nothing;

-- Each referred driver can only ever be linked to ONE referrer (the unique
-- constraint on referred_id is what makes double/repeat referrals
-- impossible at the database level, not just in application logic).
create table if not exists driver_referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade unique,
  status text not null default 'pending', -- pending | qualified | rewarded | flagged
  counted_toward_reward boolean not null default false,
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_referrals_referrer on driver_referrals(referrer_id);

-- Fraud-detection flags: set when a driver's vehicle plate matches another
-- existing driver's plate. Doesn't block the account (legitimate vehicle
-- transfers happen) — it gates referral reward qualification and surfaces
-- for admin review instead of a hard block.
alter table driver_profiles
  add column if not exists duplicate_vehicle_flag boolean not null default false,
  add column if not exists duplicate_vehicle_matches_user_id uuid references profiles(id);

alter table driver_referral_settings enable row level security;
drop policy if exists "driver_referral_settings_select_all" on driver_referral_settings;
create policy "driver_referral_settings_select_all" on driver_referral_settings for select using (true);
drop policy if exists "driver_referral_settings_admin_write" on driver_referral_settings;
create policy "driver_referral_settings_admin_write" on driver_referral_settings for update using (is_admin());

alter table driver_referrals enable row level security;
drop policy if exists "driver_referrals_select" on driver_referrals;
create policy "driver_referrals_select" on driver_referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id or is_admin());
drop policy if exists "driver_referrals_insert" on driver_referrals;
create policy "driver_referrals_insert" on driver_referrals
  for insert with check (auth.uid() = referred_id);
