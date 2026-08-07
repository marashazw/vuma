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
written by a lawyer, but not a bare template either. It already covers the
platform's role, eligibility, payment structure, conduct rules, safety
features, account actions, and a general liability limitation. I'd like your
eyes on the whole thing, but three areas matter most:

### 1. Section 1 — entity details and governing law

Currently has placeholders for:
- Legal entity name
- Registered address
- Governing jurisdiction

I haven't finalized whether to operate as an individual or a registered
company yet — happy to talk through what you'd recommend given Vuma handles
real money (driver subscriptions, commission, prepaid balances) across two
countries.

### 2. Section 3a — scheduled rides (the part I'd most like flagged)

This is the newest and most legally load-bearing section. Vuma lets riders
book a ride ahead of time. Once a driver accepts:

- Either side can cancel free of charge up to 1 hour before the scheduled
  time.
- A driver who cancels within that 1-hour window, or doesn't show up, gets
  their account **flagged** (no monetary penalty — an earlier draft had a
  50% fee here, since removed in favor of a flag-based approach applied
  equally to both roles).
- A rider who cancels within that window also gets flagged.
- A **second flag within a rolling 3-month period**, for either role,
  results in a **7-day suspension** (not permanent).
- A suspended user can submit an appeal explaining the circumstances — Vuma
  reviews it and has final discretion over whether the suspension is lifted
  early, reduced, or upheld.
- Either side can instead propose cancelling by mutual agreement (illness,
  a flight delay, etc.) — if the other side accepts, no flag applies to
  either party.

Specific questions for you:
- Does a 7-day, time-limited suspension (versus the earlier permanent-ban
  or monetary-penalty approaches) sit more comfortably from a fairness/
  proportionality standpoint, or does it raise different concerns?
- Is the appeal process as described (submit a reason, Vuma has final
  discretion) sufficient due process, or would you recommend something more
  formal — a minimum response time, a required written explanation for a
  rejection, etc.?
- Does a rolling 3-month window for counting flags need to be disclosed more
  precisely (e.g., exact wording on how the window is calculated) to be
  enforceable as written?

### 3. Section 7 — limitation of liability

Currently a fairly standard "platform not liable for acts of riders/drivers,
provided as-is" clause. Ride-hailing intermediary liability rules vary a lot
by country, and I know South Africa and Zimbabwe won't necessarily treat this
the same way — flagging this as the section most likely to need
jurisdiction-specific rewording rather than a light edit.

## Also worth a glance if you have time

- Section 3's wallet consent language — drivers must explicitly confirm
  (checkbox, at the moment of each top-up) that their deposit is
  non-refundable and only applicable toward commission or subscription
  fees. Worth a quick check that this consent mechanism is sufficient on
  its own, or whether it needs to also appear in these terms with more
  specific wording.
- The privacy policy (`app/privacy/page.tsx`) has the same entity-name
  placeholder and could use a pass too, though it's a lower-complexity
  document than the terms.

No pressure to turn this around fast — just let me know what you'd want
changed, or if it's easier to mark it up directly, either works.

Thank you again for doing this.
