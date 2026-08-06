-- ============================================================================
-- VUMA — admin-configurable fare guidance
-- Run after 012_driver_rating_tags.sql
-- ============================================================================

-- The "fair range" shown to riders before they name their offer. Previously
-- hardcoded in lib/constants.ts; moved here so it can be tuned from the
-- admin dashboard without a code change + redeploy every time.
create table if not exists fare_settings (
  country country_code primary key,
  base_fare numeric(10,2) not null,
  per_km numeric(10,2) not null,
  low_multiplier numeric(4,2) not null default 0.85,
  high_multiplier numeric(4,2) not null default 1.20,
  currency text not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- Seeded at roughly half the app's original placeholder values, to match
-- InDrive's suggested rates as reported at the time this was set up. Tune
-- further from Admin → Commissions as you learn the actual market.
insert into fare_settings (country, base_fare, per_km, currency)
values
  ('ZA', 12.5, 4.25, 'ZAR'),
  ('ZW', 1.00, 0.28, 'USD'),
  ('OTHER', 1.00, 0.25, 'USD')
on conflict (country) do nothing;

alter table fare_settings enable row level security;

drop policy if exists "fare_settings_select_all" on fare_settings;
create policy "fare_settings_select_all" on fare_settings for select using (true);

drop policy if exists "fare_settings_admin_write" on fare_settings;
create policy "fare_settings_admin_write" on fare_settings for update using (is_admin());
