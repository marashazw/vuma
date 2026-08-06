-- ============================================================================
-- VUMA — vehicle capacity matching
-- Run after 005_public_ride_tracking.sql
-- ============================================================================

alter table driver_profiles
  add column if not exists vehicle_seats integer;

alter table rides
  add column if not exists seats_required integer not null default 1;

-- Hard enforcement, not just a UI filter: a driver can only submit an offer
-- if their own vehicle's seat capacity meets or exceeds what the ride
-- requires. A driver with no vehicle_seats set yet (coalesced to 0) is
-- blocked from bidding on anything until they complete their vehicle
-- details — this is intentional.
drop policy if exists "offers_insert_driver" on ride_offers;
create policy "offers_insert_driver" on ride_offers
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1
      from rides r
      join driver_profiles dp on dp.user_id = auth.uid()
      where r.id = ride_offers.ride_id
        and coalesce(dp.vehicle_seats, 0) >= r.seats_required
    )
  );
