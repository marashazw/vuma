-- ============================================================================
-- VUMA — referral rewards + SOS safety system
-- Run after 002_driver_verification.sql
-- ============================================================================

-- ── DRIVER REWARD FIELDS ────────────────────────────────────────────────────
alter table driver_profiles
  add column if not exists priority_until timestamptz,
  add column if not exists free_ride_credits integer not null default 0,
  add column if not exists badges jsonb not null default '[]'::jsonb;

-- ── REFERRAL LINK ON SIGNUP ─────────────────────────────────────────────────
alter table profiles
  add column if not exists referred_by uuid references profiles(id);

-- ── RIDE CREDIT APPLICATION ──────────────────────────────────────────────────
-- (ride_credits table defined below; column added after it exists)

-- ── REFERRAL SETTINGS (admin-configurable, per country) ─────────────────────
create table if not exists referral_settings (
  country country_code primary key,
  required_referrals integer not null default 3,
  credit_amount numeric(10,2) not null default 50,
  currency text not null default 'ZAR',
  driver_priority_days integer not null default 7,
  is_active boolean not null default true,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into referral_settings (country, required_referrals, credit_amount, currency, driver_priority_days)
values
  ('ZA', 3, 50, 'ZAR', 7),
  ('ZW', 3, 4, 'USD', 7),
  ('OTHER', 3, 5, 'USD', 7)
on conflict (country) do nothing;

-- ── REFERRALS ────────────────────────────────────────────────────────────────
create table if not exists referrals (
  id uuid primary key default uuid_generate_v4(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  referred_id uuid not null references profiles(id) on delete cascade unique,
  status text not null default 'pending', -- pending | qualified | rewarded
  counted_toward_reward boolean not null default false,
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer on referrals(referrer_id);

-- ── RIDE CREDITS (issued to a referrer once they hit the threshold) ─────────
create table if not exists ride_credits (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null,
  source text not null default 'referral',
  status text not null default 'available', -- available | reserved | used | expired
  used_ride_id uuid references rides(id),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table rides
  add column if not exists applied_credit_id uuid references ride_credits(id);

-- ── SOS ALERTS ───────────────────────────────────────────────────────────────
create table if not exists sos_alerts (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid references rides(id),
  triggered_by uuid not null references profiles(id),
  triggered_by_role user_role not null,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'active', -- active | resolved | false_alarm
  -- snapshot of the "other party" so the record is meaningful even if the
  -- ride/profile changes later
  involved_driver_name text,
  involved_driver_phone text,
  vehicle_plate text,
  vehicle_description text,
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sos_alerts_status on sos_alerts(status);

-- ── SOS RESPONSES (the nearest drivers notified for each alert) ────────────
create table if not exists sos_responses (
  id uuid primary key default uuid_generate_v4(),
  sos_alert_id uuid not null references sos_alerts(id) on delete cascade,
  driver_id uuid not null references profiles(id),
  distance_km numeric(6,2),
  status text not null default 'notified', -- notified | acknowledged | notified_police | attending | arrived | no_response
  police_reference text,
  notes text,
  responded_at timestamptz,
  rewarded boolean not null default false,
  reward_type text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sos_responses_alert on sos_responses(sos_alert_id);
create index if not exists idx_sos_responses_driver on sos_responses(driver_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table referral_settings enable row level security;
alter table referrals enable row level security;
alter table ride_credits enable row level security;
alter table sos_alerts enable row level security;
alter table sos_responses enable row level security;

drop policy if exists "referral_settings_select_all" on referral_settings;
create policy "referral_settings_select_all" on referral_settings for select using (true);
drop policy if exists "referral_settings_admin_write" on referral_settings;
create policy "referral_settings_admin_write" on referral_settings
  for update using (is_admin());

drop policy if exists "referrals_select" on referrals;
create policy "referrals_select" on referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id or is_admin());
drop policy if exists "referrals_insert" on referrals;
create policy "referrals_insert" on referrals
  for insert with check (auth.uid() = referred_id);

drop policy if exists "ride_credits_select_own_or_admin" on ride_credits;
create policy "ride_credits_select_own_or_admin" on ride_credits
  for select using (auth.uid() = rider_id or is_admin());
drop policy if exists "ride_credits_update_own" on ride_credits;
create policy "ride_credits_update_own" on ride_credits
  for update using (auth.uid() = rider_id or is_admin());

-- SOS alerts: the triggering user, any notified driver, and admins can see it.
-- (Notified drivers need visibility to respond; matched via sos_responses.)
drop policy if exists "sos_alerts_select" on sos_alerts;
create policy "sos_alerts_select" on sos_alerts
  for select using (
    auth.uid() = triggered_by
    or is_admin()
    or exists (select 1 from sos_responses r where r.sos_alert_id = id and r.driver_id = auth.uid())
  );
drop policy if exists "sos_alerts_insert" on sos_alerts;
create policy "sos_alerts_insert" on sos_alerts
  for insert with check (auth.uid() = triggered_by);
drop policy if exists "sos_alerts_update" on sos_alerts;
create policy "sos_alerts_update" on sos_alerts
  for update using (auth.uid() = triggered_by or is_admin());

drop policy if exists "sos_responses_select" on sos_responses;
create policy "sos_responses_select" on sos_responses
  for select using (
    auth.uid() = driver_id
    or is_admin()
    or exists (select 1 from sos_alerts a where a.id = sos_alert_id and a.triggered_by = auth.uid())
  );
drop policy if exists "sos_responses_update_own_or_admin" on sos_responses;
create policy "sos_responses_update_own_or_admin" on sos_responses
  for update using (auth.uid() = driver_id or is_admin());

-- Realtime for live SOS + credit updates
do $$ begin
  alter publication supabase_realtime add table sos_alerts;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table sos_responses;
exception when duplicate_object then null; end $$;
