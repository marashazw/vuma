-- ============================================================================
-- VUMA PRIVATE — fix co-option check reading a row RLS hides from the caller
-- Run after 050_vuma_private_fix_recursion.sql
--
-- vuma_private_group_members_insert_cooption checks whether the TARGET
-- person (the one being added) has auto_accept_cooption = true, by
-- querying vuma_associates_memberships. But that table's own SELECT
-- policy only ever allows auth.uid() = profile_id — i.e. your own row
-- only. From the calling user's perspective, the target's row is
-- invisible, so the EXISTS check always came back false regardless of
-- the target's actual toggle. Same fix pattern as 050: a SECURITY
-- DEFINER function performs the lookup outside the caller's RLS context,
-- since this is a deliberate, legitimate cross-user check (verifying
-- someone else's standing consent), not something the normal
-- "read your own row only" rule should apply to.
-- ============================================================================

create or replace function has_auto_accept_cooption(target_profile_id uuid) returns boolean as $$
  select exists (
    select 1 from vuma_associates_memberships
    where profile_id = target_profile_id and status = 'active' and auto_accept_cooption = true
  );
$$ language sql security definer stable;

drop policy if exists "vuma_private_group_members_insert_cooption" on vuma_private_group_members;
create policy "vuma_private_group_members_insert_cooption" on vuma_private_group_members
  for insert with check (
    has_auto_accept_cooption(profile_id)
    and is_member_of_vuma_private_group(group_id)
  );
