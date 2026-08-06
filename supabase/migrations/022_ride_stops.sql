-- ============================================================================
-- VUMA — intermediate stops on a ride
-- Run after 021_offer_expiry.sql
-- ============================================================================

create table if not exists ride_stops (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid not null references rides(id) on delete cascade,
  sequence integer not null, -- order between pickup (0) and dropoff
  address text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ride_stops_ride on ride_stops(ride_id, sequence);

alter table ride_stops enable row level security;

-- Mirrors the rides table's own visibility rule exactly: the rider, the
-- assigned driver, ANY driver while the ride is still open for bids
-- (status 'requested'/'negotiating' — they need to see stops before
-- deciding whether to bid, not just after), or admin.
drop policy if exists "ride_stops_select" on ride_stops;
create policy "ride_stops_select" on ride_stops
  for select using (
    exists (
      select 1 from rides r
      where r.id = ride_id
        and (
          r.rider_id = auth.uid()
          or r.driver_id = auth.uid()
          or r.status in ('requested', 'negotiating')
          or is_admin()
        )
    )
  );

-- Only the rider who owns the ride can add stops (at request time).
drop policy if exists "ride_stops_insert_own" on ride_stops;
create policy "ride_stops_insert_own" on ride_stops
  for insert with check (
    exists (select 1 from rides r where r.id = ride_id and r.rider_id = auth.uid())
  );

do $$ begin
  alter publication supabase_realtime add table ride_stops;
exception when duplicate_object then null; end $$;
