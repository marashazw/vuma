-- ============================================================================
-- VUMA PRIVATE — opt-in platform-wide visibility for a trip request
-- Run after 045_vuma_private.sql
--
-- Off by default ('group'). Vuma Private's entire legal framing rests on
-- being a private circle of people who already know each other — the
-- same reasoning as texting a WhatsApp group, not posting to a public
-- board. Letting a request reach every active member platform-wide
-- starts to resemble general advertising again if it were the default;
-- kept explicit and opt-in per post so the poster is making a deliberate
-- choice each time, not something the app nudges them toward.
-- ============================================================================

alter table vuma_private_trip_requests
  add column if not exists visibility text not null default 'group' check (visibility in ('group', 'platform'));

-- A platform-visible request is readable by any active (paid-up) Vuma
-- Private member, not just the posting group's own members — the
-- group-only policy from 045 already covers the default case and stays
-- unchanged; this is purely additive.
drop policy if exists "vuma_private_trip_requests_select_platform" on vuma_private_trip_requests;
create policy "vuma_private_trip_requests_select_platform" on vuma_private_trip_requests
  for select using (
    visibility = 'platform'
    and exists (
      select 1 from vuma_associates_memberships
      where profile_id = auth.uid() and status = 'active'
    )
  );

-- Same broadening for offers on a platform-visible request — a member
-- outside the posting group needs to be able to actually respond, not
-- just see that the request exists.
drop policy if exists "vuma_private_trip_offers_select_platform" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_select_platform" on vuma_private_trip_offers
  for select using (
    exists (
      select 1 from vuma_private_trip_requests r
      where r.id = trip_request_id
        and r.visibility = 'platform'
        and exists (select 1 from vuma_associates_memberships where profile_id = auth.uid() and status = 'active')
    )
  );

drop policy if exists "vuma_private_trip_offers_insert_platform" on vuma_private_trip_offers;
create policy "vuma_private_trip_offers_insert_platform" on vuma_private_trip_offers
  for insert with check (
    auth.uid() = driver_id
    and exists (
      select 1 from vuma_private_trip_requests r
      where r.id = trip_request_id
        and r.visibility = 'platform'
        and exists (select 1 from vuma_associates_memberships where profile_id = auth.uid() and status = 'active')
    )
  );
