-- ============================================================================
-- VUMA — public ride tracking (for "share my ride" links)
-- Run after 004_contact_and_chat.sql
-- ============================================================================

-- A friend/family member who receives a shared ride link has no Vuma
-- account, so they can't be covered by the normal RLS policies (which all
-- require auth.uid() to match a participant). Views in Postgres run with
-- the privileges of the view's owner by default, not the querying role, so
-- this view can safely expose a narrow, whitelisted set of columns to
-- anonymous visitors without granting them any broader table access — the
-- underlying `rides`, `profiles`, and `driver_profiles` tables keep their
-- existing RLS untouched for every other kind of access.
--
-- Deliberately excluded: rider identity/contact, the negotiation history
-- (ride_offers), rider_offer, and anything not needed for a third party to
-- confirm "this ride is real and here's where it is."
create or replace view ride_tracking_public as
select
  r.id,
  r.status,
  r.pickup_address,
  r.pickup_lat,
  r.pickup_lng,
  r.dropoff_address,
  r.dropoff_lat,
  r.dropoff_lng,
  r.final_fare,
  r.currency,
  r.country,
  r.created_at,
  p.full_name as driver_name,
  dp.vehicle_make,
  dp.vehicle_model,
  dp.vehicle_color,
  dp.plate_number,
  dp.current_lat as driver_lat,
  dp.current_lng as driver_lng
from rides r
left join profiles p on p.id = r.driver_id
left join driver_profiles dp on dp.user_id = r.driver_id;

grant select on ride_tracking_public to anon, authenticated;
