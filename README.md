# Vuma — fare-negotiation rideshare app (South Africa & Zimbabwe, extensible anywhere)

Vuma is a full-stack ride-hailing platform built around transparent fare negotiation: riders
name their price, drivers counter, both sides watch the offer converge in real time. It ships
as a Progressive Web App (installable on any phone from the browser — no app store needed),
built with Next.js 16 + Supabase, ready to deploy on Vercel.

## What's included, out of the box

- **Rider app** — pickup/drop-off search (free OpenStreetMap geocoding), real road-distance
  fare guidance and route drawn on the map (OSRM), live fare negotiation, ride history,
  ratings.
- **Driver app** — go online/offline with live location, browse and bid on open requests,
  start/complete trips, earnings dashboard, subscription plan purchase, document
  verification upload flow (gated: can't go online until an admin verifies you).
- **Admin dashboard** — platform overview with charts, driver document review (view
  uploaded ID/license/vehicle docs via signed URLs, approve/reject with a reason), per-driver
  commission overrides, country-wide commission settings, subscription plan management
  (create plans, waive fees, grant comped subscriptions), and a full transaction ledger.
- **Real road routing** — distance, ETA, and the actual road-following route line come from
  OSRM (free public instance, no API key), with an automatic straight-line fallback if the
  routing service is briefly unreachable.
- **Driver document verification** — drivers upload ID, license, vehicle registration, and a
  profile photo to a private Supabase Storage bucket; admins review via signed URLs and
  approve or reject with a reason the driver can see. Unverified drivers see a banner and
  can't toggle online.
- **Driver ETA + live approach tracking** — once a ride is accepted, the rider sees a live
  "arriving in ~X min" estimate and an actual road route from the driver's current position
  to the pickup point, not just a raw dot on the map. Driver location now broadcasts
  continuously from the moment they open the driver app (not just after tapping "Start
  trip"), so this stays accurate through the whole approach phase.
- **In-ride contact + chat** — once matched, a rider and driver can see each other's name,
  tap to call directly (`tel:` link), and message each other in a simple live chat — all
  scoped so access only exists while the ride is actually active and disappears once it
  ends or is cancelled.
- **Share my ride (WhatsApp)** — a rider can share live trip details (route, driver name,
  vehicle, plate, fare) with anyone via WhatsApp, including a link to a public, no-login
  tracking page so a friend or family member can follow along without needing an account.
- **App invite sharing** — explicit, always-visible WhatsApp/Email/Facebook/X buttons for
  inviting friends (not just a single generic share button, which silently does nothing
  useful on most desktop browsers that lack the Web Share API).
- **Admin-configurable fare guidance** — the "fair range" shown to riders (base fare +
  per-km rate, shown as a low/high range) is no longer hardcoded — tune it per country from
  **Admin → Commissions** any time you need to adjust for the local market, no code change
  or redeploy required.
- **Vehicle capacity matching** — riders specify how many seats they need; drivers set
  their vehicle's seat capacity (new: an actual input form for vehicle details, which
  previously had no UI at all). A driver can only bid on a ride if their capacity meets or
  exceeds what's required — enforced at the database level, not just filtered in the UI, so
  it can't be bypassed. Every driver offer a rider sees shows the vehicle type, seat count,
  ETA to pickup, and plate number, so a car pulling up at a busy pickup spot is easy to
  identify.
- **PDF receipts** — either side can download a branded PDF receipt for a completed ride
  (trip details, driver, vehicle, fare), generated entirely client-side. Driver/vehicle
  details are snapshotted onto the ride at completion time so the receipt stays accurate
  even though normal contact-reveal access expires once a ride ends.
- **In-ride chat notifications** — unread messages show a clearly-visible firebrick-red
  badge (an earlier lighter shade failed accessibility contrast) plus a short notification
  chirp when a message arrives while the chat panel is collapsed.
- **Manual payment as the default subscription flow** — drivers see admin-configured payment
  instructions (account details, free-text instructions, and an optional clickable external
  link — e.g. to a payment portal or EcoCash web page) front and center, and can submit
  either a transaction reference code, an uploaded proof-of-payment file (screenshot or PDF,
  stored in a private bucket only that driver and admins can access), or both. Card/mobile
  gateway payment (PayFast/Paynow) is still available as an alternative, tucked behind a
  "prefer to pay by card instead?" toggle. Every manual submission — reference code, upload,
  or both — waits for admin review before the subscription activates, same as before.
- **Rider wallet (change credit)** — if a driver doesn't have exact change, they can credit
  the rider's Vuma wallet with the difference instead of physical cash, up to $2/R20 per
  rider and $5/R50 total per driver, per month. Issuing a credit debits the driver's own
  spendable credit balance (a separate ledger, not cash); when a rider later applies their
  wallet balance to reduce cash owed on a future ride, the accepting driver earns that same
  spendable credit back (also capped at $5/R50/month) — redeemable only toward their
  subscription payment or a priority-ranking boost, never as cash. Both caps are enforced
  server-side with clear rejection messages, and drivers see an advance notice on any open
  request that involves a wallet credit before they bid.
- **Referral rewards** — riders get a shareable invite link; once enough invited friends
  complete their first ride (admin-configurable threshold, per country), the referrer gets a
  free ride credit. Any driver can honor that credit ride — it carries 0% commission for
  them plus a priority-ranking window (their offers sort to the top of the rider's
  negotiation list, with a visible "Priority" badge) as compensation.
- **Driver-to-driver referrals** — drivers get their own shareable invite link; once enough
  referred drivers (admin-configurable, per country) each complete a minimum number of rides,
  the referrer earns spendable credit — paid into the same credit_balance used for change
  credits, so it's redeemable the same way (subscription payment or priority boost, never
  cash). A driver can only ever be referred once (enforced by a database uniqueness
  constraint, not just app logic). Fraud detection: if a new driver's vehicle plate matches
  an existing driver's plate on file, their account is flagged — this doesn't block them from
  driving, but withholds their referral from counting toward anyone's reward until an admin
  reviews it.
- **Structured driver ratings + auto-escalation** — beyond the star rating, riders can
  optionally tag a driver Polite/Rude, On time/Very late, Car clean/Dirty, or leave an "Other"
  comment that goes straight to admin, not the driver. If the same adverse tag shows up on 5+
  ratings for a driver within one calendar month, a warning is automatically issued; a 3rd
  warning for the *same* issue automatically suspends the driver from taking rides for 7 days
  — enforced both in the UI (Go online is disabled) and at the database level (bid
  submissions are blocked outright), so it can't be bypassed. Admins have full visibility
  (Admin → Moderation) into every warning and can lift a suspension early if warranted.
- **Vuma Deluxe** — a premium tier for executive/top-of-range vehicles. Drivers request
  certification (Verify page); an admin grants it only after a physical inspection, with an
  optional next-inspection-due date and notes, and can mark a certification expired later if
  a re-inspection is needed. Riders can request a Deluxe ride (a toggle on the request
  screen), which shows a suggested fare range at the Deluxe rate — **admin-adjustable per
  country** (Admin → Commissions → "Deluxe ×", default 1.5×), not hardcoded. **Interpretation
  note**: "drivers also pay 150% of the regular fees" was implemented as the commission
  *percentage itself* scaling by that same multiplier on deluxe rides (not just the natural
  higher absolute amount a bigger fare would produce at the same rate) — if that's not what
  was intended, it's a contained change in `app/api/rides/[id]/complete/route.ts`. Visibility
  is one-directional: a certified Deluxe driver sees and can bid on *both* deluxe and regular
  requests, but a non-certified driver never sees deluxe-marked requests at all — enforced
  both in the driver's request feed and at the database level (bid submissions are blocked
  outright for non-certified drivers on deluxe rides).
- **Admin role switching** — a super-admin can switch their current view to Driver or Rider
  at the click of a button (Admin dashboard → "View as") to test either experience using
  their own account, and switch back just as easily (a persistent "Back to Admin" bar
  follows them into whichever section they're viewing). Switching to Driver for the first
  time auto-provisions and pre-verifies a `driver_profiles` row, so there's no onboarding
  friction. Built on a permanent `is_super_admin` flag, deliberately kept separate from the
  `role` column that switching actually changes — every admin-gated check (RLS policies and
  API routes alike) keys off the permanent flag, so switching away from the admin view can
  never accidentally lock an admin out of switching back.
- **Multi-stop rides** — riders can add one or more intermediate stops between pickup and
  drop-off ("+ Add a stop along the way"). Real road distance/duration is calculated through
  every leg (not just pickup-to-dropoff as the crow flies), fare guidance reflects the true
  total distance, and any driver browsing an open request — not just after they've bid —
  sees a "N stops — not direct" badge so they know upfront. Stops show as distinct markers on
  the map and as an ordered address list on both the rider's and driver's ride screens.
- **Nearby drivers preview** — once a rider sets a pickup point, a line appears just below
  the map ("6 drivers nearby, ~5 min away") using online, verified drivers within a 15km
  radius — before the rider commits to a request, not after.
- **Bid auto-expiry** — a driver's offer that isn't accepted within 1 hour is marked expired
  automatically. There's no cron job involved (Vercel's Hobby-tier cron limits made that
  impractical for hourly precision) — expiry is checked lazily wherever offers are loaded, and
  hard-enforced again at the moment of acceptance to close a possible race-condition gap.
- **Country-restricted address search** — a rider in Zimbabwe now only sees Zimbabwe address
  results (and vice versa for South Africa), instead of both countries always being searched
  together.
- **Fixed: riders mistakenly signing up as drivers** — a driver referral link
  (`?driverRef=`) silently pre-selected "Driver" on the signup form with no visible
  explanation, so someone clicking a driver's referral link who actually wanted to ride
  could easily miss it and end up with a driver account. Now shows an explicit banner
  explaining the pre-selection when it applies. Also fixed a related data-integrity bug: an
  already-registered person re-submitting the signup form (regardless of why) could
  previously get a stray `driver_profiles` row created for them independent of their real
  account role, since a swallowed duplicate-key error still let the rest of signup's
  side-effects run. **Admin → that driver's detail page** now has a "Convert to rider"
  action for any already-affected accounts (only appears for accounts with no documents
  submitted yet, to avoid accidentally offering it for a real driver mid-verification).
- **Fixed: several pages could get stuck on an infinite loading spinner** — a widespread
  pattern (`if (!user) return;` with no further action) meant that if a session check ever
  came back empty — a timing hiccup, not necessarily a genuine logged-out state — the page
  would stop loading forever with no error and no way to recover short of a hard reload.
  Fixed consistently across every page that had it (driver verification, driver referrals,
  driver subscription, rider referrals, rider wallet): now resets the loading state and
  redirects to login instead of hanging silently.
- **App opens straight to the map for logged-in users** — the marketing landing page now
  checks for an existing session server-side and redirects immediately to the right
  dashboard, instead of showing marketing content every single time the installed app
  opens even for someone already logged in. Paired with a **"Keep me logged in on this
  device"** toggle (Settings) — on by default (matching the app's existing behavior), turn
  it off on a shared/public device and the session won't persist past closing the browser.
  Implemented via the auth cookie's own lifetime (a session cookie vs. a long-lived one),
  not a switch to browser storage, since the Supabase SSR client relies on cookies
  specifically so server components and API routes can also read the session — swapping to
  localStorage/sessionStorage would have silently broken every server-side auth check in
  the app.
- **Select and clear trip history** — a rider can tap "Select" on their trip history,
  choose specific trips, and clear them from their own list. This only hides them from
  that rider's own view (a `hidden_by_rider` flag) — the underlying ride, the driver's own
  history, commission/financial records, and admin analytics are all untouched.
- **Stale negotiations auto-cancel after 24 hours** — a ride stuck in `requested` or
  `negotiating` with no response for a full day is automatically cancelled, same
  no-cron-job sweep-on-normal-usage pattern as bid expiry (Vercel's Hobby-tier cron limits
  ruled out a real scheduled job). Deliberately marks the ride cancelled rather than
  deleting it outright — several tables reference `rides` without cascading deletes
  (`ride_credits`, `sos_alerts`, `transactions`, `ratings`), so a hard delete risked a
  constraint violation the moment any of those happened to apply, and would have silently
  orphaned a referral credit or wallet hold instead of properly releasing it back. Reuses
  the exact same unwinding logic as a manual cancellation for that reason.
