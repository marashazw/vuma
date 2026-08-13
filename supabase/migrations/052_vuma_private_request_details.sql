-- ============================================================================
-- VUMA PRIVATE — pickup location, vehicle preference, multi-group sharing
-- Run after 051_vuma_private_fix_cooption_check.sql
-- ============================================================================

alter table vuma_private_trip_requests
  add column if not exists pickup_address text,
  add column if not exists pickup_lat numeric(9,6),
  add column if not exists pickup_lng numeric(9,6),
  add column if not exists wants_deluxe boolean not null default false;

-- Lets a request be shared with additional groups beyond its own
-- (primary) group_id, without changing what group_id itself means
-- anywhere else in the schema — every existing policy and query that
-- already relies on group_id keeps working unchanged. Same additive
-- pattern as platform-wide visibility (046): a new, separate mechanism
-- that grants further visibility, rather than replacing the original.
create table if not exists vuma_private_trip_request_shares (
  id uuid primary key default uuid_generate_v4(),
  trip_request_id uuid not null references vuma_private_trip_requests(id) on delete cascade,
  group_id uuid not null references vuma_private_groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (trip_request_id, group_id)
);

alter table vuma_private_trip_request_shares enable row level security;

drop policy if exists "vuma_private_trip_request_shares_select_group_member" on vuma_private_trip_request_shares;
create policy "vuma_private_trip_request_shares_select_group_member" on vuma_private_trip_request_shares
  for select using (is_member_of_vuma_private_group(group_id) or is_admin());

-- Only the requester can decide which additional groups see their own
-- request, and only into groups they're themselves a member of — this
-- mirrors the same requirement already enforced when a request is
-- originally created.
drop policy if exists "vuma_private_trip_request_shares_insert_requester" on vuma_private_trip_request_shares;
create policy "vuma_private_trip_request_shares_insert_requester" on vuma_private_trip_request_shares
  for insert with check (
    is_member_of_vuma_private_group(group_id)
    and exists (
      select 1 from vuma_private_trip_requests r
      where r.id = trip_request_id and r.requested_by = auth.uid()
    )
  );

-- Visibility of the request itself (and its offers) needs to extend to
-- any group it's been additionally shared with, not just its own
-- group_id — additive to the existing group-based and platform-wide
-- policies, not a replacement for either.
drop policy if exists "vuma_private_trip_requests_select_shared" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_select_shared" on vuma_private_trip_requests
  for select using (
    exists (
      select 1 from vuma_private_trip_request_shares s
      where s.trip_request_id = vuma_private_trip_requests.id and is_member_of_vuma_private_group(s.group_id)
    )
  );

drop policy if exists "vuma_private_trip_offers_select_shared" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_select_shared" on vuma_private_trip_offers
  for select using (
    exists (
      select 1 from vuma_private_trip_request_shares s
      where s.trip_request_id = vuma_private_trip_offers.trip_request_id and is_member_of_vuma_private_group(s.group_id)
    )
  );

drop policy if exists "vuma_private_trip_offers_insert_shared" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_insert_shared" on vuma_private_trip_offers
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1 from vuma_private_trip_request_shares s
      where s.trip_request_id = vuma_private_trip_offers.trip_request_id and is_member_of_vuma_private_group(s.group_id)
    )
  );
