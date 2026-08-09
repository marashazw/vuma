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
  row for the closest few (up to 5), with a generic person icon for any driver without a photo
  on file. **A real access-control finding surfaced while building this**: a direct client
  query for other drivers' name/avatar wouldn't have worked at all — `profiles` SELECT is
  restricted to your own row, admin, or someone you already share an active ride with, and a
  rider browsing nearby drivers happens *before* any ride exists, so none of those conditions
  would be true. Rather than widen RLS to let any authenticated user read arbitrary profile
  rows (which would expose far more than just a name and photo, since RLS grants or denies
  whole rows, not individual columns), this uses a narrow server-side route
  (`/api/drivers/public-info`) that returns only `full_name` and `avatar_url`, and only for
  drivers it independently re-verifies are currently online and verified — not a general
  "look up any user by id" tool.
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
39. Then run `supabase/seed.sql` (optional but recommended — adds starter subscription plans
    for both ZA and ZW so the driver subscription page isn't empty).
40. Go to Project Settings → API and copy:
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