- **Drivers Forum** — drivers can post shared road-condition alerts (Driver → Forum) — a
  broken-down truck, road closure, anything worth flagging — geocoded to a location, visible
  to other drivers in the same country **for the rest of that calendar day only** (filtered
  at query time by date, not a cleanup job — an alert simply stops appearing once the day
  changes). When a driver picks up a ride, the app checks every point along the actual route
  against that day's alerts (within ~5km) and surfaces any match directly on the ride
  screen, with "reported X ago" so the driver knows how fresh it is. Any driver can mark an
  alert **resolved** ("the truck's been moved") — both from the forum list and right from an
  active trip's matched-alert banner — which stops it appearing anywhere for anyone. The
  forum also has an **"Ask a Question"** thread ("Is Seke Road congested right now?"), where
  replies are threaded under the question, and a driver can **"Log it"** on their own reply
  to instantly post it as a proper alert in the main list — the road reference carries over
  from the question automatically, no need to re-type it.
- **Weather advisory for riders** — once a destination is selected, a quick check against
  Open-Meteo (free, no API key) surfaces a one-line heads-up near the offer box if it's
  raining ("you may need an umbrella"), cold ("you might need a coat"), or notably hot at
  the destination — never blocks the request flow if the weather service is unavailable.
- **Driver prepaid wallet — real-time commission collection** — previously, commission was
  only ever *recorded* at ride completion (a `transactions` row), with no actual mechanism
  for Vuma to collect it from a per-ride (non-subscription) driver. Now every driver has a
  prepaid wallet balance; commission is resolved and **deducted immediately at trip-start**
  (`/api/rides/[id]/start`), not completion — deliberately, since waiting until completion
  would let a driver leave a ride "in progress" indefinitely rather than settle up. A driver
  whose wallet is empty and who isn't on an active subscription can't go online or submit new
  bids, enforced in two places (going online, and bidding) so a balance that drops mid-session
  is caught even without toggling offline and back on. Top-ups go through the same
  proof-of-payment-plus-admin-approval flow as subscriptions (Driver → Wallet to request,
  Admin → Wallet Top-ups to review). The completion route was updated to reuse the exact
  figures already deducted at start rather than re-resolving from scratch — this also fixed a
  real bug where the Vuma Deluxe commission multiplier would otherwise have been applied
  twice.
- **Scheduled (fixed-time) rides** — a rider can book a ride for a specific future date and
  time instead of immediately (a "Schedule for later" toggle after route selection; requires
  at least 30 minutes' notice). Drivers see a clearly marked "SCHEDULED TRIP" badge on the
  open-requests feed with a "view details" expansion showing the date/time before they decide
  whether to bid. Once accepted, cancelling within 1 hour of the scheduled time — or a driver
  no-show — flags the responsible party's account (**not** a monetary penalty; an earlier
  version charged drivers 50% of the fare, since replaced with a flag-based approach applied
  equally to both roles). **A second flag within a rolling 3-month window results in a 7-day
  suspension** (not permanent). A suspended rider or driver can submit an **appeal**
  (Admin → Appeals reviews these, with final discretion resting with admin — approving an
  appeal lifts the suspension immediately). Either side can instead **propose a mutual
  cancellation** with a reason (flight delay, illness, etc.); if the other side accepts, no
  flag applies to either party. A rider can also report a driver no-show once the scheduled
  time has passed — this correctly flags the driver, not the rider making the report. Admins
  can also apply a **scheduled-trip fee factor** (Admin → Commissions, "Scheduled ×"),
  affecting both fare guidance and commission the same way the Vuma Deluxe multiplier does —
  the two **stack** rather than override each other, so a scheduled Deluxe ride reflects
  both factors combined. **Correction**: this stacking was only ever actually true for fare
  guidance shown to riders — `resolveFullCommission` (the function used at the moment
  commission is genuinely charged) never applied the scheduled multiplier at all, only
  Deluxe. Fixed while building the wallet-affordability check below, since that check needed
  to be accurate for scheduled trips and would otherwise have inherited the same gap.
- **A driver can only have one active immediate trip at a time** — if a driver accepts a new
  ride while another is still `in_progress`, that new ride's screen stays gated (no map, no
  fare, no Start button — just a clear "finish your current trip first" prompt with a direct
  link to it) until the current trip is completed. Enforced server-side in the trip-start
  route itself, not just as a UI suggestion. **Scheduled rides are exempt from this viewing
  gate** — since they're for a future time regardless, there's no real conflict in a driver
  viewing or preparing for one while another trip is currently underway; the actual
  trip-start block still applies at the real moment of starting, for genuine physical
  double-booking safety.
- **Scheduled-ride messaging reflects the actual situation** — the rider's "Arriving in X
  min" countdown (which assumes the driver is currently en route) only shows once a scheduled
  trip's appointment is genuinely imminent (within 45 minutes); well before that, it correctly
  shows "Driver confirmed for [date/time]" instead, since the driver isn't actually heading
  there yet for an appointment hours or days away. The driver's "Accepted — let's go!" banner
  is similarly reworded for a scheduled trip ("Accepted! Set a reminder for this appointment")
  since "let's go" doesn't fit something that isn't happening yet.
- **Fixed: a scheduled ride that never got matched could go silently stuck** — investigating
  this surfaced a real bug in the 24-hour stale-negotiation sweep (built before scheduled
  rides existed): it judges staleness purely by `created_at`, but a scheduled ride is
  routinely booked days ahead of its actual appointment — meaning it could be auto-cancelled
  by that sweep long before its scheduled time even arrived. Fixed by exempting scheduled
  rides from that sweep entirely (their own `scheduled_at` is the relevant reference point,
  not creation time). Separately, when a scheduled ride's appointment time genuinely does
  pass without ever being matched to a driver, the rider now gets a clear prompt — "keep it
  open" (converts it to a normal, immediate request, visible and behaving exactly like any
  other open request from that point) or cancel outright — rather than the request just
  sitting there indefinitely with no resolution in sight.
