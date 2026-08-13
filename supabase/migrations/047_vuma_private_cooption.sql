-- ============================================================================
-- VUMA PRIVATE — member-level consent to co-option into a group
-- Run after 046_vuma_private_platform_visibility.sql
--
-- A different consent model from platform-wide trip-request visibility
-- (046): rather than broadcasting a single post to everyone active, a
-- member can pre-authorise being added directly into any group by an
-- existing member of that group — but only if they've explicitly opted
-- in via this standing toggle on their own membership. Off by default,
-- same reasoning as 046: nothing about Vuma Private should default
-- toward broader reach without the specific person's own choice.
-- ============================================================================

alter table vuma_associates_memberships
  add column if not exists auto_accept_cooption boolean not null default false;

-- A member needs to be able to toggle this themselves — no update policy
-- existed on this table at all before now. Deliberately not a broad
-- "can update own row" policy: that would also let someone set their own
-- status to 'active', bypassing admin approval entirely. The trigger
-- below is what actually enforces "only this one column," the policy
-- alone can't express a column-level restriction.
drop policy if exists "vuma_associates_update_own" on vuma_associates_memberships;
create policy "vuma_associates_update_own" on vuma_associates_memberships
  for update using (auth.uid() = profile_id or auth.role() = 'service_role');

create or replace function protect_vuma_associates_membership_columns() returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.status is distinct from old.status
    or new.constitution_version is distinct from old.constitution_version
    or new.constitution_accepted_at is distinct from old.constitution_accepted_at
    or new.paid_up_until is distinct from old.paid_up_until
    or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at
  then
    raise exception 'Only auto_accept_cooption can be changed directly by a member';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_protect_vuma_associates_membership_columns on vuma_associates_memberships;
create trigger trg_protect_vuma_associates_membership_columns
  before update on vuma_associates_memberships
  for each row execute function protect_vuma_associates_membership_columns();

-- Adding someone else to a group is otherwise only possible for that
-- person themselves (vuma_private_group_members_insert_own, from
-- migration 045, requires auth.uid() = profile_id) — this is what makes
-- the pre-consent model real rather than cosmetic: an existing group
-- member can only add someone who has genuinely, standingly agreed to
-- be added by anyone, checked here at insert time, not assumed from a
-- generic "is a member" status.
drop policy if exists "vuma_private_group_members_insert_cooption" on vuma_private_group_members;
create policy "vuma_private_group_members_insert_cooption" on vuma_private_group_members
  for insert with check (
    exists (
      select 1 from vuma_associates_memberships
      where profile_id = vuma_private_group_members.profile_id
        and status = 'active'
        and auto_accept_cooption = true
    )
    and exists (
      select 1 from vuma_private_group_members existing
      where existing.group_id = vuma_private_group_members.group_id and existing.profile_id = auth.uid()
    )
  );
