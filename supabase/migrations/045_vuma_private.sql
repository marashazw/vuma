-- ============================================================================
-- VUMA PRIVATE — a private, group-scoped cost-sharing club
-- Run after 044_require_verification_for_topup.sql
--
-- Distinct in kind from the main marketplace: no public visibility (group
-- members only), no negotiated fare (cost-split only, markup blocked at
-- the database level, not just the UI), and the driver is the one
-- volunteering a trip they were already making — a requester cannot
-- "hire" anyone. This is the mechanism the legal framing depends on, so
-- it's enforced with a check constraint, not left to client-side trust.
--
-- Table names deliberately keep the vuma_associates_* prefix from the
-- earlier membership system rather than a global rename to vuma_private_*
-- — the membership mechanism itself (constitution acceptance, pending/
-- active status, admin approval) is unchanged, only its purpose and
-- public-facing name changed. Renaming every reference across the app
-- would be high-risk for zero functional benefit; only user-facing text
-- needed to change.
-- ============================================================================

create table if not exists vuma_private_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  invite_code text not null unique,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists vuma_private_group_members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references vuma_private_groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (group_id, profile_id)
);

create table if not exists vuma_private_trip_requests (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references vuma_private_groups(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  destination_address text not null,
  destination_lat numeric(9,6),
  destination_lng numeric(9,6),
  needed_at timestamptz not null,
  seats_needed integer not null default 1 check (seats_needed > 0),
  note text,
  status text not null default 'open' check (status in ('open', 'locked', 'cancelled', 'completed')),
  accepted_offer_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists vuma_private_trip_offers (
  id uuid primary key default uuid_generate_v4(),
  trip_request_id uuid not null references vuma_private_trip_requests(id) on delete cascade,
  driver_id uuid not null references profiles(id),
  seats_available integer not null check (seats_available > 0),
  estimated_total_cost numeric(10,2) not null check (estimated_total_cost >= 0),
  cost_per_person numeric(10,2) not null check (cost_per_person >= 0),
  note text,
  status text not null default 'offered' check (status in ('offered', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  -- The actual enforcement of "no markup, cost-split only" — a driver
  -- cannot post a per-person figure that adds up to more than the
  -- estimated total cost across everyone riding (driver included). Some
  -- rounding slack (1 currency unit) is allowed for practical splitting,
  -- not as room for profit.
  constraint no_markup check (cost_per_person * (seats_available + 1) <= estimated_total_cost + 1)
);

alter table vuma_private_trip_requests
  add constraint vuma_private_trip_requests_accepted_offer_fkey
  foreign key (accepted_offer_id) references vuma_private_trip_offers(id);

create index if not exists idx_vuma_private_trip_requests_group on vuma_private_trip_requests(group_id, status);
create index if not exists idx_vuma_private_trip_offers_request on vuma_private_trip_offers(trip_request_id);

alter table vuma_private_groups enable row level security;
alter table vuma_private_group_members enable row level security;
alter table vuma_private_trip_requests enable row level security;
alter table vuma_private_trip_offers enable row level security;

-- A group's existence/name is visible only to its own members and the
-- creator — this is what "no public advertising" actually means at the
-- data level, not just something the UI declines to show.
drop policy if exists "vuma_private_groups_select_member" on vuma_private_groups;
create policy "vuma_private_groups_select_member" on vuma_private_groups
  for select using (
    auth.uid() = created_by
    or exists (select 1 from vuma_private_group_members where group_id = id and profile_id = auth.uid())
    or is_admin()
  );

drop policy if exists "vuma_private_groups_insert_own" on vuma_private_groups;
create policy "vuma_private_groups_insert_own" on vuma_private_groups
  for insert with check (auth.uid() = created_by);

drop policy if exists "vuma_private_group_members_select_own_group" on vuma_private_group_members;
create policy "vuma_private_group_members_select_own_group" on vuma_private_group_members
  for select using (
    profile_id = auth.uid()
    or exists (select 1 from vuma_private_group_members m2 where m2.group_id = group_id and m2.profile_id = auth.uid())
    or is_admin()
  );

drop policy if exists "vuma_private_group_members_insert_own" on vuma_private_group_members;
create policy "vuma_private_group_members_insert_own" on vuma_private_group_members
  for insert with check (auth.uid() = profile_id);

drop policy if exists "vuma_private_trip_requests_select_group_member" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_select_group_member" on vuma_private_trip_requests
  for select using (
    exists (select 1 from vuma_private_group_members where group_id = vuma_private_trip_requests.group_id and profile_id = auth.uid())
    or is_admin()
  );

drop policy if exists "vuma_private_trip_requests_insert_group_member" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_insert_group_member" on vuma_private_trip_requests
  for insert with check (
    auth.uid() = requested_by
    and exists (select 1 from vuma_private_group_members where group_id = vuma_private_trip_requests.group_id and profile_id = auth.uid())
  );

drop policy if exists "vuma_private_trip_requests_update_requester" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_update_requester" on vuma_private_trip_requests
  for update using (auth.uid() = requested_by or is_admin());

drop policy if exists "vuma_private_trip_offers_select_group_member" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_select_group_member" on vuma_private_trip_offers
  for select using (
    exists (
      select 1 from vuma_private_trip_requests r
      join vuma_private_group_members m on m.group_id = r.group_id
      where r.id = trip_request_id and m.profile_id = auth.uid()
    )
    or is_admin()
  );

drop policy if exists "vuma_private_trip_offers_insert_group_member" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_insert_group_member" on vuma_private_trip_offers
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1 from vuma_private_trip_requests r
      join vuma_private_group_members m on m.group_id = r.group_id
      where r.id = trip_request_id and m.profile_id = auth.uid()
    )
  );

drop policy if exists "vuma_private_trip_offers_update_own_or_requester" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_update_own_or_requester" on vuma_private_trip_offers
  for update using (
    auth.uid() = driver_id
    or is_admin()
    or exists (select 1 from vuma_private_trip_requests r where r.id = trip_request_id and r.requested_by = auth.uid())
  );

-- Membership fee settings — deliberately separate from commission_settings,
-- since this is framed to members as a membership fee, never a commission,
-- and applies platform-wide rather than per-country like commission does
-- (a private cost-share club isn't priced the same way a regulated fare
-- market is).
create table if not exists vuma_private_fee_settings (
  id boolean primary key default true check (id),
  fee_type text not null default 'monthly' check (fee_type in ('monthly', 'per_trip', 'none')),
  fee_amount numeric(10,2) not null default 0,
  currency text not null default 'USD',
  updated_by uuid references profiles(id),
  updated_at timestamptz
);
insert into vuma_private_fee_settings (id) values (true) on conflict (id) do nothing;

alter table vuma_private_fee_settings enable row level security;
drop policy if exists "vuma_private_fee_settings_select" on vuma_private_fee_settings;
create policy "vuma_private_fee_settings_select" on vuma_private_fee_settings
  for select using (auth.role() = 'authenticated' or auth.role() = 'service_role');
