-- ============================================================================
-- VUMA — Vuma Associates membership system
-- Run after 041_driver_declaration.sql
--
-- A membership-based networking society for riders and drivers, separate
-- from the core marketplace mechanics. Deliberately modelled as its own
-- set of tables rather than a single boolean flag on profiles — the
-- requirement explicitly anticipates "more benefits will be added later,"
-- and a dedicated membership record (with its own status lifecycle,
-- constitution-acceptance record, and paid-up tracking) is what makes
-- that extensible without needing to keep bolting fields onto profiles.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Membership records
-- ---------------------------------------------------------------------------
create table if not exists vuma_associates_memberships (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade unique,
  role text not null check (role in ('rider', 'driver')),
  status text not null default 'pending' check (status in ('pending', 'active', 'lapsed', 'revoked')),
  constitution_version text not null default '1.0',
  constitution_accepted_at timestamptz not null default now(),
  paid_up_until timestamptz, -- null while still 'pending' or if no expiry has been set
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_vuma_associates_status on vuma_associates_memberships(status);

alter table vuma_associates_memberships enable row level security;

drop policy if exists "vuma_associates_select_own_or_admin" on vuma_associates_memberships;
create policy "vuma_associates_select_own_or_admin" on vuma_associates_memberships
  for select using (auth.uid() = profile_id or is_admin());

-- A person can create their own pending membership record by accepting the
-- constitution — this is the sign-up flow itself, done directly from the
-- client. Moving it to 'active' (paid up) is service-role only (admin
-- approval), matching every other "admin confirms payment" flow in this
-- app.
drop policy if exists "vuma_associates_insert_own" on vuma_associates_memberships;
create policy "vuma_associates_insert_own" on vuma_associates_memberships
  for insert with check (auth.uid() = profile_id and status = 'pending');

-- ---------------------------------------------------------------------------
-- 2. Time-windowed ride-access restrictions
--
-- Deliberately a single mechanism covering both "restrict Deluxe or all
-- rides to Associates" and "restrict non-members/unpaid members from
-- requesting or bidding" — those are the same underlying rule described
-- from two directions (who can access vs. who can't), not two separate
-- systems.
-- ---------------------------------------------------------------------------
create table if not exists ride_access_restrictions (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('deluxe_only', 'all_rides')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_access_restrictions_window on ride_access_restrictions(is_active, starts_at, ends_at);

alter table ride_access_restrictions enable row level security;

-- Any authenticated user needs to be able to check whether a restriction
-- currently applies to them (e.g. before submitting a bid) — same
-- transparency principle as commission rates and charge_types already
-- being readable by anyone.
drop policy if exists "ride_access_restrictions_select" on ride_access_restrictions;
create policy "ride_access_restrictions_select" on ride_access_restrictions
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 3. Global settings (singleton row)
-- ---------------------------------------------------------------------------
create table if not exists vuma_associates_settings (
  id boolean primary key default true check (id), -- forces exactly one row
  require_membership_for_driver_registration boolean not null default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz
);

insert into vuma_associates_settings (id) values (true) on conflict (id) do nothing;

alter table vuma_associates_settings enable row level security;

drop policy if exists "vuma_associates_settings_select" on vuma_associates_settings;
create policy "vuma_associates_settings_select" on vuma_associates_settings
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 4. Rider wallet top-ups — riders previously had no way to add funds to
--    their own wallet_balance at all; it could only ever be earned via
--    driver-issued change credit (and was subject to those caps). This is
--    a new, separate top-up path gated to paid-up Vuma Associates members,
--    explicitly NOT governed by the change-credit caps, since it's a
--    different source of funds entirely — a direct deposit, not credit
--    issued by another user.
-- ---------------------------------------------------------------------------
create table if not exists rider_wallet_topups (
  id uuid primary key default uuid_generate_v4(),
  rider_id uuid not null references profiles(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null,
  reference_code text,
  proof_of_payment_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rider_wallet_topup_has_evidence check (reference_code is not null or proof_of_payment_path is not null)
);

alter table rider_wallet_topups enable row level security;

drop policy if exists "rider_wallet_topups_select_own_or_admin" on rider_wallet_topups;
create policy "rider_wallet_topups_select_own_or_admin" on rider_wallet_topups
  for select using (auth.uid() = rider_id or is_admin());

drop policy if exists "rider_wallet_topups_insert_own" on rider_wallet_topups;
create policy "rider_wallet_topups_insert_own" on rider_wallet_topups
  for insert with check (auth.uid() = rider_id);

alter publication supabase_realtime add table rider_wallet_topups;
