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
- A driver who cancels within that 1-hour window, or doesn't show up, can be
  charged **up to 50% of the agreed fare**, deducted from a prepaid wallet
  balance they maintain with Vuma.
- A rider who cancels within that window gets their account flagged; a
  **second flag results in account suspension**.
- Either side can instead propose cancelling by mutual agreement (illness,
  a flight delay, etc.) — if the other side accepts, no penalty or flag
  applies to either party.

Specific questions for you:
- Is a 50% penalty, structured this way, likely to be treated as an
  enforceable liquidated-damages clause, or could it read as a penalty
  clause a court might strike down, in either jurisdiction?
- Does the two-strikes-and-suspended mechanism for riders need any kind of
  notice, appeal, or "contest this flag" right built in before it's
  defensible?
- Is deducting the penalty from a driver's own prepaid balance (money they
  put in themselves) different, legally, from charging them after the fact
  — and does that matter here?

### 3. Section 7 — limitation of liability

Currently a fairly standard "platform not liable for acts of riders/drivers,
provided as-is" clause. Ride-hailing intermediary liability rules vary a lot
by country, and I know South Africa and Zimbabwe won't necessarily treat this
the same way — flagging this as the section most likely to need
jurisdiction-specific rewording rather than a light edit.

## Also worth a glance if you have time

- Section 3's wallet-refund question — I've left it genuinely open (see the
  inline note) on whether an unused prepaid wallet balance should be
  refundable on request, and if so, under what conditions.
- The privacy policy (`app/privacy/page.tsx`) has the same entity-name
  placeholder and could use a pass too, though it's a lower-complexity
  document than the terms.

No pressure to turn this around fast — just let me know what you'd want
changed, or if it's easier to mark it up directly, either works.

Thank you again for doing this.