- **In-app trip reminders** — both rider and driver dashboards show a countdown banner for
  any accepted scheduled trip within the next 24 hours, with an optional "Set reminder" button
  that requests browser notification permission and, if granted, fires a local reminder about
  an hour before. **Honest limitation, stated in the UI itself**: this only fires while the
  app is actually open (foreground or backgrounded tab) — it is not a true push notification
  that would wake the device if the app were fully closed, since that needs separate
  infrastructure (VAPID keys, a service worker push handler, a server-side scheduler) not
  currently wired up. The in-app dashboard banner is the reliable part regardless of
  notification permission, since it just reads straight from the database on every visit.
  **Once the scheduled time actually arrives, the banner switches from a countdown to an
  arrival-confirmation prompt**, different for each role: a driver is asked "Have you
  arrived?" — answering yes navigates them straight to the ride so they can tap Start Trip
  themselves (deliberately not auto-started, since that has real consequences — a wallet
  deduction, a status change — that shouldn't happen without an explicit tap). A rider is
  asked "Is your driver here?" — if they say no or don't respond, the prompt escalates after
  10 minutes into a "Report driver no-show" option, using the exact same 10-minute threshold
  as the no-show report button on the ride screen itself, so the two stay consistent.
- **Driver wallet — subscription payment via wallet balance** — a driver can pay for a
  subscription plan directly from their prepaid wallet balance (mirroring the existing "pay
  with credit balance" flow exactly). Wallet top-ups now also require an explicit,
  timestamped consent confirmation ("this deposit will not be refundable and will only be
  applied towards ride commissions and subscriptions") before submission.
  **Fixed a double-crediting bug**: an earlier version of this feature also credited a
  driver's prepaid wallet when a rider covered part of a fare with their own Vuma Wallet
  (change) credit — but that event was already correctly compensated by a pre-existing,
  separate mechanism (`credit_balance`, capped at a monthly redemption limit) at ride
  completion. The two together meant a driver was compensated twice for the same shortfall,
  and the newer, uncapped path silently bypassed the monthly anti-abuse limit the original
  mechanism was deliberately designed to enforce. Removed the duplicate; the original,
  capped mechanism is the one place this compensation happens.
- **System-wide accounting integrity — no fictitious money, no privilege escalation via
  direct client tampering** — a systematic audit (prompted by fixing a driver change-credit
  balance check) found that `profiles` and `driver_profiles` row-level security restricted
  *which row* an authenticated user could update, but nothing restricted *which column* or
  *value* — meaning a direct API call bypassing the UI entirely could set `wallet_balance`,
  `is_super_admin`, `role`, `verification_status`, `credit_balance`, `prepaid_wallet_balance`,
  or any other sensitive field on the caller's own account to anything at all. Fixed with
  database-level triggers, not just application code, since RLS alone can't express "block
  this column unless the caller is Vuma's own service role" and application-layer checks can
  always be bypassed by a direct request the UI never makes. Numeric financial fields only
  block *increases* from non-service-role callers (a decrease is a user legitimately
  spending their own balance, never the exploit risk); status/privilege fields are blocked
  outright except a narrow, genuinely legitimate carve-out (a driver may move their own
  verification or Deluxe status to `pending` — requesting review — but never directly to an
  approved or rejected outcome). Every existing legitimate direct-client mutation in the
  entire codebase was traced and verified against these rules before this shipped, to
  confirm nothing real would break. A related, more specific gap was fixed at the same
  time: a rider's wallet-credit application to a new ride was computed client-side with no
  server-side re-verification of their actual current balance — now enforced atomically by
  a database trigger that re-reads the true balance and rejects the ride outright if there
  isn't enough, rather than trusting a client-supplied figure. The change-credit issuing
  route (the one that started this audit) also now verifies a driver actually holds enough
  `credit_balance` before letting them give it away, rather than allowing that balance to go
  silently negative.
- **Change-credit monthly caps are now admin-configurable** (Admin → Commissions, per
  country) — previously hardcoded. These caps are deliberately a *separate* safeguard from
  the accounting-integrity fix above, not made redundant by it: the integrity fix prevents a
  balance from ever going invalid (negative or tampered), while these caps bound how much
  value can move through the change-credit system even when every individual balance
  involved is perfectly valid — the backstop against abuse patterns and the failure that
  hasn't been found yet, not against invalid numbers. Raising either cap is gated behind an
  explicit confirmation that restates this reasoning — visible every time, not just on first
  use — since loosening a deliberate safety margin shouldn't blend in with an ordinary
  settings change.
- **Change-credit shortfall — now disclosed before, not after** — when a rider covers part
  of a fare with their own wallet credit, the completing driver is compensated for the
  difference, but only up to their remaining monthly redemption room (the cap above).
  Previously, if a ride's wallet-applied amount exceeded that room, the driver only found
  out *after* completing the trip — the shortfall itself was never tracked or refunded
  anywhere, just silently absorbed. Now it's disclosed up front, both on the open-requests
  feed before a driver bids and on the ride screen before they start the trip: "You'd only
  be compensated $X of that $Y — you're near your monthly redemption limit," so a driver can
  decide with full information rather than being surprised afterward. The driver's Earnings
  page also now shows a full per-transaction history of this credit (previously only the
  running total was visible, with no way to see which ride a given change came from).
- **A third, rider-scoped change-credit cap** — the original two caps (Admin → Commissions)
  are both scoped per-driver: how much *one driver* can give *one rider*, and how much *one
  driver* can issue in total. Neither catches a rider receiving credit from several
  *different* drivers, each independently staying within their own limit, while the rider's
  total accumulates well past what any single cap implies. Added a third, independent check:
  how much *one rider* can accrue in total, from any number of drivers combined, per month
  (default R40 / $4, admin-configurable, same "confirm before raising" treatment as the
  other two). Checked against the sum across *all* drivers' `issued_change_credit`
  transactions for that rider, not scoped to whoever's currently issuing.
- **Fraud & Suspicious Activity console** (Admin → Fraud) — a read-only reporting view, never
  automated action, surfacing patterns worth a human look: the same driver crediting the same
  rider's wallet across 2+ different months (occasional change shortages are normal, a
  recurring pairing is a different pattern); drivers or riders repeatedly at or near their
  monthly change-credit caps in 2+ of the last 3 months; anyone with 3+ rides cancelled after
  reaching "accepted" status in the last 30 days; scheduled-ride cancellation flags shown from
  the very first one (not just once someone's about to hit the 2-flag suspension threshold, so
  admin has earlier visibility); and duplicate-vehicle-plate flags consolidated here alongside
  everything else rather than only visible buried in the drivers list. Every section explains
  what it means and why it's shown — the page is explicit that a flag isn't an accusation, just
  a pattern worth reviewing, since there's often an ordinary explanation.
- **Deluxe applications now actually visible before clicking into a driver** — previously a
  pending Deluxe application showed nowhere except on that specific driver's own detail page,
  meaning admin had no way to notice one existed short of clicking into every driver
  individually. The drivers list now shows a clear "Deluxe application pending" badge
  alongside the existing certified badge. Also hardened the Quick Tasks query behind this
  (and the driver-verification one right next to it) — both used an embedded PostgREST join
  on the same non-standard FK naming (`driver_profiles.user_id -> profiles.id`) already
  documented elsewhere in this file as having silently dropped rows once before, in the
  Income Statement's driver wallet aggregation. Replaced with the same separate-query-plus-JS-join
  pattern used there, and added `export const dynamic = "force-dynamic"` to the Overview
  page as cheap insurance against any caching masking a freshly-submitted application.
- **"N drivers nearby" now shows profile pictures** — the rider request page's nearby-driver
  badge previously showed only a count and an ETA estimate; it now shows a small stacked-avatar
  row for the closest few (up to 5) who actually have a photo on file — a driver without one is
  simply skipped from the row rather than shown with a placeholder icon. **A real
  access-control finding surfaced while building this**: a direct client
  query for other drivers' name/avatar wouldn't have worked at all — `profiles` SELECT is
  restricted to your own row, admin, or someone you already share an active ride with, and a
  rider browsing nearby drivers happens *before* any ride exists, so none of those conditions
  would be true. Rather than widen RLS to let any authenticated user read arbitrary profile
  rows (which would expose far more than just a name and photo, since RLS grants or denies
  whole rows, not individual columns), this uses a narrow server-side route
  (`/api/drivers/public-info`) that returns only `full_name` and `avatar_url`, and only for
  drivers it independently re-verifies are currently online and verified — not a general
  "look up any user by id" tool.
  **Correction, found and fixed in a later round**: this originally queried
  `profiles.avatar_url` — a field nothing in this codebase ever actually writes to. The real
  profile photo (uploaded during verification, explicitly labelled "shown to riders" in that
  flow) lives at `driver_profiles.profile_photo_path`, in the *private* `driver-documents`
  bucket alongside ID documents — meaning even the correct field alone wasn't enough, since a
  rider's browser can't load a private bucket path as a plain image URL. Fixed by generating a
  short-lived signed URL server-side (via `createSignedUrls`, 1-hour expiry) in the same route,
  rather than exposing the bucket more broadly. Until this fix, no driver's real photo had ever
  actually appeared here, regardless of how correctly they'd uploaded one.
- **Pickup marker redesigned as a humanoid "hailing" badge, and a closer street-level zoom** —
  requested against a reference screenshot from a competitor app. The pickup pin is now a black
  rounded badge with a white person-hailing silhouette, connected by a stem to the precise
  coordinate below, replacing the previous plain teardrop pin. The map's initial zoom now
  matches the street-level detail it was already dynamically settling on once a pickup point
  exists (16–17), just without a brief flash at the old, wider zoom on first render.
- **Exact addresses the geocoder can't find (e.g. a specific house number on a side street)
  can be typed in directly** — many Zimbabwean addresses genuinely aren't geocoded with
  house-number precision yet in Google's own map data, even though the geocode route already
  runs Google's dedicated Geocoding API in parallel with Text Search specifically to maximize
  exact-match precision where the data exists. When it doesn't, no amount of better querying
  fixes data that isn't there. Two things address this together: the existing floating "Where
  from" badge on the map (pickup only — the rider's own current location) stays as it was,
  editable in place; and `LocationSearchInput` is now a controlled component that shows the
  actual selected address as real, editable text for pickup, dropoff, and stops alike
  (previously it only ever showed as a grayed-out placeholder — nothing was actually there to
  edit). A rider can drag any pin to the exact spot and then edit the text directly — e.g.
  adding "1606" or a suburb name the geocoder couldn't resolve — committed on blur or Enter,
  distinct from selecting a fresh result from the dropdown. A dropoff-side map badge was tried
  and deliberately dropped before shipping, reconsidered as likely too cluttered on a
  224px-tall map already carrying a route line, two markers, and a screen-edge effect — the
  editable search field covers dropoff and stops without that risk.
- **Tax & levy charges** (Admin → Charges) — a generic, admin-managed system for deducting
  regulatory charges (VAT, a road fund levy, a municipal levy — whatever becomes necessary,
  not a single hardcoded field) from the driver on every ride, alongside commission. Each
  charge is either a percentage of the fare or a flat amount, configured per country, and
  toggleable active/inactive without deleting the historical record of what it was. Applies
  unconditionally — deliberately independent of `resolveCommissionPct`/`resolveFullCommission`,
  since the requirement is explicitly that this applies "whether the driver is on per-ride
  commission or a periodic subscription," unlike commission itself which has subscription
  exemptions built in. Deducted from the driver's prepaid wallet at trip-start, the same
  moment and same atomic update as commission, with its own wallet transaction row per charge
  so a driver's history clearly shows what each deduction was for. **On the Income
  Statement**, this is deliberately kept separate from Vuma's own revenue and shown in its own
  "Due to regulator" section — money collected here isn't earned, it passes through the
  platform on behalf of a third party, and folding it into revenue (or even into the existing
  "outstanding liabilities" snapshot, which is a different kind of figure — a current balance,
  not a period-collected flow) would have misstated both figures. **Driver-facing
  transparency**: Driver → Earnings now shows a "Where your fares went" breakdown — total
  commission paid and total taxes/levies paid, shown as two separate figures rather than one
  combined deduction, with a line-item breakdown by charge name when more than one is active.
- **A driver's arrival confirmation on a scheduled trip now actually reaches the rider** —
  previously a driver tapping "Yes, I'm here" was a pure UI navigation with nothing persisted
  anywhere, meaning the rider's side had no way to know it had happened at all. Now written to
  `rides.driver_confirmed_arrival_at`, with a realtime subscription so the rider sees it
  immediately rather than only on their next reload. When this happens before the rider has
  reciprocated, they're shown an immediate dialog — "Your driver says they've arrived — is
  that right?" — with three options: confirm, cancel (a normal cancellation, which still
  correctly flags the rider per the existing rules if they're simply changing their mind), or
  report a no-show (which correctly flags the driver instead, since that's specifically for
  disputing an arrival claim that doesn't match reality). Shown ahead of the normal 10-minute
  grace-period-gated prompt, since the driver has already made a specific, disputable claim
  worth letting the rider act on immediately rather than waiting out the usual window.
- **Mandatory driver declaration before verification submission** — a required checkbox
  ("I understand that I am authorised by relevant legislation and authorities to participate
  in this business, my vehicle is appropriately insured and certified, and I promise to be in
  full compliance with local laws at all times. I acknowledge that Vuma will not be held
  accountable for my actions and omissions") gates the Submit for Review button, alongside
  the existing document/vehicle-completeness checks. Timestamped
  (`driver_profiles.declaration_accepted_at`), same reasoning as wallet top-up consent — a
  real record of when it was accepted, not just a boolean.
- **Scheduled rides never show a live "arriving in X min" countdown, at any proximity** —
  previously this switched to the live countdown once genuinely close to the scheduled time,
  but that implies active GPS tracking of a driver actually en route, which isn't a
  meaningful signal for a scheduled appointment even when imminent (the driver's location
  could be broadcasting for unrelated reasons, not necessarily already heading to pickup).
  Now always shows "Driver scheduled to arrive at [date/time]" instead, for the life of a
  scheduled ride.
- **Rider can no longer "Cancel" once a scheduled trip's time has arrived — only confirm
  arrival or report a no-show.** Removed from both the dashboard reminder dialog
  (`TripReminder`) and the ride screen's own cancel panel (`ScheduledCancelPanel`, which had
  been left showing "Cancel directly" regardless of timing — a real bypass of the same
  restriction just added to the dashboard dialog). Both options are available whether or not
  the driver has explicitly confirmed arrival, since they may genuinely be there even without
  having tapped their own confirmation button. Reporting a no-show now happens directly from
  the dialog itself (previously just a link to the ride page) and, once processed, shows a
  follow-up prompt — "Driver reported as a no-show. Want to book another ride?" — rather than
  leaving the rider with nothing after their trip is cancelled out from under them.
- **Driver dashboard's scheduled-trip reminder now updates live, without a refresh** — a real
  gap found while making the change above: only the rider side ever had a realtime
  subscription; the driver side only ever fetched once on mount. A newly-accepted scheduled
  ride, or any status change, wouldn't show up until the driver manually reloaded. Both sides
  now subscribe.
- **Explicit outcome when a mutual-cancellation proposal is rejected, with a real choice
  afterward** — previously a rejection was silent: the ride's `scheduled_cancel_status` just
  flipped back and the proposer's screen quietly reverted to the normal panel, with no
  message explaining what had happened or why. Now the proposer sees "The other side declined
  your cancellation request" with two explicit options: **proceed with the trip** (resets
  cleanly, no consequence to either side) or **cancel anyway** — which flags the cancelling
  party's account regardless of how far in advance this happens, unlike an ordinary
  cancellation, which only flags within the 1-hour lock window. Deliberately overriding an
  explicit objection from the other side is treated differently from a routine early
  cancellation with no disagreement attached to it. The other party sees their own
  confirmation too ("You declined... the trip continues as scheduled, unless they decide to
  cancel anyway"). Both sides already had realtime subscriptions filtered to their own ride,
  so whichever choice gets made reaches the other person's screen automatically — no separate
  notification mechanism needed.
- **A cancellation proposal (or its rejection) is now impossible to miss from the dashboard**
  — previously the only way to discover either was opening the specific ride's detail page
  directly; the dashboard reminder gave no signal at all. Now interrupts the normal countdown
  card entirely with a prominent red "Urgent: cancellation requested" (or "...declined") alert,
  linking straight to the ride — checked and shown at any point in the countdown, not only
  once the scheduled time is close, since a proposal can arrive at any time.
- **Fixed: an accepted scheduled ride neither party ever resolved could hold a driver's
  commission reservation hostage forever** — found via a driver reporting a small amount
  ("$0.42 held for upcoming scheduled trips") showing on their wallet with no scheduled trip
  anywhere in their UI to explain it. The count-zero arrival-confirmation dialogs in
  `TripReminder` are the intended way an accepted scheduled ride resolves once its time
  arrives, but they only fire while someone is actually looking at the app — if neither the
  rider nor the driver opens it around the scheduled time, nothing ever prompts a resolution,
  and the ride just sits in `accepted` indefinitely, invisible to every UI (`TripReminder`
  only shows trips within a 24-hour window) but still holding the driver's reservation.
  `sweep-stale-negotiations` didn't cover this either — that one is specifically for a ride
  that never got matched at all, a different problem. A new sweep
  (`sweep-abandoned-scheduled`), called opportunistically the same way, auto-cancels and
  releases the reservation for any accepted scheduled ride still unresolved 24 hours past its
  scheduled time — a generous grace period, since this is a last-resort safety net, not the
  primary resolution path. Runs platform-wide rather than per-user, so it should self-heal
  any already-stuck reservation on the next dashboard load from anyone, not just the affected
  driver.
- **Open-requests count in the driver nav** — "Requests" now shows a live count in
  terracotta, e.g. "Requests (3)", on both the mobile bottom nav and the desktop tabs. A
  shared hook (`useOpenRequestsCount`) avoids duplicating the query across the two nav
  variants — a lightweight approximation (count of `requested`/`negotiating` rides in the
  driver's own country) rather than replicating the dashboard's full seat-capacity/Deluxe
  filtering, which matters for what's actually shown in the list but is more detail than a
  nav badge needs.
- **Basic rider lookup** (Admin → Riders) — previously there was no way to look up a rider at
  all beyond their name showing up in lists elsewhere; the fraud console's rider-side flags
  had nowhere to link to. Now a simple search (name, phone, email) leads to a detail page
  showing wallet balance, available referral credit, scheduled-ride strikes, every change
  credit received (from any driver, not just one), and recent trip history with a
  cancellation count — everything relevant to actually investigating one of the fraud
  console's flags in one place.
- **Manual account freeze, for both roles** (on both the driver and the new rider detail
  page) — previously the only ways an account could become suspended were fully automatic
  (rating-based, or the scheduled-ride strike system); there was no way for admin to act
  immediately on something urgent while still investigating. A "Freeze account while
  investigating" button sets an indefinite hold with a required, specific reason (shown to
  the account holder, kept on file, logged in the admin audit log) — lifted explicitly via a
  "Restore access" button once the investigation concludes, never on a timer. Uses the exact
  same `suspended_until` mechanism the automatic systems already rely on, so it's respected
  everywhere suspension is already checked, with no new enforcement path to get wrong.
- **Driver dashboard notices/ads** (Admin → Notices) — admin can post to a side space on the
  driver dashboard, visible on wide screens where the centered layout already left space
  unused either side of the main content. Deliberately, the space itself carries no fixed
  label or category — whatever heading the admin writes ("Sponsored ad," "Urgent notice,"
  or anything else) is the only labelling that appears. Each notice has an optional expiry
  date (no expiry means it runs until manually taken down), a left/right position choice,
  and an optional link. The console keeps every past notice, live or not, with a one-click
  **Repost** that pre-fills a new draft from an old one's content rather than needing to
  retype it — the original stays in history with its own dates intact, since reposting
  creates a new entry rather than reactivating the old one.
- **Personalized low-balance reminders** — a driver gets a "top up soon" nudge on their
  dashboard and Wallet page once their balance drops below **30% of whichever is higher: the
  amount of their last top-up, or their average daily commission usage over the last 30
  days**. A flat threshold wouldn't serve every driver well — someone who tops up in large,
  infrequent amounts and someone who tops up little-and-often have genuinely different
  "getting low" points, so the threshold adapts to each driver's own pattern rather than
  using one number for everyone. This is a soft, earlier nudge — separate from (and well
  before) the hard block that already prevents going online at a $0 balance.
- **Accounting console (Admin → Transactions / Income Statement)** — the Transactions tab is
  now a full filterable console: date range (latest first by default), driver, and
  transaction type — including a breakdown by commission *source* (subscription rate,
  referral credit, reward credit, country default), not just a single lumped commission
  figure. A separate **Income Statement** view shows the state of the business for any
  chosen period: commission and subscription revenue earned, broken down and totaled, next
  to what's currently **owed** — driver prepaid wallet balances, the pro-rated *unearned*
  portion of every active subscription (what's been paid but not yet "earned" by the
  passage of time), rider wallet balances, and available rider referral credits. Figures are
  kept separate by currency (ZAR/USD) throughout rather than incorrectly summed together.
  Both pages export to CSV (opens natively in Excel) and the Income Statement has a
  print-to-PDF button using the browser's own print dialog with dedicated print styling,
  rather than adding a server-side PDF-generation dependency for something the browser
  already does reliably.
- **SOS safety system** — a rider or driver mid-trip can raise an SOS that (1) prompts an
  immediate call to local emergency services, and (2) automatically finds and notifies the 5
  nearest online, verified drivers with the vehicle plate/description and the other party's
  name — those drivers get a mandatory full-screen alert on any page of the app until they
  respond (attend the scene, or confirm they've notified police with a reference number).
  Admins review every alert and response, and can reward responding drivers with
  commission-free ride credits, a priority-ranking window, and a trust badge. A third-party
  private security/armed-response provider can also be configured per country (Admin →
  Safety) — when set, a "Call [Provider]" rapid-response option appears alongside the
  standard emergency numbers, **restricted to Vuma Deluxe rides only** (marketed as an
  enhanced-security benefit of that tier — see the "Vuma Deluxe" toggle on the rider's
  request screen), for both the person who raised the alert and any driver notified about
  it. The Deluxe status is snapshotted onto the alert itself at the moment it's raised
  (same pattern as the vehicle/driver snapshot), since a notified driver isn't the ride's
  rider or assigned driver and so can't read that ride's details directly. Admins can see
  which alerts had the provider called.
- **Commission engine** — resolves per-ride commission in priority order: active driver
  subscription → per-driver admin override → country default. Admins can put any individual
  driver on either pricing model at any time, and waive subscription fees while keeping the
  discounted-commission perk active.
- **Payments** — PayFast integration for South Africa and Paynow (incl. EcoCash) for
  Zimbabwe, both with a **mock mode** that simulates instant successful payment so you can
  test the entire app before you have live merchant credentials.
- **Realtime** — ride status, offers, and driver location all update live via Supabase
  Realtime (no polling).

## What you'll need to configure yourself (can't be pre-provisioned for you)

- A **Supabase project** (free tier is enough to start) — for the database, auth, and
  realtime.
- **Live payment credentials** when you're ready to go beyond mock mode: a PayFast merchant
  account (South Africa) and/or a Paynow integration (Zimbabwe).
- **SMS delivery for phone-number login** — Supabase Auth needs an SMS provider (e.g. Twilio,
  MessageBird, Vonage) configured under Authentication → Providers → Phone before phone OTP
  will actually send codes. Until then, use email/password login — it works immediately.
- Optionally, a **Google Maps or Mapbox** key later if you want richer map tiles/routing than
  the free OpenStreetMap tiles this ships with (see "Upgrading the map" below).

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run `supabase/schema.sql` (creates every table, enum, RLS policy, and
   enables Realtime).
3. Then run `supabase/migrations/002_driver_verification.sql` — adds the document columns to
   `driver_profiles` and creates the private `driver-documents` Storage bucket with RLS so
   drivers can only access their own folder and admins can access all.
4. Then run `supabase/migrations/003_referrals_and_sos.sql` — adds the referral program
   tables (settings, referrals, ride credits) and the SOS safety tables (alerts, responses),
   plus the reward fields on `driver_profiles` (priority ranking, free ride credits, trust
   badges).
5. Then run `supabase/migrations/004_contact_and_chat.sql` — adds scoped contact-info
   sharing (a rider and driver can read each other's name/phone only while they share an
   active ride) and the in-app ride chat table.
6. Then run `supabase/migrations/005_public_ride_tracking.sql` — adds a public, read-only
   view exposing a narrow set of safe ride fields (route, driver name/vehicle/plate, live
   location) so a "Share my ride" link works for someone with no Vuma account.
7. Then run `supabase/migrations/006_vehicle_capacity.sql` — adds seat capacity to
   `driver_profiles` and a required-capacity field on `rides`, plus a hard database rule so
   a driver's vehicle capacity is actually enforced (not just filtered in the UI) when they
   try to bid.
8. Then run `supabase/migrations/007_receipt_snapshot.sql` — adds driver name/vehicle/plate
   snapshot columns to `rides`, captured at completion time so a PDF receipt still shows who
   drove even after the normal contact-reveal access expires.
9. Then run `supabase/migrations/008_manual_payments.sql` — adds admin-configured payment
   instructions per country and the manual payment submission/approval workflow for driver
   subscriptions (mobile wallet transfer with a reference code, alongside PayFast/Paynow).
10. Then run `supabase/migrations/009_rider_wallet.sql` — adds the rider wallet (change
    credit) system: a running balance, a full transaction ledger, and reservation logic on
    `rides` so the same balance can't be double-spent across two concurrent ride requests.
11. Then run `supabase/migrations/010_driver_credit_limits.sql` — adds the driver-side
    spendable credit balance (separate from cash earnings, usable only toward subscription
    payments or priority boosts) and the monthly caps on issuing/redeeming change credit.
12. Then run `supabase/migrations/011_driver_referrals.sql` — adds the driver-to-driver
    referral program (pays into the same spendable credit balance) and vehicle-plate
    duplicate-detection flagging for fraud review.
13. Then run `supabase/migrations/012_driver_rating_tags.sql` — adds structured rating tags
    (polite/rude, on-time/very-late, clean/dirty), the driver warning-escalation system, and
    automatic suspension enforcement (also hard-enforced at the database level, not just the
    UI).
14. Then run `supabase/migrations/013_fare_settings.sql` — moves the rider "fair range" fare
    guidance (base fare, per-km rate) out of hardcoded constants and into an
    admin-configurable table, seeded at roughly half the app's original values to match
    InDrive's typical suggested rates.
15. Then run `supabase/migrations/014_fare_rounding.sql` — adds an admin-configurable
    rounding increment to the displayed fare range (nearest R5 for South Africa, nearest $1
    for Zimbabwe by default), so suggested fares land on round, easy-to-negotiate numbers.
16. Then run `supabase/migrations/015_security_provider.sql` — adds an admin-configurable
    third-party security/armed-response provider, shown as a rapid-response call option
    during an active SOS alongside standard emergency numbers. Kept hidden from users until
    an admin fills in real contact details (Admin → Safety).
17. Then run `supabase/migrations/016_manual_payment_proof.sql` — makes manual payment the
    default subscription flow: adds a private Storage bucket for proof-of-payment uploads,
    makes the reference code optional (a driver can submit a code, an uploaded proof file, or
    both), and adds clickable-link fields to payment instructions.
18. Then run `supabase/migrations/017_gateway_toggle.sql` — adds an admin toggle
    (Admin → Subscriptions) to hide the PayFast/EcoCash-Paynow card payment option per
    country. **Turned off by this migration** — flip it back on yourself once real gateway
    integration is complete, no code change or redeploy needed.
19. Then run `supabase/migrations/018_vuma_deluxe.sql` — adds the Vuma Deluxe tier: driver
    certification status, a deluxe flag on rides, and a hard database-level rule so a
    non-certified driver literally cannot bid on a deluxe-marked ride, not just a UI filter.
20. Then run `supabase/migrations/019_deluxe_multiplier.sql` — makes the Vuma Deluxe rate
    bump (fare guidance and commission rate) admin-configurable per country from
    Admin → Commissions, instead of a hardcoded 1.5×.
21. Then run `supabase/migrations/020_admin_role_switch.sql` — adds the permanent
    `is_super_admin` flag every admin check now keys off (see "Creating your first admin
    user" above — **existing admins need no manual action**, this migration backfills the
    flag for any account that already has `role = 'admin'` automatically), and lets a
    super-admin switch their view to driver/rider and back at the click of a button.
22. Then run `supabase/migrations/021_offer_expiry.sql` — adds an 'expired' status for ride
    offers not accepted within 1 hour, checked lazily wherever offers are loaded (no cron job
    needed) and hard-enforced again at the moment of acceptance.
23. Then run `supabase/migrations/022_ride_stops.sql` — adds support for intermediate stops
    on a ride, visible to any driver browsing an open request (not just after they've bid),
    with routing, fare guidance, and the map all updated to account for multi-leg trips.
24. Then run `supabase/migrations/023_deluxe_security_benefit.sql` — restricts the private
    security rapid-response option (Admin → Safety) to Vuma Deluxe rides only, marketed as an
    enhanced-security benefit of that tier on the rider's request screen.
25. Then run `supabase/migrations/024_history_clear.sql` — lets riders select and clear
    items from their own trip history (a soft "hide from my view" flag — never touches the
    underlying ride, driver history, or financial records).
26. Then run `supabase/migrations/025_drivers_forum.sql` — adds the Drivers Forum: shared,
    same-day road condition alerts, geocoded so they can be matched against a driver's
    actual route once they pick up a ride.
27. Then run `supabase/migrations/026_forum_qa_and_clear.sql` — adds the ability for any
    driver to mark a road alert resolved ("the truck's been moved"), plus an "Ask a
    Question" thread in the forum ("Is Seke Road congested right now?") where replies can be
    logged straight into the main alerts list with one tap.
28. Then run `supabase/migrations/027_driver_prepaid_wallet.sql` — adds the driver prepaid
    wallet: commission is now genuinely deducted in real time at trip-start, rather than only
    ever being recorded at completion with no actual collection mechanism. Includes a private
    storage bucket for top-up proof-of-payment uploads.
29. Then run `supabase/migrations/028_scheduled_rides.sql` — adds fixed-time/scheduled
    rides: the lock-window cancellation rules, no-show penalty tracking, mutual-cancellation
    flow, and rider strike tracking. Also turns `profiles.is_suspended` into a genuinely
    enforced ban (it existed before this migration but was never actually checked anywhere).
30. Then run `supabase/migrations/029_accounting_console.sql` — adds commission-source
    tracking to `transactions` (subscription rate / referral credit / reward credit / country
    default), needed for the Transactions console's type breakdown and the Income Statement.
31. Then run `supabase/migrations/030_scheduled_rides_policy_overhaul.sql` — replaces the
    driver's 50% no-show penalty with a flag-based system shared by both roles (a second
    flag within 3 months → 7-day suspension, not permanent), adds suspension appeals, wallet
    top-up consent tracking, and the admin-configurable scheduled-trip fee factor.
32. **Then run `supabase/migrations/031_accounting_integrity.sql` — this one matters more
    than most.** It closes a critical gap: `profiles` and `driver_profiles` had row-level
    security restricting *which row* could be updated, but nothing restricting *which
    column* or *value* — meaning any authenticated user could, via a direct API call
    bypassing the UI entirely, set their own `wallet_balance`, `is_super_admin`, `role`,
    `verification_status`, or any other sensitive field on their own account. This adds
    database-level triggers closing that gap for both tables, plus a new trigger that
    validates and applies a rider's wallet credit atomically and server-side at ride
    creation (previously a client-computed amount with no server-side balance
    verification). See the migration file itself for the full design reasoning.
33. Then run `supabase/migrations/032_change_credit_caps_admin.sql` — moves the
    change-credit monthly caps (previously hardcoded in `lib/constants.ts`) into
    admin-configurable `fare_settings`, matching the existing deluxe/scheduled multiplier
    pattern. Defaults match the previous hardcoded values exactly, so this changes nothing
    behaviorally on its own — it only makes the numbers editable via Admin → Commissions.
34. Then run `supabase/migrations/033_rider_wallet_accrual_cap.sql` — adds a third,
    independent change-credit cap: how much one rider can accrue in wallet credit *in
    total, from any number of drivers combined*, per month (default R40 / $4). The two
    existing caps are both scoped per-driver, so neither catches a rider receiving credit
    from several different drivers who are each individually staying within their own
    limit — this closes that specific gap.
35. Then run `supabase/migrations/034_rider_suspension_reason.sql` — adds
    `suspension_reason` to `profiles` (riders), mirroring the field `driver_profiles`
    already had — needed so a manual admin freeze can carry a specific reason instead of
    falling back to a generic message.
36. Then run `supabase/migrations/035_driver_notices.sql` — adds admin-managed
    notices/ads shown in the driver dashboard's side space on wide screens (Admin →
    Notices to manage).
37. Then run `supabase/migrations/036_scheduled_commission_reservation.sql` — adds
    `driver_profiles.reserved_balance` and `rides.commission_reserved`, so a scheduled
    trip's expected commission is held from a driver's available balance at acceptance
    rather than left exposed until trip-start.
38. Then run `supabase/migrations/037_wallet_topups_realtime.sql` — enables realtime on
    `driver_wallet_topups` (created in migration 027 but never added to the realtime
    publication), needed for the driver to be notified live when a top-up is approved.
39. Then run `supabase/migrations/038_tax_levy_charges.sql` — adds admin-configurable tax/levy
    charges, deducted per ride from the driver alongside commission (Admin → Charges to
    manage). Also extends the `txn_type` enum with `tax_levy` and the driver wallet
    transaction check constraint with `tax_levy_deduction` — see the migration file for the
    full reasoning on why this is tracked separately from commission revenue.
40. Then run `supabase/migrations/039_driver_other_document.sql` — adds an optional "Other"
    document upload slot to driver verification, for anything that doesn't fit the existing
    required categories.
41. Then run `supabase/migrations/040_driver_arrival_confirmation.sql` — adds
    `rides.driver_confirmed_arrival_at`, needed for the rider's side to actually know a driver
    has confirmed arrival on a scheduled trip (previously that confirmation was a pure UI
    navigation with nothing persisted at all).
42. Then run `supabase/migrations/041_driver_declaration.sql` — adds
    `driver_profiles.declaration_accepted_at`, recording when a driver accepted the mandatory
    legal declaration now required before verification submission.
43. Then run `supabase/migrations/042_vuma_associates.sql` — the full Vuma Associates membership
    system: membership records, time-windowed ride-access restrictions, global settings, and a
    new rider wallet top-up mechanism. See the migration file and the feature description below
    for the full reasoning.
44. Then run `supabase/migrations/043_subscription_holidays.sql` — subscription holiday offers,
    a Vuma Associates member benefit: admin creates a time-windowed free-subscription-period
    offer on a chosen plan, claimable only by active members.
45. Then run `supabase/migrations/044_require_verification_for_topup.sql` — tightens the wallet
    top-up insert policy to require an actually-verified driver, at the database level, not
    just hidden in the UI.
46. Then run `supabase/migrations/045_vuma_private.sql` — the Vuma Private cost-sharing club:
    groups, trip requests, and cost-share offers with a database-level no-markup constraint.
    See the feature description below for the full reasoning, including what's deliberately
    not yet built.
47. Then run `supabase/migrations/046_vuma_private_platform_visibility.sql` — lets a member
    opt a specific trip request into platform-wide visibility, off by default. See the feature
    description below for an important legal caveat on this one specifically.
48. Then run `supabase/migrations/047_vuma_private_cooption.sql` — a second, different consent
    model: a member can pre-authorise being added directly into any group by an existing
    member, via a standing toggle on their own membership, off by default. Also adds the first
    UPDATE policy this table has ever had, with a trigger restricting it to that one column —
    see the migration file for why a broader update policy would have been a real security
    hole (self-approving membership status).
49. Then run `supabase/migrations/048_vuma_private_fee_percentage.sql` — a per-trip Vuma
    Private membership fee is now a percentage of the trip's cost-share amount, not a flat
    amount, matching how taxes/levies already separate percentage and flat charges. A monthly
    fee stays flat, since there's no single transaction to take a percentage of.
50. Then run `supabase/migrations/049_vuma_private_fee_transaction_type.sql` — adds
    `vuma_private_fee` as a valid transaction type, needed for the actual fee deduction
    mechanism (see the feature description below).
51. Then run `supabase/migrations/050_vuma_private_fix_recursion.sql` — **fixes an actual bug**:
    "infinite recursion detected in policy for relation vuma_private_group_members," caused by
    two RLS policies each querying that same table from within their own policy. See the
    migration file for the full explanation and the standard Postgres fix applied. Run this
    one as soon as possible if you've already deployed migrations 045–047.
52. Then run `supabase/migrations/051_vuma_private_fix_cooption_check.sql` — **fixes another
    actual bug**, found immediately after the one above via direct user testing: "new row
    violates row-level security policy for table vuma_private_group_members" when using the
    co-option add-member flow, even with the target's toggle genuinely on. Different
    mechanism from the recursion fix, same underlying category — a policy's subquery tried to
    read someone else's row on a table whose own SELECT policy only allows reading your own,
    so the check silently always failed. See the migration file for the full explanation.
53. Then run `supabase/migrations/052_vuma_private_request_details.sql` — adds pickup location
    and Deluxe preference to trip requests (matching regular ride requests), and a multi-group
    sharing table so a request can be visible to more than one group at once — additive, same
    pattern as platform-wide visibility, not a replacement for the single-group model.
54. Then run `supabase/seed.sql` (optional but recommended — adds starter subscription plans
    for both ZA and ZW so the driver subscription page isn't empty).
55. Go to Project Settings → API and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ keep this secret — never expose it
     to the browser; it's only used in server-side route handlers)
5. If you plan to test phone login, go to Authentication → Providers → Phone and connect an
   SMS provider. Otherwise, email/password works with zero extra setup (Supabase's default
   "Confirm email" setting will require clicking a confirmation link — you can turn that off
   under Authentication → Providers → Email while testing).

### Creating your first admin user

Sign-up in the app only offers "rider" or "driver" — admins are created directly in the
database on purpose. After signing up a normal account, promote it in the SQL Editor:

```sql
update profiles set role = 'admin', is_super_admin = true where email = 'you@example.com';
```

**Both fields matter, and they mean different things.** `role` is just the *current view* —
an admin can switch it to `driver` or `rider` at any time (see "Admin role switching" below)
to preview those experiences using their own account, and switching it back is just as easy.
`is_super_admin` is what every admin permission check — both database RLS policies and the
app's API routes — actually keys off, and it never changes when an admin switches their
view. Forgetting to set `is_super_admin = true` here means the account will show as `role =
'admin'` but won't actually be able to do anything admin-only.

---

## 2. Local development

**Requires Node.js 20.9.0 or later** (Next.js 16 no longer supports Node 18 — check with
`node -v`, and upgrade first if needed).

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev
```

Open http://localhost:3000. `PAYMENTS_MOCK_MODE=true` (the default) means driver subscription
purchases complete instantly without a real PayFast/Paynow account — good for testing the
whole flow immediately.

---

## 3. Deploy to Vercel

1. Push this project to a GitHub/GitLab repo.
2. In Vercel: **New Project → Import** your repo.
3. Add the environment variables from `.env.example` under Project Settings → Environment
   Variables (same values as your `.env.local`).
4. Deploy. Vercel auto-detects Next.js — no build config needed.
5. Once you're ready for real payments, set `PAYMENTS_MOCK_MODE=false` and fill in your
   PayFast/Paynow credentials, then redeploy.

The app is installable as a PWA directly from the deployed URL (Add to Home Screen on
iOS/Android).

---

## Going live with real payments

- **PayFast (South Africa)**: sign up at payfast.co.za, get your Merchant ID, Merchant Key,
  and set a passphrase. Set `PAYFAST_SANDBOX=true` first and test against their sandbox
  before flipping to production.
- **Paynow (Zimbabwe, incl. EcoCash)**: register at paynow.co.zw, get your Integration ID
  and Integration Key. The included `initiatePaynowCharge` supports both a web redirect flow
  and a direct EcoCash mobile push (pass a phone number).
- Both webhook routes (`/api/payments/payfast/webhook` and `/api/payments/paynow/webhook`)
  activate the driver's subscription automatically once the gateway confirms payment. Point
  your gateway dashboard's notify/result URL at your deployed domain.
- **Note on the Paynow webhook**: the included handler doesn't yet re-verify Paynow's status
  hash (it's a straightforward SHA512 check, same pattern as `initiatePaynowCharge` — see
  Paynow's docs). Add that check before processing real money.

## Upgrading the map

The app ships with free OpenStreetMap tiles and Nominatim geocoding (via `/api/geocode`) —
no API key, no cost, works immediately. If you want Google-quality routing/traffic later:

1. Get a Google Maps or Mapbox key.
2. Replace the `TileLayer` URL in `components/map/RideMap.tsx`, or swap `react-leaflet` for
   `@vis.gl/react-google-maps` / `mapbox-gl` if you want native vector tiles.
3. Replace `geocodeSearch`/`reverseGeocode` in `lib/geo.ts` with the new provider's API.

## Driver document verification workflow

1. A new driver signs up and is redirected toward `/driver/verification` (also reachable
   from the bottom nav's "Verify" tab, and a banner on the driver home screen until they're
   verified).
2. They upload four documents — ID, driver's license, vehicle registration, profile photo —
   each stored privately in Supabase Storage under `driver-documents/{their-user-id}/...`.
   RLS ensures only that driver (and admins) can ever read those files.
3. Once all four are uploaded, they tap "Submit for review," which sets
   `verification_status = 'pending'`.
4. An admin opens **Admin → Drivers → Review** for that driver, views each document via a
   short-lived signed URL, and approves or rejects (with a reason the driver will see).
5. Only `verified` drivers can toggle "Go online" — the button is disabled otherwise, with a
   banner explaining why.

## Upgrading routing

Ships with the free public OSRM demo server (see "Known scope limits" below for its
limits). To swap in Mapbox or Google Directions instead, edit `app/api/route/route.ts` —
everything downstream (`lib/geo.ts`'s `getRoadRoute`, the map's route line) just expects
`{ distanceKm, durationMin, geometry: [lat, lng][] }` back, so the rest of the app doesn't
need to change.

## Upgrading geocoding accuracy

Free OpenStreetMap-based geocoding (the default, via LocationIQ or raw Nominatim) has real
gaps in Southern Africa specifically: house-number-level address data is often incomplete,
so a specific address can silently fall back to matching just the street as a whole — and
free-text "corner X and Y" intersection queries aren't reliably parsed by Nominatim's search
at all. Two ways this is addressed:

**1. Drop-a-pin fallback (already built, free, no setup needed).** On the rider's request
screen, once a pickup or drop-off pin is placed, it's draggable — tap and hold, then drag to
the exact spot if the text search result is close but not quite right. This is the standard
workaround ride-hailing apps use for exactly this class of problem, and works regardless of
which geocoding provider is behind the search box.

**2. Google Places/Geocoding (optional, but the real fix for search accuracy itself).**
Google's commercial map data is substantially more complete than OSM's in most Southern
African cities, and its search handles landmarks and intersection-style queries much better.
To enable it:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (or
   use an existing one)
2. Enable **two** APIs: **"Places API (New)"** and **"Geocoding API"** (Vuma's forward
   search and reverse-geocoding use different Google endpoints)
3. Set up billing — Google requires a billing account even within the free monthly credit;
   check [current Places API pricing](https://mapsplatform.google.com/pricing/) before
   enabling in production, since pricing/credit terms can change
4. Create an API key (APIs & Services → Credentials), and **restrict it** to just those two
   APIs (skip IP restriction — Vercel doesn't have static outbound IPs, so API-only
   restriction is the right constraint here since this key is only ever called server-side,
   never exposed to the browser)
5. Add it to your environment: `GOOGLE_PLACES_API_KEY=your-key-here`

That's the only step — `app/api/geocode/route.ts` already checks for this key and
automatically prioritizes Google over LocationIQ/Nominatim when it's present, with the same
automatic fallback chain if a Google call ever fails. No other code changes needed.

## Referral program

1. Every rider has a shareable invite link (`/rider` → "Invite" tab): `yourapp.com/signup?ref={their-user-id}`.
2. When someone signs up through that link, a `referrals` row is created (`status: pending`).
3. The referred rider's **first completed ride** flips that referral to `qualified`.
4. Once a referrer has enough qualified-but-uncounted referrals (the country's
   `required_referrals` setting), they're automatically issued a `ride_credits` row.
5. On their next ride request, the rider can tap "Use credit" — the ride is created with
   `applied_credit_id` set and the credit marked `reserved` (released back to `available` if
   the ride is cancelled).
6. Whichever driver completes that ride gets **0% commission on it** plus a **priority-ranking
   window** (their offers sort to the top of the rider's negotiation list elsewhere in the
   app, with a visible "Priority" badge) — configurable per country under
   **Admin → Referrals**.

## SOS safety system

1. Either party on an active trip (`accepted` or `in_progress`) sees an "SOS — I need help"
   button, which asks for confirmation before firing (to avoid accidental triggers).
2. On confirm, `/api/sos/trigger` snapshots the other party's name, phone, vehicle plate, and
   vehicle description; finds the 5 nearest **online, verified** drivers by real distance;
   and creates a notification for each.
3. The triggering user immediately sees direct-dial buttons for local emergency services
   (SA: SAPS 10111 / 112, ZW: 995 / 112 — edit `EMERGENCY_NUMBERS` in `lib/constants.ts` for
   other markets) plus a live-updating list of notified drivers' response status.
4. Every notified driver sees a **mandatory full-screen alert on any page of the driver app**
   — it can't be dismissed without choosing to head to the scene or confirm they've notified
   police (with a reference number field). It downgrades to a persistent (non-blocking)
   banner once they've responded, and disappears once the alert is resolved.
5. **Admin → Safety** shows every alert and its responders, with a one-click "Reward" action
   that grants a free-commission ride credit, a priority-ranking window, and an "SOS
   Responder" trust badge (both badges show up on the driver's earnings page and in the
   admin drivers table).

## Known scope limits (read before treating this as production-ready)

This is a genuinely working MVP, not a marketing mockup — but a few things are intentionally
simplified and should be hardened before handling real money and real users at scale:

- **Routing uses the free public OSRM demo server.** It's genuinely real road
  distance/duration/route geometry, not an approximation — but that public instance is rate
  limited and not meant for heavy production traffic. Self-host OSRM or switch to
  Mapbox/Google Directions (drop-in: replace the fetch inside `app/api/route/route.ts`) once
  you have real volume.
- **Nominatim's public geocoding server aggressively IP-blocks many networks with no
  warning** — this isn't rate-limiting from overuse, it can happen on the very first
  request depending on your ISP/network's history. If address search silently fails (check
  your `npm run dev` terminal for "Access blocked" in the logged error), get a free
  LocationIQ key at locationiq.com (no card required, same OpenStreetMap data, ~5,000
  requests/day free) and set `LOCATIONIQ_API_KEY` in `.env.local` — the app automatically
  switches to it and stops hitting Nominatim directly.
- **No push notifications.** Status changes rely on Supabase Realtime while the app is open.
  Add a service worker + Web Push (or a service like OneSignal) for background notifications.
- **Document verification is a manual admin review, not automated ID verification.** Admins
  eyeball the uploaded ID/license/vehicle documents and approve or reject. If you need
  automated document authenticity checks or facial-match liveness verification, integrate a
  KYC provider (e.g. Smile Identity, which has strong SA/ZW coverage, or Onfido) in
  `app/driver/verification/page.tsx` and the admin review page.
- **Paynow webhook hash isn't verified** (see above) — add before going live.
- **No automated payouts to drivers.** `driver_profiles.total_earnings` tracks what a driver
  is owed; wiring that to actual bank/mobile-money payouts is a separate integration per
  market.
- **No rate limiting / abuse protection** on ride requests or bids.
- **Referral fraud isn't fully prevented.** Someone could sign up two accounts and refer
  themselves to farm credits. The `complete` route does verify a credit belongs to the
  ride's actual rider before honoring it, but nothing stops the underlying self-referral
  pattern — add device/phone fingerprinting or a manual review step if this matters for you.
- **"Drivers are obliged to respond" to SOS is enforced by UI, not by the platform.** The
  full-screen alert can't be dismissed without picking an action, but nothing stops a driver
  from closing the app entirely or ignoring their phone. If you need guaranteed escalation,
  add a timeout that auto-escalates to the next-nearest driver (or a human dispatcher) when
  a notified driver doesn't respond within N seconds.
- **Manual payment reference codes aren't verified against any real bank/mobile-money API.**
  A driver could submit a fabricated reference code, and the admin approval step is the only
  check standing between that and an activated subscription — this is a trust-based manual
  review workflow by design (matching what "manual payment" implies), not an automated
  verification. If fraud becomes a real problem, the fix is a real payment-gateway
  integration for that provider, not a stronger version of this flow.
- **The rider wallet has no real money settlement behind it.** It's a pure ledger: when a
  driver "credits change," no money actually moves anywhere — it's understood that the
  driver already holds the extra cash from the rider and is voluntarily not returning it as
  physical change. There's no reconciliation step ensuring a driver who credits $50 in
  change over time is ever made whole for it; that's a real business process to design
  separately if this feature sees real usage (e.g., netting it against their commission or
  payout).
- **Wallet currency is locked to whatever it was first credited in.** A rider whose wallet
  was credited in ZAR can't apply it to a ZW/USD ride — the app blocks the mismatch rather
  than attempting any conversion, since Vuma doesn't have exchange-rate infrastructure.
- **Driver warnings 1 and 2 are issued automatically, not manually by an admin.** The original
  request described an admin "sending" the first warning — I built it so the system detects
  the threshold and issues the warning immediately (visible to the driver and logged for
  admin), since gating an automatable action behind manual review would leave real complaint
  patterns unaddressed until someone happens to check. The 3rd-warning suspension was
  explicitly specified as automatic either way. If you'd rather warnings 1–2 sit in a queue
  for an admin to manually approve before the driver sees them, that's a straightforward
  change to `app/api/ratings/submit-driver-rating/route.ts` — say so and I'll adjust it.
- **Bidding is blocked when a driver's wallet can't cover a specific trip's commission** —
  replacing a much cruder earlier check (simply "is the balance above zero"). The new check
  (`/api/rides/[id]/check-bid-affordability`) resolves the *actual* expected commission for
  the specific bid amount, using the same `resolveFullCommission` function the real charge
  will use at trip-start — so it's never out of sync with what actually gets charged. A small
  grace drawdown is allowed (R1 / 10c) rather than requiring the resulting balance to land
  exactly non-negative, since rounding on the eventual real fare could land either side of
  the estimate made here. Applies identically to scheduled trips, since bid submission is the
  same function regardless — no separate logic needed. Drivers on an active subscription are
  exempt, matching the same exemption already used elsewhere.
- **Commission reserved at acceptance for scheduled trips** — closes a real gap the
  affordability check above didn't cover on its own: a scheduled trip can sit accepted for
  hours or days before its actual scheduled time, and nothing previously stopped the balance
  being spent down on unrelated trips in the meantime — a driver could pass the
  bid-affordability check today and still have nothing left when the scheduled trip's moment
  actually arrives. Fixed by reserving the expected commission the moment a scheduled ride is
  accepted (`driver_profiles.reserved_balance`), holding it out of the driver's *available*
  balance — every gate that checks affordability (going online, bidding, the low-balance
  reminder) now checks `prepaid_wallet_balance - reserved_balance`, not the raw figure alone.
  The reservation converts into the real deduction at trip-start, or releases back if the
  ride is cancelled before then (either party cancelling directly, or a mutually agreed
  cancellation) — never lost, never double-counted. The Wallet page shows both figures when a
  reservation exists: the raw balance, and what's actually available right now.
- **Low-balance messaging now distinguishes "getting low" from "already empty."** Previously
  both showed the same "getting low" wording regardless of severity. At zero or below, the
  message now reads "You have no credit — top up to take new trips" instead, on both the
  driver dashboard and the Wallet page — using the same available-balance figure (net of any
  reservation) as everything else in this section, not the raw balance.
- **Driver is notified live when a wallet top-up is approved** — previously the only way to
  know a top-up had gone through was reloading the page and noticing the balance had changed.
  The Wallet page now has a realtime subscription on the driver's own top-up requests; the
  moment an admin approves one, a clear "Top-up approved" notice appears with the amount and
  a link back to Requests. Deliberately doesn't navigate anywhere automatically — a driver
  might still want to submit another top-up while they're already on the page, so it's a
  dismissible notice with a link to follow if they want it, not something that pulls them
  away. **Found and fixed a real prerequisite gap while building this**: `driver_wallet_topups`
  was created back in the original wallet migration but never actually added to Supabase's
  realtime publication — without that, this notification (or any realtime feature on this
  table) would have silently never fired, no error, just nothing happening. Fixed in
  migration 037.

- **Vuma Associates** — a membership-based networking society for riders and drivers, built as
  a genuinely new system on top of the core marketplace rather than a single flag on
  `profiles`, since the requirement explicitly anticipates more benefits being added over
  time. Covers:
  - **Sign-up flow**: after creating an account, a new rider or driver is asked whether they'd
    like to join, and if so shown the full constitution (`components/vuma-associates/
    ConstitutionContent.tsx`, reused on both the sign-up flow and a standalone page at
    `/vuma-associates/constitution`) before their membership is created. Declining or skipping
    this simply continues to their dashboard as normal — nothing is required.
  - **Membership status**: a dedicated `vuma_associates_memberships` table with its own status
    lifecycle (`pending` → `active`/paid-up, or `lapsed`/`revoked`), separate from the
    underlying rider or driver account, which membership status never affects on its own.
  - **Rider wallet top-ups**: previously riders had *no* way to add funds to their own wallet
    at all — it could only ever be earned via driver-issued change credit, and was subject to
    the caps built for that (per-driver-per-rider, per-driver-total, rider-accrual). Active
    members can now top up directly (`app/rider/wallet/page.tsx`, mirroring the driver
    prepaid-wallet top-up flow exactly — submit amount plus reference or proof, admin
    approves), and this is deliberately **not** governed by the change-credit caps, since it's
    a different source of funds entirely (a direct deposit, not credit issued by another
    user).
  - **Ride-access restrictions** (Admin → Vuma Associates): a single, time-windowed mechanism
    (`ride_access_restrictions`) covering both "restrict Deluxe or all rides to Associates" and
    "restrict non-members/unpaid members from requesting or bidding" — these are the same rule
    described from two directions, not two separate systems. During an active window, only an
    active (paid-up) member can request (rider) or bid (driver) within the chosen scope;
    checked client-side in both `app/rider/page.tsx` and `app/driver/page.tsx` via a shared
    helper (`lib/vumaAssociates.ts`).
  - **Driver registration gate**: an admin-discretion global toggle
    (`vuma_associates_settings.require_membership_for_driver_registration`) that, when on,
    blocks a new driver from submitting verification for review until they have an active
    membership — enforced alongside the existing document/vehicle/declaration checks in
    `app/driver/verification/page.tsx`.
  - **Admin console** (`/admin/vuma-associates`): the global driver-registration toggle,
    creating and toggling ride-access restrictions, and confirming pending memberships as
    paid-up/active. Rider top-up review lives at `/admin/rider-wallet-topups`, linked from the
    same console. Both pending memberships and pending rider top-ups now also surface in
    Admin → Overview's Quick Tasks, alongside the existing pending-review items.
  - The constitution itself is a genuine starting draft, not a bare template, but — like the
    Terms of Service — uses `[REPLACE: ...]` markers wherever a real decision (governance
    structure, the amendment/re-acceptance process) needs sign-off before publishing, rather
    than guessing at specifics that weren't specified. **Updated in a later round**: the
    standalone constitution page (`/vuma-associates/constitution`) was originally read-only —
    linked from several places as "Learn about Vuma Associates," but with no way to actually
    join from there. Now a client component that checks the visitor's own membership status
    and shows the appropriate action: join directly if logged in with no membership yet, a
    clear "awaiting confirmation" or "you're an active member" state if one already exists, or
    a prompt to sign up/log in first if visiting while logged out.
  - **Subscription holidays** (Driver → Plan; Admin → Subscriptions): a further member
    benefit — admin creates a time-windowed offer on a chosen plan ("7 days free on the Weekly
    plan, claimable until [date]"), and only active members can claim it. Built directly on
    the existing `driver_subscriptions` mechanism (which already had `amount_paid` and
    `waived_by`/`waived_reason` — a concept for "granted for free" already existed, this
    reuses it) rather than a parallel system, so a claimed holiday automatically feeds into
    every existing "has active subscription" check — commission resolution, bid gating —
    with zero duplicated logic. A driver who isn't yet a member still sees that a holiday is
    available, with a link to join, rather than the offer being invisible to them entirely.
    **Found and fixed a real pre-existing bug while wiring this up**: the driver subscription
    page's own "what's my active plan" query only ever checked `status = 'active'`, never
    `'waived'` — even though an existing, separate admin capability
    (`/api/admin/subscriptions/[id]/waive`) could already grant a driver a free subscription
    with exactly that status. Any driver who'd ever had a subscription manually waived by
    admin would have seen no reflection of it on their own subscription page at all, despite
    it correctly reducing their commission behind the scenes the whole time. Fixed to match
    the status check the commission-resolution logic already used correctly. **Fixed a real
    discoverability gap in a later round**: both driver-facing cards on this page were
    conditional on `holidayOffers.length > 0` — meaning a non-member driver would only ever
    learn this benefit exists if they happened to visit while an offer was actually live. No
    offer live, no mention of it at all, ever. Added a standing card, shown regardless of
    whether an offer currently exists, so the benefit's existence itself is always
    discoverable — separate from the "claim this specific offer" card, which still only shows
    when something is actually claimable. Also added the benefit to the constitution's list,
    which had been left out when this feature was built afterward.
  - **The sign-up join prompt clarifies membership is optional — accurately, not
    unconditionally.** A blanket "you don't need to join to sign up or drive" statement would
    have been false the moment admin enables the driver-registration membership gate (see
    above) — so this checks that same setting live and shows the honest version either way: a
    full reassurance when membership genuinely isn't required for that role, or a specific
    "joining is currently required to complete driver registration" note when it is. Riders
    are never affected by this setting, so they always see the full reassurance.
- **Driver dashboard's "verification pending" message now only shows once genuinely
  submitted** — `verification_status` defaults to `'pending'` for every brand-new driver
  signup, before they've uploaded a single document, so the card was telling drivers who'd
  never touched the verification page that "an admin is reviewing your documents." Now also
  checks `submitted_at` (already fetched, wasn't being used) — only a genuinely-submitted
  driver sees the review message; anyone else sees a prompt pointing them to actually
  complete it.
- **Unverified drivers can no longer submit a wallet top-up** — previously there was no check
  at all, neither in the UI nor at the database level; any authenticated driver, verified or
  not, could submit a top-up request. Fixed in both places: the RLS insert policy on
  `driver_wallet_topups` now requires `verification_status = 'verified'` (migration 044), and
  the wallet page itself replaces the top-up form with an explanation and a link to
  verification when it isn't. The database check is the actual enforcement boundary — the UI
  change alone would only have hidden the form, not prevented a direct request.

- **Vuma Private — a private, group-scoped cost-sharing club, genuinely distinct from the main
  marketplace, not a rebrand in name only.** Built following a real jurisdictional constraint:
  in places where a private car can't legally participate in commercial ride-hailing for
  profit, this reframes the whole interaction as *"who from my circle is already going and has
  space?"* rather than *"hire a driver."* The three things that make this legally different
  from the main marketplace are enforced structurally, not just in copy:
  - **No public advertising** — a trip request only exists inside a private, invite-code-only
    group. RLS policies on every Vuma Private table (`vuma_private_groups`,
    `_group_members`, `_trip_requests`, `_trip_offers`) restrict visibility to a group's own
    members; there's no path to a public feed anywhere.
  - **No profit, enforced at the database level** — `vuma_private_trip_offers` has a
    `no_markup` check constraint: a driver's cost-per-person figure can't add up to more than
    the estimated total cost across everyone riding (with 1 unit of rounding slack for
    practical splitting, not profit margin). A client-side calculator suggests the fair split,
    but the constraint is what actually prevents a markup from ever being stored, even if the
    UI number were bypassed.
  - **Driver-initiates, requester-doesn't-hire** — the flow only ever lets a member reply to an
    existing request with a trip *they* were already offering to make; there's no way to
    solicit or assign a specific driver.
  - **Legal notice, verbatim as specified**, shown on every trip request's detail page: "This
    feature connects members of a private group who already know each other... This does not
    create an employer-employee or commercial transport relationship." Also incorporated into
    the rebranded constitution (see below).
  - **Membership rebranded, not duplicated** — this reuses the existing membership
    infrastructure (constitution acceptance, pending/active status, admin approval) built for
    the earlier "Vuma Associates" concept, renamed to Vuma Private and repurposed around this
    cost-share framing rather than the original networking/mentorship framing. Internal table
    and route names deliberately kept as `vuma_associates_*` / `/admin/vuma-associates` — a
    global rename across every reference would be high-risk for zero functional benefit; only
    the user-facing text needed to change, and every occurrence of the displayed brand name
    was updated accordingly. The constitution itself was fully rewritten (now version 2.0) to
    center the cost-share club purpose, the Ride Request Notice, group rules, and how a trip
    request/offer/acceptance actually works, using the specified language directly rather than
    paraphrasing it.
  - **UI**: a role-agnostic hub at `/vuma-private` (anyone — rider or driver — can post a
    request or make an offer; this isn't tied to the main app's rider/driver role split, since
    both sides of a cost-share genuinely can be either), a group page for posting/browsing trip
    requests using the specified copy ("Need Help With A Trip?" / "Ask My Group"), and a trip
    request page with the cost-split calculator and offer acceptance. A small, low-key
    discovery link appears on both the rider and driver dashboards ("Try Vuma Private —
    cost-share with your own group"), and a "Switch to regular Vuma" link sits in the Vuma
    Private header — satisfying the requirement that members can move freely between the two
    without either being the default.
  - **Admin**: a new oversight console (`/admin/vuma-private`, distinct from the existing
    membership-approval page, now labelled "Vuma Private Members" in the nav to disambiguate)
    covering all groups with member counts, recent trip request activity for safety
    monitoring, and membership fee settings (monthly or per-trip, explicitly described to
    admin as framed to members as a fee, never a commission — a monthly fee is a flat amount,
    a per-trip fee is a percentage of that trip's cost-share amount, same distinction
    taxes/levies already use between percentage and flat charges).
  - **Fee deduction actually built, in a later round.** Turned out neither fee type needed a
    scheduled job — both are triggered by a real, specific moment rather than a timer: a
    per-trip fee deducts when the requester accepts an offer (moved from a direct client-side
    update to a proper server-side route, `/api/vuma-private/accept-offer`, since a financial
    check has no business living in the browser — insufficient balance blocks the lock
    entirely rather than locking first and sorting out payment after). A monthly fee works
    differently: an explicit "Renew" action (`/api/vuma-private/renew-membership`) deducts the
    flat fee and extends `paid_up_until` by 30 days from whichever is later — today, or the
    current paid-up date, so renewing early never shortens time already paid for. Attempting
    to lock a trip with an unpaid monthly fee is blocked with the same kind of clear message
    as insufficient balance for a per-trip fee. **A real architectural gap surfaced while
    wiring this up**: the fee always deducts from `profiles.wallet_balance`, since Vuma
    Private is role-agnostic — but the only UI for that balance lived at `/rider/wallet`,
    whose layout redirects any driver-role user straight to `/driver` before they'd ever see
    it. A driver-role member would have been silently bounced away, or worse, sent to
    `/driver/wallet` — a completely different balance, the prepaid commission wallet, not this
    one. Fixed with a new, dedicated, role-agnostic page (`/vuma-private/wallet`) that works
    identically regardless of the member's underlying app role; the same monthly-renewal card
    was also added to the existing `/rider/wallet` page, so a rider-role member sees it in the
    wallet tab they already know without needing to discover a separate page just to renew.
  - **Deliberately not yet built, given the scope of everything above** — flagged honestly
    rather than silently left out: group management UI beyond create/join (no way to leave a
    group, remove a member, or rename one from the UI yet); and a trip request's own
    cancellation/decline flow (an offer can be made and accepted, but there's no explicit way
    for a requester to cancel a request or a driver to withdraw an offer once made, beyond
    direct database access). These are the natural next round of work on top of a functioning
    core. (Automatic fee deduction, listed here as deferred in an earlier round, is now built
    — see below; it turned out not to need a scheduled job after all, since both fee types are
    triggered by a real, specific event rather than needing to run on a timer.)
  - **Opt-in platform-wide visibility, added in a later round — with an important caveat.**
    A member posting a trip request can now check "Also show to all Vuma Private members," off
    by default, letting any active member across the whole platform see and respond to it, not
    just their own group. **Worth being direct about the legal tension this introduces**: the
    entire framing that keeps Vuma Private legally distinct from the main marketplace rests on
    it being a private circle of people who already know each other — "the same as texting
    your WhatsApp group," not a public board. Broadening a request to every active member
    platform-wide starts to resemble general advertising again if it became the default or
    typical path. Built as a deliberate, explicit, per-post opt-in specifically to preserve
    that distinction — a member is making a conscious choice each time, not something the app
    nudges them toward — with copy on the toggle itself explaining the trade-off, a distinct
    badge on any request that's been widened, and a separate `/vuma-private/feed` page rather
    than folding platform-wide requests into the default group view. Whether this opt-in
    still sits comfortably within the "private circle" legal reasoning, or needs its own
    review, is worth a direct conversation with whoever is advising on the jurisdictional
    question this whole feature was built around.
  - **A second, different way to reach more people — member-level standing consent, added
    alongside (not replacing) platform-wide visibility above.** Rather than broadcasting one
    trip request to everyone active, a member can toggle "let other members add me to their
    group" once, on their own membership — off by default — and from then on, any existing
    member of *any* group can add them directly, without needing per-addition approval, since
    that standing consent already exists. Arguably sits more comfortably within the "private
    circle" framing than platform-wide visibility does, since the added person becomes a
    genuine, named member of that specific group rather than a stranger seeing a broadcast —
    though the underlying tension is similar either way: both ultimately let a request reach
    someone the requester hasn't personally met, just through different mechanics. A real,
    previously-nonexistent gap was caught building this: `vuma_associates_memberships` had no
    UPDATE policy at all, for anyone. A broad "can update your own row" policy would have let a
    member set their own `status` to `'active'`, bypassing admin approval of membership
    entirely — fixed with a trigger that restricts a non-service-role update to the
    `auto_accept_cooption` column alone, no matter what a client-side request tries to change.
    Discovering who's actually opted in required a small server-side route
    (`/api/vuma-private/cooptable-members`) rather than a direct client query, since
    membership rows aren't otherwise readable across different users at all.
- **Bulk selection for admin approvals and revokes** — a reusable `BulkActionBar` component,
  added to the three admin lists where "approve/reject/revoke" already meant reviewing several
  similar items one at a time: Vuma Private membership approval and revocation, driver wallet
  top-ups, and rider wallet top-ups. Each gets a select-all checkbox, per-item checkboxes, and
  bulk action buttons that appear once at least one item is selected. Deliberately reuses the
  existing single-item API routes in a sequential client-side loop rather than building
  parallel bulk-specific endpoints — simpler, and reuses logic that was already correct rather
  than risking a second, slightly different implementation of the same approval/rejection
  rules.
- **Vuma Private membership visibility in admin** — a small reusable `VumaPrivateBadge`
  component now shows a rider's or driver's membership status (not a member / pending / active
  / lapsed / revoked) on both their individual admin detail page and, more compactly, in the
  riders and drivers list views, so admin doesn't need to open someone's profile just to check
  whether they're a member.
- **Sort by, on the riders and drivers admin lists** — client-side sorting (the lists are
  already loaded in full, so no need to round-trip to the server just to reorder what's
  already there). Riders: most/oldest recently joined, name, Vuma Private membership,
  scheduled-ride strikes, frozen accounts first. Drivers: name, verification status, rating
  (either direction), commission mode, subscription plan, Vuma Private membership, online
  first. Sorting by a status (membership, or the equivalent priority order used elsewhere in
  this app) uses a defined rank — active first, then pending, lapsed, revoked, none — rather
  than an arbitrary string sort that would put them in a not-especially-useful alphabetical
  order. The drivers list didn't previously show subscription plan at all (only the binary
  `commission_mode`, per-ride vs subscription, not which plan) — added a new column and the
  underlying query for it, reusing the same active-or-waived, not-yet-expired, most-recent
  lookup already proven correct in commission resolution and the driver's own subscription
  page. **Added Vuma Deluxe status as a further sort option in a later round**, same rank-based
  approach (certified, then pending, then expired, then none). Caught a related gap while
  adding it: the existing badge display only ever rendered something for `certified` or
  `pending` — a driver whose Deluxe certification had lapsed to `expired` showed no indicator
  in the list at all, even though that's arguably the status most worth an admin noticing (a
  previously-certified driver who may need re-inspection). Added a badge for that state too.
- **A rider who's also an active Vuma Private member gets a choice right after logging in** —
  "Book a ride" (the regular marketplace) or "Ask my Vuma Private group" (cost-share within a
  group), rather than needing to already know Vuma Private exists and navigate there
  separately every time. Deliberately scoped to **login**, not sign-up — a brand-new signup
  can't be an active member yet regardless (membership starts `pending`, awaiting admin
  approval), so the existing `/join-vuma-associates` sign-up flow was left untouched. Also
  deliberately scoped to riders specifically, matching the request, and to *active* members
  only — a non-member is routed straight through with no prompt at all, so the large majority
  of riders who aren't members see no extra tap added to their login at all. Built as a new,
  standalone top-level route (`/rider-start`) rather than nested under `/rider` — the obvious
  first attempt would have inherited the rider layout's top bar and bottom nav around what's
  meant to be a clean, focused choice screen, doubling up chrome awkwardly; matches how
  `/join-vuma-associates` already avoids the same problem for the sign-up flow.
  - **Fixed a real RLS bug, and redesigned the flow, in a later round.** Creating a group was
    failing with "infinite recursion detected in policy for relation
    vuma_private_group_members" — two policies each contained a subquery selecting from that
    same table to check "is the current user already in this group," and Postgres applies RLS
    to that inner subquery too, meaning it re-evaluates the very same policy, whose subquery
    selects from the table again, forever. Fixed with a `SECURITY DEFINER` function
    (`is_member_of_vuma_private_group`), which runs with the function owner's privileges
    rather than the calling user's RLS context — the standard, documented way to break this
    specific class of Postgres recursion. Applied consistently to every policy that queried
    into this table, not just the two that were strictly self-referencing.
  - Also reworked "Ask my Vuma Private group" to lead with **where you're going first**,
    matching the familiar regular-booking flow, rather than requiring a detour into a specific
    group's own page before you could even say your destination. A new page
    (`/vuma-private/request`) asks destination/when/seats/note first, then "who should see
    this" second — pick an existing group, or create one on the spot if none exist yet, with
    the same platform-wide-visibility opt-in from earlier folded into this same second step.
    The original per-group posting form on a specific group's own page was left untouched —
    that's a genuinely different, still-valid case (already decided which group, just want to
    post there directly), not replaced by this new entry point.
  - "Book a ride" is now visually the obvious primary action on the login choice screen — an
    actual filled, full-width primary button — with "Ask my Vuma Private group" demoted to a
    smaller, secondary text link underneath, rather than the two options having equal visual
    weight as they did in the first version.
  - **A further round adds: a prominent "Need Help With A Trip?" button on the hub page**
    itself (below New group/Join with code, alongside the existing group-detail and
    login-choice entry points — three ways in now, not competing, each suited to a different
    starting point). **The request flow gained a real map, pickup location, and a Deluxe
    preference**, matching the regular ride-booking experience — same `RideMap` component,
    same `LocationSearchInput`, reused directly rather than rebuilt. **Multi-group sharing**:
    a request can now be visible to more than one group at once (a new
    `vuma_private_trip_request_shares` junction table, additive alongside the original
    single-`group_id` model — every existing policy and query built around `group_id` keeps
    working exactly as before; sharing with additional groups is a separate, optional
    mechanism layered on top). **A "now" button** next to every trip-date picker in Vuma
    Private, added consistently to both the new request flow and the original group-page
    form. **The driver dashboard's Vuma Private link now shows a live open-requests count**
    ("There are 3 open requests in Vuma Private now") when there's anything to show — RLS
    naturally scopes the count to whatever that specific driver can actually see, so a
    non-member correctly sees nothing added to the link at all, rather than a discouraging
    "(0) open requests."
- **Fixed a real bug where the rider request page showed nothing meaningful while
  offline or on a slow connection, despite the device's own GPS being available
  instantly.** The pickup-detection code awaited a network-dependent reverse-geocode call
  *before* ever setting the pickup point at all — meaning the map stayed on its generic
  country-center fallback, and the "locating..." banner stayed up, for as long as that
  network call took, even though the raw coordinates were available the instant the device's
  GPS resolved, with zero network involved. Fixed by setting the pickup point immediately
  with a generic "Current location" label the moment GPS resolves, then upgrading that label
  to a real address in the background once (and if) reverse geocoding succeeds — the map and
  marker now render at the right place immediately regardless of connectivity, with only the
  human-readable label arriving slightly later, or staying generic if genuinely offline,
  rather than the whole thing blocking on it. Existing connectivity warning banner is
  untouched and still shows alongside this, exactly as before. **A related root-cause gap
  found while fixing this**: neither `reverseGeocode` nor `geocodeSearch` in `lib/geo.ts` had
  a try/catch around their own `fetch()` calls — only handled a bad HTTP response, not a
  genuine network failure (which throws, rather than returning a bad response). Fixed both to
  resolve gracefully (`null` / `[]`) on any failure, so nowhere else in the app that calls
  these functions can be surprised by an unhandled rejection when offline, not just this one
  call site. Deliberately left the service worker's pre-cache list unchanged — the tempting
  next step (proactively pre-caching `/rider` and `/driver` on install) would risk caching an
  unauthenticated redirect response instead of the real dashboard, since those routes require
  login and SW install can happen before a user has ever signed in; the existing
  cache-as-actually-visited strategy is safer specifically because it only ever caches what a
  correctly-authenticated user genuinely saw.
- **Follow-up, same round**: caught that `ConnectivityBanner` already promised "Showing your
  last known location" when offline — but nothing in the app actually cached or fell back to
  one; that copy was aspirational, never backed by real behavior. Now genuinely implemented: a
  successfully resolved location is cached to `localStorage`, and if a later attempt fails
  (offline, permission denied, GPS unavailable), the rider page falls back to that cached
  point instead of leaving the map on its generic country-level default with nothing to
  explain it. Since the map can now show a *meaningful but potentially stale* location even
  when geolocation has failed, added a distinct banner specifically for that case — "Showing
  your last known location," reusing the connectivity banner's own existing language rather
  than introducing separate wording for what is, from the rider's perspective, the same
  underlying situation — so the source of the map's position is never ambiguous.
- **Follow-up found through direct testing**: `ConnectivityBanner` already auto-clears on
  reconnection (it listens for the browser's `online` event), but the rider page's own
  location fallback above did not — once it had fallen back to a cached last-known location,
  nothing re-attempted a fresh GPS fix when the connection actually came back; it needed a
  manual "Try again" tap or a full page refresh even after reconnecting, which is inconsistent
  with how the generic banner already behaves for the same event. Fixed by listening for the
  same `online` event and automatically re-calling the existing retry function — but only when
  currently sitting on the fallback (`locationError`), not on every reconnection regardless of
  state, since there's no reason to re-trigger anything once geolocation has already succeeded
  normally.
- **Split the driver mobile nav into two rows — too many items crammed into one bottom bar on
  small screens.** Previously all 7 items (Requests, Forum, Earnings, Wallet, Plan, Verify,
  Invite) squeezed into a single fixed bottom row, leaving each one cramped. The three most
  frequently used — Requests, Forum, Wallet — now live in a new, compact quick-access row near
  the top (`DriverTopQuickNav`, mobile-only), with the remaining four staying in the existing
  bottom nav, now with noticeably more room each. Desktop is untouched — `DriverDesktopTabs`
  still shows the full set in one row, since the cramped-small-screen problem this addresses
  doesn't apply there at all. The open-requests count badge moved along with "Requests" to the
  new top row rather than being lost in the split.
- **Vuma Private trip requests now auto-expire from the platform-wide feed** — 24 hours after
  the request's own scheduled `needed_at` has passed, not 24 hours after posting, so a request
  made today for a future date stays visible right up until that actual time, exactly matching
  "unless the request is for a date and time ahead." A new sweep
  (`sweep-expired-requests`), same opportunistic pattern as the other sweeps in this app,
  actually transitions the request's status to `cancelled` rather than just filtering the
  display — keeps admin views and anywhere else relying on `status = 'open'` consistent too,
  not just the feed itself. **Found the same class of gap the driver/rider sweeps already had
  fixed once before**: `/vuma-private/*` are standalone top-level routes with no shared layout
  at all, so mounting the sweep trigger only at the rider/driver layout level (where it already
  lives) would silently never fire for someone navigating directly into Vuma Private without
  having visited `/rider` or `/driver` first in that session. Fixed with a new, minimal
  `app/vuma-private/layout.tsx` whose only job is mounting the same, already-proven
  `RideSweepTrigger` — renders nothing else, so it doesn't change any existing page's
  appearance or behavior at all. A group's own request list page was deliberately left
  showing all statuses including cancelled/expired (with their existing status badge) rather
  than hiding them outright — that page already functions more like a group's activity
  history than a live feed, and members plausibly want to see "this one expired, nobody
  offered" as context, not have it vanish silently.
- **Bulk select added to both places in Vuma Private where you pick multiple things** —
  co-opting members into a group, and choosing which of your groups should see a trip
  request. Both now have a "select all" toggle and, for co-option specifically, a single "Add
  selected" bulk action, rather than needing to tap each one individually. Moved
  `BulkActionBar` from `components/admin/` to `components/ui/` to reuse it here — it was never
  actually admin-specific, just built there first; the three existing admin pages using it had
  their imports updated to match, with no change to their own behavior. The bulk-add path
  tracks and reports partial failures rather than silently skipping them — a member's
  standing consent could plausibly change between the list loading and the bulk action
  running, and it's worth saying which ones didn't go through rather than just leaving them
  unmarked with no explanation.
- **Admin Quick Tasks "Review" links now go straight to a filtered, actionable view, not the
  general list.** Previously both driver-verification and Deluxe-application tasks linked to
  the same generic `/admin/drivers` page, sorted by default order, leaving the admin to
  re-scan the whole driver list to find who actually needed action. Both now link to
  `/admin/drivers?filter=pending_verification` or `?filter=pending_deluxe`, which show only
  the matching drivers with a "select all" bulk action bar (Approve/Reject for verification,
  Certify/Reject for Deluxe) right there — and a "Clear filter" link back to the full list.
  The filter criteria deliberately matches exactly what Quick Tasks itself counted
  (`verification_status = 'pending' AND submitted_at is not null` — not just `'pending'`
  alone, since that's the default for every brand-new signup too, not only real,
  reviewable applications), so the number someone clicked "Review" on is exactly what shows.
  **A genuinely broken link found and fixed along the way**: "Duplicate vehicle plate
  flagged" pointed at `/admin/referrals`, a page with no dedicated section for this at all —
  the flag is a driver-profile property only shown there incidentally, alongside a referred
  driver's name. `/admin/fraud` already had a proper, pre-filtered "Duplicate vehicle plate
  flags" section this whole time; the task link was just pointed at the wrong page. Left this
  one as a filtered list linking to each driver individually rather than adding bulk actions —
  a duplicate-plate flag genuinely needs individual investigation (comparing plate numbers
  across drivers), not something safely resolved in bulk.

## Publishing to Google Play Store

Vuma is installable as a PWA out of the box, and can also be published as a
real Play Store listing via TWA (Trusted Web Activity) — no rewrite needed,
your deployed site becomes the actual app content. Everything you need is in
the `docs/` folder:

- **`docs/PLAY_STORE_DEPLOYMENT_GUIDE.md`** — full step-by-step guide, from
  Play Console signup through building the signed `.aab` and submitting for
  review
- **`docs/PLAY_STORE_LISTING.md`** — ready-to-paste store listing copy
  (descriptions, category, content rating guidance, data safety mapping)
- **`twa-manifest.json`** (project root) — pre-filled Bubblewrap config
- **`public/.well-known/assetlinks.json`** — placeholder, needs your real
  signing key fingerprint filled in (guide covers this)
- **`app/privacy/page.tsx`** and **`app/terms/page.tsx`** — legal pages Play
  Store requires; replace the `[BRACKETED]` placeholders (legal entity name,
  contact email) before publishing

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, Realtime) ·
Leaflet + OpenStreetMap · Recharts · PayFast · Paynow · jsPDF
