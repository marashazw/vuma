-- ============================================================================
-- VUMA — in-ride contact reveal + chat
-- Run after 003_referrals_and_sos.sql
-- ============================================================================

-- Lets a rider and driver read each other's name/phone ONLY while they share
-- an active (accepted or in_progress) ride together. Access automatically
-- revokes the moment the ride completes or is cancelled, since this is
-- re-evaluated on every query rather than being a one-time grant.
create or replace function shares_active_ride(other_id uuid) returns boolean as $$
  select exists (
    select 1 from rides
    where status in ('accepted', 'in_progress')
      and (
        (rider_id = auth.uid() and driver_id = other_id)
        or (driver_id = auth.uid() and rider_id = other_id)
      )
  );
$$ language sql security definer stable;

drop policy if exists "profiles_select_active_ride_contact" on profiles;
create policy "profiles_select_active_ride_contact" on profiles
  for select using (shares_active_ride(id));

-- ── RIDE CHAT ────────────────────────────────────────────────────────────────
create table if not exists ride_messages (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid not null references rides(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_messages_ride on ride_messages(ride_id);

alter table ride_messages enable row level security;

drop policy if exists "ride_messages_select" on ride_messages;
create policy "ride_messages_select" on ride_messages
  for select using (
    exists (select 1 from rides r where r.id = ride_id and (r.rider_id = auth.uid() or r.driver_id = auth.uid()))
    or is_admin()
  );

-- Only while the ride is actually active — no messaging before a driver is
-- assigned, or after the trip is over.
drop policy if exists "ride_messages_insert" on ride_messages;
create policy "ride_messages_insert" on ride_messages
  for insert with check (
    auth.uid() = sender_id
    and exists (
      select 1 from rides r
      where r.id = ride_id
        and (r.rider_id = auth.uid() or r.driver_id = auth.uid())
        and r.status in ('accepted', 'in_progress')
    )
  );

do $$ begin
  alter publication supabase_realtime add table ride_messages;
exception when duplicate_object then null; end $$;
