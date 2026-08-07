# Vuma — Play Store Listing Content

Copy-paste ready content for the Play Console store listing. Replace anything in
`[BRACKETS]` before publishing. Updated to reflect Vuma's current feature set —
this has grown substantially since the app was first drafted.

---

## App name
**Vuma**

## Short description (max 80 characters)
```
Name your fare. Meet in the middle. Ride-hailing for South Africa & Zimbabwe.
```
(78 characters)

## Full description (max 4000 characters)

```
Vuma is the ride-hailing app built around one idea: riders and drivers should
agree on a fair price together — not have it dictated by a black-box algorithm.

HOW IT WORKS
• Set your pickup and drop-off, and name the fare you want to pay
• Drivers see your request and can accept or counter-offer
• Watch the negotiation happen live until you agree — no hidden pricing

FOR RIDERS
• Fair-range guidance based on real road distance, so you know what's reasonable
• Live driver tracking and ETA once your ride is accepted
• See the driver's name, vehicle, and plate number before they arrive
• In-app chat and direct call with your matched driver
• Share your trip live with friends or family via WhatsApp — no account needed
  for them to follow along
• Schedule a ride ahead of time for a fixed date and time — ideal for airport
  runs, school pickups, or any trip you don't want to leave to chance
• A quick weather check at your destination before you leave — a heads-up if
  you'll want an umbrella or a coat when you arrive
• SOS button that alerts nearby verified drivers and prompts a call to local
  emergency services, plus a direct line to private security response where
  available
• Rate your driver and flag specific issues — politeness, punctuality, vehicle
  cleanliness — that get reviewed if they recur
• Earn free ride credits by inviting friends
• A Vuma Wallet for change credit — no more "sorry, no change" from your
  driver, and that credit carries over to your next ride
• Vuma Deluxe — request an executive, top-of-range vehicle for a premium trip
• Download a PDF receipt for any completed trip

FOR DRIVERS
• Transparent commission — see the exact rate before you accept every ride
• Choose a flat subscription instead of per-ride commission if that suits you
  better, with weekly or monthly plans, payable manually with proof of
  payment (card payments coming soon)
• A prepaid wallet keeps commission simple and automatic — top up once, no
  surprise bills later
• See and respond to scheduled (fixed-time) ride requests, clearly marked so
  you know what you're accepting ahead of time
• Drivers Forum — share and see live road conditions from other drivers on
  your actual route, automatically surfaced before you head that way
• Set your vehicle's seat capacity — only see requests you can actually fit
• Refer other drivers and earn spendable credit toward your subscription or a
  priority-ranking boost
• Register your vehicle for Vuma Deluxe if it's executive-class — earn
  premium fares after a physical inspection and certification
• Priority ranking and reward credits for honoring referral rides or
  responding to a nearby SOS alert
• Document verification keeps the platform safer for everyone

SAFETY FIRST
Every driver is ID- and vehicle-verified before they can accept a ride. Our
SOS system notifies the five nearest verified drivers with the vehicle and
driver details, in addition to prompting a direct call to local emergency
services and, where configured, a private security rapid-response line.
Repeated, verified rider complaints about a driver trigger an automatic
review process to keep the platform accountable.

Built for Southern Africa, ready to grow anywhere.
```

## Category
**Maps & Navigation** (primary) — some regions also allow **Travel & Local**; pick
whichever Play Console offers for your account, Maps & Navigation is the closer fit
for ride-hailing apps.

## Tags / keywords (if prompted)
ride hailing, rideshare, taxi, South Africa, Zimbabwe, driver, fare negotiation

## Contact details (required)
- **Email**: `[REPLACE: support@yourdomain.com]`
- **Phone** (optional but recommended for ride-hailing category): `[REPLACE]`
- **Website**: `https://vuma-self.vercel.app` (or your custom domain)

## Privacy Policy URL (required)
`https://vuma-self.vercel.app/privacy`

**Note**: the privacy policy page (`app/privacy/page.tsx`) was written before several
newer features (Vuma Deluxe certification, security provider integration, proof-of-payment
uploads, structured rating tags). Give it a read-through and update the data-collection
description before submitting — see the Data Safety table below for what's changed.

