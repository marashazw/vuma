-- ============================================================================
-- VUMA — admin role switching (view as driver / rider)
-- Run after 019_deluxe_multiplier.sql
-- ============================================================================

-- A PERMANENT flag, separate from the mutable `role` column. `role` now
-- represents the CURRENT view an admin is operating in (admin/driver/rider)
-- and can be switched at will; `is_super_admin` never changes when they
-- switch — it's what every admin-gated check (both RLS and application
-- code) should key off from now on, so switching away from the admin view
-- never risks losing the ability to switch back.
alter table profiles
  add column if not exists is_super_admin boolean not null default false;

update profiles set is_super_admin = true where role = 'admin';

-- is_admin() is referenced by RLS policies across most tables in this
-- project — updating its body here cascades correctly everywhere in one
-- change, no need to touch individual policies.
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_super_admin = true
  );
$$ language sql security definer stable;
