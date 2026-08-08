-- ============================================================================
-- VUMA — driver dashboard notices/ads
-- Run after 034_rider_suspension_reason.sql
--
-- Deliberately no fixed "type" enum for the label — admin writes whatever
-- heading fits ("Sponsored ad", "Urgent notice", anything else), since the
-- space itself isn't pre-labelled as one category or another.
-- ============================================================================

create table if not exists driver_notices (
  id uuid primary key default uuid_generate_v4(),
  label text not null,              -- admin-specified kicker, e.g. "Sponsored ad" / "Urgent notice"
  title text not null,
  body text,
  link_url text,
  link_label text,
  position text not null default 'right' check (position in ('left', 'right')),
  is_active boolean not null default true,
  expires_at timestamptz,           -- null = runs until manually deactivated
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_driver_notices_active on driver_notices(is_active, position, expires_at);

alter table driver_notices enable row level security;

-- Any authenticated driver can read currently-active, non-expired
-- notices — filtering by is_active/expires_at happens in the query, not
-- the policy, so the admin console can still see everything (active,
-- expired, deactivated) for the repost/history view.
drop policy if exists "driver_notices_select" on driver_notices;
create policy "driver_notices_select" on driver_notices
  for select using (auth.role() = 'authenticated');

-- Writes are service-role only (admin API routes), matching the pattern
-- used for every other admin-managed setting in this app.