## App access
Since Vuma requires login to use, Play Console will ask for a way to review the
full app. Provide test credentials:
- Create a dedicated reviewer account (rider role) via the signup flow — do not
  reuse a real user's credentials
- Under **App content → App access**, select "All or some functionality is
  restricted" and provide that test email/password
- Consider also providing a second, driver-role test account with a completed
  vehicle profile, since a reviewer clicking around as a rider alone won't see
  the driver-side experience (subscriptions, Deluxe certification, etc.)

---

## Content rating questionnaire — guidance

Play Console's IARC questionnaire asks yes/no questions. Suggested answers for
Vuma (a ride-hailing marketplace, no gambling/violence/adult content of its own):

| Question area | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances | No |
| Gambling | No |
| User-generated content (chat, ratings/comments) | **Yes** — in-app chat between matched rider/driver, and free-text rating comments sent to admin, are both user-generated text. Disclose this. |
| Shares location | **Yes** |
| Digital purchases | **Yes** — driver subscriptions, paid via manual proof-of-payment currently |
| Users can interact / communicate | **Yes** |

Expect a rating similar to "Everyone" or "Teen" depending on the user-generated
chat/rating-comment and location-sharing disclosures — the questionnaire computes the
final rating automatically from your answers.

---

## Data Safety section — guidance

Play Console's Data Safety form asks what data you collect and why. Based on
what Vuma's code actually does (updated for the current feature set):

| Data type | Collected? | Purpose | Shared with others? |
|---|---|---|---|
| Name | Yes | Account, identification during a trip | Yes — with matched rider/driver only, during active trip |
| Email address | Yes (if email signup) | Account | No |
| Phone number | Yes | Account, calling during a trip | Yes — with matched rider/driver only, during active trip |
| Precise location | Yes | Ride matching, routing, live tracking, SOS | Yes — with matched rider/driver, nearby drivers during SOS, and a configured security provider if used |
| User IDs | Yes | Account | No |
| Photos/files (ID, license, vehicle registration, profile photo — drivers; proof-of-payment uploads — drivers) | Yes | Driver verification; subscription payment verification | Reviewed by Vuma admins only |
| In-app messages | Yes | Rider/driver trip communication | Yes — with matched rider/driver only |
| Ratings and free-text comments | Yes | Service quality, driver accountability review | Star rating visible to the driver; free-text "other comment" goes only to Vuma admins |
| Payment info (reference codes, uploaded proof, amounts — not card/PIN numbers) | Yes | Driver subscription billing verification | No |
| Vehicle details (make, model, plate, seat count) | Yes | Ride matching, driver identification, Vuma Deluxe eligibility | Yes — plate/vehicle shown to matched riders |
| App activity / diagnostics | Yes | Reliability | No |

Declare data is **encrypted in transit** (Supabase/HTTPS — true) and that users
can **request deletion** (true — via the contact email in your privacy policy).

---

## Screenshots needed (minimum 2, recommend 4–8 — pick your best from the list below)

Capture these from a real or emulated phone at your production URL:
1. Landing/hero screen
2. Rider request screen with map + fare range (and the Vuma Deluxe toggle visible)
3. Negotiation screen (the converging-bubbles view)
4. Rider scheduling a fixed-time ride (the date/time picker)
5. Driver's open-requests feed, ideally with a "SCHEDULED TRIP" badge visible
6. Active trip with live map + ETA
7. Rider Wallet screen (shows the change-credit balance concept clearly)
8. Driver subscription screen (shows the numbered "3 ways to pay" flow)
9. Drivers Forum (shows a road alert with "reported X ago")
10. Admin dashboard overview (optional, shows platform depth)

Phone screenshots: minimum 320px, maximum 3840px on the longest side, JPEG or
24-bit PNG (no alpha).

## Graphic assets (already generated in this project)

| Asset | File | Play Console requirement |
|---|---|---|
| App icon | `public/icon-512.png` | 512×512, 32-bit PNG |
| Feature graphic | `public/play-store-feature-graphic.png` | 1024×500, JPEG or 24-bit PNG (no alpha) |

Note: the feature graphic was generated as RGB (no alpha) already, ready to upload
as-is. Screenshots you'll need to capture yourself from the running app.
