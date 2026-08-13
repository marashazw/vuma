-- ============================================================================
-- VUMA PRIVATE — fix infinite recursion in group_members RLS policies
-- Run after 049_vuma_private_fee_transaction_type.sql
--
-- Root cause: vuma_private_group_members_select_own_group (045) and
-- vuma_private_group_members_insert_cooption (047) each contained a
-- subquery selecting from vuma_private_group_members itself, to check
-- "is the current user already a member of this same group." Postgres
-- applies RLS to that inner subquery too — which means re-evaluating the
-- very same policy, whose subquery selects from the table again, forever.
-- A SECURITY DEFINER function runs with the function owner's privileges,
-- not the calling user's RLS context, so the lookup inside it never
-- re-triggers the policy that's calling it. This is the standard,
-- documented way to break this specific class of recursion in Postgres.
-- ============================================================================

create or replace function is_member_of_vuma_private_group(check_group_id uuid) returns boolean as $$
  select exists (
    select 1 from vuma_private_group_members
    where group_id = check_group_id and profile_id = auth.uid()
  );
$$ language sql security definer stable;

drop policy if exists "vuma_private_group_members_select_own_group" on vuma_private_group_members;
create policy "vuma_private_group_members_select_own_group" on vuma_private_group_members
  for select using (
    profile_id = auth.uid()
    or is_member_of_vuma_private_group(group_id)
    or is_admin()
  );

drop policy if exists "vuma_private_group_members_insert_cooption" on vuma_private_group_members;
create policy "vuma_private_group_members_insert_cooption" on vuma_private_group_members
  for insert with check (
    exists (
      select 1 from vuma_associates_memberships
      where profile_id = vuma_private_group_members.profile_id
        and status = 'active'
        and auto_accept_cooption = true
    )
    and is_member_of_vuma_private_group(group_id)
  );

-- These two didn't self-reference (different table), but they do query
-- into vuma_private_group_members, which was the actual source of the
-- recursion — switched to the same function for consistency and to
-- remove any remaining direct subquery into that table from elsewhere.
drop policy if exists "vuma_private_groups_select_member" on vuma_private_groups;
create policy "vuma_private_groups_select_member" on vuma_private_groups
  for select using (
    auth.uid() = created_by
    or is_member_of_vuma_private_group(id)
    or is_admin()
  );

drop policy if exists "vuma_private_trip_requests_select_group_member" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_select_group_member" on vuma_private_trip_requests
  for select using (
    is_member_of_vuma_private_group(group_id)
    or is_admin()
  );

drop policy if exists "vuma_private_trip_requests_insert_group_member" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_insert_group_member" on vuma_private_trip_requests
  for insert with check (
    auth.uid() = requested_by
    and is_member_of_vuma_private_group(group_id)
  );
