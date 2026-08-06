-- ============================================================================
-- VUMA — full database schema for Supabase (Postgres)
-- Run this once in Supabase SQL Editor (or via `supabase db push`).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── ENUMS ───────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('rider', 'driver', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ride_status as enum
    ('requested', 'negotiating', 'accepted', 'in_progress', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type offer_status as enum ('pending', 'countered', 'accepted', 'rejected', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type commission_mode as enum ('per_ride', 'subscription');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum ('active', 'expired', 'waived', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_period as enum ('weekly', 'monthly', 'once_off');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_type as enum ('ride_commission', 'subscription_payment', 'payout', 'refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type txn_status as enum ('pending', 'success', 'failed', 'reversed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type country_code as enum ('ZA', 'ZW', 'OTHER');
exception when duplicate_object then null; end $$;

-- ── PROFILES (extends auth.users) ──────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'rider',
  full_name text not null,
  phone text unique,
  email text unique,
  country country_code not null default 'ZA',
  avatar_url text,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── DRIVER PROFILES ─────────────────────────────────────────────────────────
create table if not exists driver_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  plate_number text,
  license_number text,
  verification_status text not null default 'pending', -- pending | verified | rejected
  is_online boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  rating_avg numeric(3,2) not null default 5.00,
  rating_count integer not null default 0,
  commission_mode commission_mode not null default 'per_ride',
  commission_override_pct numeric(5,2), -- null = use country default
  total_earnings numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

-- ── SUBSCRIPTION PLANS (admin-managed) ─────────────────────────────────────
create table if not exists subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  country country_code not null,
  period subscription_period not null default 'weekly',
  price numeric(10,2) not null,
  currency text not null default 'ZAR',
  commission_pct_while_active numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── DRIVER SUBSCRIPTIONS ────────────────────────────────────────────────────
create table if not exists driver_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references driver_profiles(user_id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status subscription_status not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  amount_paid numeric(10,2) not null default 0,
  waived_by uuid references profiles(id),
  waived_reason text,
  gateway text, -- payfast | paynow | mock
  gateway_ref text,
  created_at timestamptz not null default now()
);

-- ── RIDES ───────────────────────────────────────────────────────────────────
create table if not exists rides (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null references profiles(id),
  driver_id uuid references profiles(id),
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  distance_km numeric(6,2),
  suggested_fare numeric(10,2),
  rider_offer numeric(10,2) not null,
  final_fare numeric(10,2),
  currency text not null default 'ZAR',
  country country_code not null default 'ZA',
  status ride_status not null default 'requested',
  cancel_reason text,
  cancelled_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_rides_status on rides(status);
create index if not exists idx_rides_rider on rides(rider_id);
create index if not exists idx_rides_driver on rides(driver_id);

-- ── RIDE OFFERS (the negotiation thread) ───────────────────────────────────
create table if not exists ride_offers (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid not null references rides(id) on delete cascade,
  driver_id uuid not null references profiles(id),
  amount numeric(10,2) not null,
  message text,
  status offer_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_offers_ride on ride_offers(ride_id);

-- ── TRANSACTIONS (ledger) ───────────────────────────────────────────────────
create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid references rides(id),
  driver_id uuid references profiles(id),
  rider_id uuid references profiles(id),
  type txn_type not null,
  amount numeric(10,2) not null,
  commission_pct numeric(5,2),
  commission_amount numeric(10,2),
  currency text not null default 'ZAR',
  gateway text,
  gateway_ref text,
  status txn_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- ── RATINGS ─────────────────────────────────────────────────────────────────
create table if not exists ratings (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid not null references rides(id),
  from_user_id uuid not null references profiles(id),
  to_user_id uuid not null references profiles(id),
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(ride_id, from_user_id)
);

-- ── COMMISSION SETTINGS (country defaults) ─────────────────────────────────
create table if not exists commission_settings (
  country country_code primary key,
  default_pct numeric(5,2) not null default 10,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

insert into commission_settings (country, default_pct)
values ('ZA', 10), ('ZW', 8), ('OTHER', 10)
on conflict (country) do nothing;

-- ── ADMIN AUDIT LOG ─────────────────────────────────────────────────────────
create table if not exists admin_audit_log (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table profiles enable row level security;
alter table driver_profiles enable row level security;
alter table subscription_plans enable row level security;
alter table driver_subscriptions enable row level security;
alter table rides enable row level security;
alter table ride_offers enable row level security;
alter table transactions enable row level security;
alter table ratings enable row level security;
alter table commission_settings enable row level security;
alter table admin_audit_log enable row level security;

-- helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- profiles: users read/update their own row; admins read/update all
drop policy if exists "profiles_select_own_or_admin" on profiles;
create policy "profiles_select_own_or_admin" on profiles
  for select using (auth.uid() = id or is_admin());

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin" on profiles
  for update using (auth.uid() = id or is_admin());

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

-- driver_profiles: driver owns row, riders can read online drivers, admin all
drop policy if exists "driver_profiles_select" on driver_profiles;
create policy "driver_profiles_select" on driver_profiles
  for select using (true); -- public fleet visibility is required for matching

drop policy if exists "driver_profiles_upsert_own" on driver_profiles;
create policy "driver_profiles_upsert_own" on driver_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "driver_profiles_update_own_or_admin" on driver_profiles;
create policy "driver_profiles_update_own_or_admin" on driver_profiles
  for update using (auth.uid() = user_id or is_admin());

-- subscription_plans: everyone can read active plans, only admin writes
drop policy if exists "plans_select_all" on subscription_plans;
create policy "plans_select_all" on subscription_plans for select using (true);

drop policy if exists "plans_admin_write" on subscription_plans;
create policy "plans_admin_write" on subscription_plans
  for all using (is_admin()) with check (is_admin());

-- driver_subscriptions: driver sees own, admin sees/edits all
drop policy if exists "subs_select_own_or_admin" on driver_subscriptions;
create policy "subs_select_own_or_admin" on driver_subscriptions
  for select using (auth.uid() = driver_id or is_admin());

drop policy if exists "subs_insert_own" on driver_subscriptions;
create policy "subs_insert_own" on driver_subscriptions
  for insert with check (auth.uid() = driver_id or is_admin());

drop policy if exists "subs_admin_update" on driver_subscriptions;
create policy "subs_admin_update" on driver_subscriptions
  for update using (is_admin());

-- rides: rider & assigned driver see their ride; any online driver can see
-- 'requested'/'negotiating' rides (needed to bid); admin sees all
drop policy if exists "rides_select" on rides;
create policy "rides_select" on rides
  for select using (
    auth.uid() = rider_id
    or auth.uid() = driver_id
    or status in ('requested', 'negotiating')
    or is_admin()
  );

drop policy if exists "rides_insert_rider" on rides;
create policy "rides_insert_rider" on rides
  for insert with check (auth.uid() = rider_id);

drop policy if exists "rides_update" on rides;
create policy "rides_update" on rides
  for update using (auth.uid() = rider_id or auth.uid() = driver_id or is_admin());

-- ride_offers: rider (via ride) and offering driver can see; drivers insert own
drop policy if exists "offers_select" on ride_offers;
create policy "offers_select" on ride_offers
  for select using (
    auth.uid() = driver_id
    or is_admin()
    or exists (select 1 from rides r where r.id = ride_id and r.rider_id = auth.uid())
  );

drop policy if exists "offers_insert_driver" on ride_offers;
create policy "offers_insert_driver" on ride_offers
  for insert with check (auth.uid() = driver_id);

drop policy if exists "offers_update" on ride_offers;
create policy "offers_update" on ride_offers
  for update using (
    auth.uid() = driver_id
    or is_admin()
    or exists (select 1 from rides r where r.id = ride_id and r.rider_id = auth.uid())
  );

-- transactions: participants + admin
drop policy if exists "txns_select" on transactions;
create policy "txns_select" on transactions
  for select using (auth.uid() = driver_id or auth.uid() = rider_id or is_admin());

drop policy if exists "txns_admin_write" on transactions;
create policy "txns_admin_write" on transactions
  for insert with check (true); -- server (service role) writes these

-- ratings: participants + admin
drop policy if exists "ratings_select" on ratings;
create policy "ratings_select" on ratings
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id or is_admin());

drop policy if exists "ratings_insert" on ratings;
create policy "ratings_insert" on ratings
  for insert with check (auth.uid() = from_user_id);

-- commission_settings: everyone reads, admin writes
drop policy if exists "commission_select_all" on commission_settings;
create policy "commission_select_all" on commission_settings for select using (true);

drop policy if exists "commission_admin_write" on commission_settings;
create policy "commission_admin_write" on commission_settings
  for update using (is_admin());

-- admin_audit_log: admin only
drop policy if exists "audit_admin_only" on admin_audit_log;
create policy "audit_admin_only" on admin_audit_log
  for all using (is_admin()) with check (is_admin());

-- ============================================================================
-- REALTIME: enable replication for live-updating tables
-- ============================================================================
alter publication supabase_realtime add table rides;
alter publication supabase_realtime add table ride_offers;
alter publication supabase_realtime add table driver_profiles;
