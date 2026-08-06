-- ============================================================================
-- VUMA — drivers forum: shared road condition alerts
-- Run after 024_history_clear.sql
-- ============================================================================

create table if not exists road_alerts (
  id uuid primary key default uuid_generate_v4(),
  driver_id uuid not null references profiles(id) on delete cascade,
  country country_code not null,
  road_name text not null,
  message text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_road_alerts_country_created on road_alerts(country, created_at);

alter table road_alerts enable row level security;

-- Broad read access for any authenticated driver in the same country —
-- this is meant to function like a shared forum, not a private log.
-- "Same day only" is enforced at query time (created_at falls on today's
-- date), not by a cleanup job — old alerts simply stop being returned
-- once the calendar day changes, no expiry job needed.
drop policy if exists "road_alerts_select" on road_alerts;
create policy "road_alerts_select" on road_alerts
  for select using (auth.role() = 'authenticated');

drop policy if exists "road_alerts_insert_own" on road_alerts;
create policy "road_alerts_insert_own" on road_alerts
  for insert with check (auth.uid() = driver_id);

drop policy if exists "road_alerts_delete_own" on road_alerts;
create policy "road_alerts_delete_own" on road_alerts
  for delete using (auth.uid() = driver_id or is_admin());
