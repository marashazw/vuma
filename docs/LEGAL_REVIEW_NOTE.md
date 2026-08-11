# Note to reviewer — Vuma Terms of Service

Thank you for offering to look this over. Some context to make the review
faster, and a few specific spots where your input would help most.

## What Vuma is

A ride-hailing marketplace app (like a fare-negotiation-based alternative to
existing ride-hailing platforms) operating in **South Africa and Zimbabwe**.
Riders and drivers agree on a fare directly through the app; Vuma is the
intermediary platform, not the transportation provider itself.

## What this document is

`app/terms/page.tsx` in the attached project is a working draft — not
written by a lawyer, but not a bare template either. It covers the
platform's role, eligibility, payment structure, taxes and levies, scheduled
rides, conduct rules, safety features, account actions, and a general
liability limitation. I'd like your eyes on the whole thing, but four areas
matter most — three from before, plus one genuinely new since you last saw
this.

### 1. Section 1 — entity details and governing law

Currently has placeholders for:
- Legal entity name
- Registered address
- Governing jurisdiction

I haven't finalized whether to operate as an individual or a registered
company yet — happy to talk through what you'd recommend given Vuma handles
real money (driver subscriptions, commission, prepaid balances, and now tax
collection — see below) across two countries.

### 2. Section 3a — taxes and levies (new since you last reviewed this)

Vuma can now collect regulatory charges (e.g. VAT, a road fund levy) on a
ride, admin-configured per country, deducted from the driver alongside
commission. The document is explicit that this is **not Vuma's own revenue**
— it's collected and held on behalf of, and remitted to, the relevant
regulator.

Specific questions for you:
- Does acting as a collection intermediary for regulatory charges in either
  jurisdiction create any registration, licensing, or reporting obligation
  for Vuma beyond what operating the marketplace itself already requires?
- Is "collected and held on behalf of, and remitted to, the applicable
  regulator" the right framing, or does actual remittance need to be
  described more specifically (timing, method, audit trail) to hold up if
  ever challenged?
- This is currently admin-configurable with no specific regulator named in
  the terms themselves — worth flagging if you think a specific named
  authority (or a defined process for how a new charge gets added) should
  be referenced directly rather than left general.

### 3. Section 3b — scheduled rides (still the most legally load-bearing
section, and it's grown since you last saw it)

Vuma lets riders book a ride ahead of time. Once a driver accepts, the
core mechanism is unchanged from before — free cancellation up to 1 hour
before the scheduled time, a flag (not a monetary penalty) for a late
cancellation or no-show, a second flag within a rolling 3-month period
triggering a 7-day suspension with an appeal process, and mutual-agreement
cancellation with no flag to either side.

**Two things added since you last reviewed this:**

- **If a mutual-cancellation proposal is rejected**, the party who proposed
  it can now either proceed with the trip as scheduled, or cancel anyway —
  and cancelling anyway after an explicit rejection flags them *regardless
  of how far in advance this happens*, unlike an ordinary cancellation,
  which only flags within the 1-hour window. The reasoning: deliberately
  overriding the other party's explicit objection is being treated as
  materially different from an ordinary early cancellation with no
  disagreement attached to it.
- **Once the scheduled time arrives**, either party can be asked to confirm
  the other has arrived, or report that they haven't. The terms now
  address a report made in good faith that turns out to be wrong — it
  isn't itself a breach, though a pattern of apparently bad-faith reports
  could be treated as one under the conduct section.

Specific questions for you:
- Does an *unconditional* flag for "cancel anyway after rejection" (no
  time-based exception at all) sit differently, proportionality-wise, than
  the time-boxed flag for an ordinary cancellation? It's a deliberately
  stricter rule and I want to make sure that's defensible, not just
  intuitive.
- Is "not itself a breach... but a pattern... may be treated as one" clear
  enough, or does a good-faith-reporting protection need more explicit
  language to actually function as a defense if someone's flagged based on
  a report that turns out to be mistaken?
- Same standing questions as before: does the 7-day suspension and appeal
  process meet consumer-protection/due-process expectations in each
  jurisdiction, and does the 3-month rolling window need more precise
  disclosure to be enforceable as written?

### 4. Section 7 — limitation of liability

Unchanged since you last saw it, still flagging it: a fairly standard
"platform not liable for acts of riders/drivers, provided as-is" clause.
Ride-hailing intermediary liability rules vary a lot by country, and I know
South Africa and Zimbabwe won't necessarily treat this the same way — this
is still the section most likely to need jurisdiction-specific rewording
rather than a light edit.

## Also worth a glance if you have time

- Section 2 now references a mandatory declaration drivers must accept
  during verification (authorised to operate, vehicle insured/certified,
  will comply with local law, Vuma not accountable for their actions). The
  actual declaration text lives in the verification flow itself, not the
  terms — worth checking whether referencing it like this is sufficient,
  or whether the full text should be reproduced in the terms directly.
- Section 6 now mentions that Vuma can place an account on a temporary
  hold while investigating a specific concern, separate from the
  automatic rating/flag-based suspension system, with access restored once
  the investigation concludes absent further grounds for suspension. Worth
  a check that this reads as a genuinely provisional measure and not
  something that could be read as a punitive action taken without process.
- The privacy policy (`app/privacy/page.tsx`) has the same entity-name
  placeholder and could use a pass too, though it's a lower-complexity
  document than the terms. It may also be worth a look now that there's
  more admin-side monitoring in place (fraud-pattern detection, an admin
  rider lookup tool) than there was when it was last drafted — nothing in
  the terms changed for this, but the privacy policy's description of what
  Vuma does with usage data may want to catch up.

No pressure to turn this around fast — just let me know what you'd want
changed, or if it's easier to mark it up directly, either works.

Thank you again for doing this.
