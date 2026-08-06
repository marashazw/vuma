-- ============================================================================
-- VUMA — Vuma Deluxe tier (executive/top-of-range vehicles)
-- Run after 017_gateway_toggle.sql
-- ============================================================================

-- Driver-side certification status. Requested by the driver, granted only by
-- an admin after a physical inspection — never self-certified.
alter table driver_profiles
  add column if not exists deluxe_status text not null default 'none',
  add column if not exists deluxe_requested_at timestamptz,
  add column if not exists deluxe_certified_at timestamptz,
  add column if not exists deluxe_next_inspection_due timestamptz,
  add column if not exists deluxe_notes text;

alter table driver_profiles
  add constraint driver_profiles_deluxe_status_check
  check (deluxe_status in ('none', 'pending', 'certified', 'expired'));

-- Ride-side: set by the rider at request time. Deluxe cars can bid on both
-- deluxe and regular requests — only regular (non-certified) drivers are
-- restricted, and only from seeing/bidding on deluxe requests specifically.
alter table rides
  add column if not exists is_deluxe boolean not null default false;

-- Hard enforcement, not just a UI filter: a non-certified driver cannot bid
-- on a deluxe-marked ride even by bypassing the app's UI. Extends the
-- existing capacity + suspension checks from earlier migrations rather
-- than replacing them.
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
        and (dp.suspended_until is null or dp.suspended_until <= now())
        and (r.is_deluxe = false or dp.deluxe_status = 'certified')
    )
  );
