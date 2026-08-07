import { Logo } from "@/components/ui/Logo";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Vuma",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between max-w-3xl mx-auto">
        <Logo />
        <Link href="/" className="text-sm text-navy-400 hover:text-navy-600">
          Back to Vuma
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10 legal-content">
        <h1 className="text-3xl font-bold mb-2">Vuma Terms of Service</h1>
        <p className="text-navy-400 text-sm mb-8">Last updated: [DATE — update before publishing]</p>

        {/*
          NOTE FOR LEGAL REVIEWER — not rendered on the page, this comment
          only appears in source. See the accompanying note sent alongside
          this document for the full context on what specifically needs
          review (Sections 3, 3a, and 7 especially).
        */}
        <p>
          These terms govern your use of Vuma. By creating an account, you agree to them. Vuma is
          operated by [LEGAL ENTITY NAME], of [REGISTERED ADDRESS]. These terms are governed by the laws
          of [GOVERNING JURISDICTION].
        </p>

        <h2>1. What Vuma is</h2>
        <p>
          Vuma is a technology platform that connects riders with independent drivers and lets them
          agree on a fare directly. <strong>Vuma is not a transportation company</strong> and does not
          employ drivers. Drivers are independent contractors responsible for their own vehicle,
          licensing, insurance, and compliance with local transport regulations.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years old to use Vuma. Drivers must hold a valid driver's license,
          vehicle registration, and any permits required by local law, and must pass Vuma's verification
          process before accepting rides.
        </p>

        <h2>3. Fares and payment</h2>
        <p>
          Fares are agreed directly between rider and driver through the app's negotiation feature.
          Unless a ride is covered by a referral or wallet credit, payment is settled directly between
          rider and driver (e.g., in cash or via a method they agree on) — Vuma does not process rider
          fare payments. Driver subscription fees are paid to Vuma via the payment methods offered in
          the app.
        </p>
        <p>
          Drivers who are not on an active subscription plan maintain a prepaid wallet balance with
          Vuma, from which Vuma's commission on each ride is deducted automatically at the start of
          that ride. A driver whose wallet balance is insufficient may be prevented from accepting new
          rides until the balance is topped up. Wallet top-ups are reviewed and confirmed by Vuma before
          the balance is credited, and each top-up requires the driver's explicit confirmation that the
          amount is <strong>non-refundable</strong> and will only be applied toward ride commission or
          subscription fees. A driver may also use their wallet balance to pay for a subscription plan
          directly. Where a rider pays part of a fare using their own Vuma Wallet (change) credit, the
          driver is credited the equivalent amount into their own prepaid wallet, since Vuma facilitated
          that credit on the driver's behalf.
        </p>

        <h2>3a. Scheduled rides</h2>
        <p>
          Vuma allows a rider to book a ride for a specific future date and time ("scheduled ride")
          instead of immediately. Once a driver has accepted a scheduled ride, the following apply:
        </p>
        <ul>
          <li>
            Either party may cancel freely at any time up until <strong>one hour before</strong> the
            scheduled time, without consequence.
          </li>
          <li>
            A driver who cancels within one hour of the scheduled time, or who does not show up, and a
            rider who cancels within one hour of the scheduled time, will have their account flagged.
          </li>
          <li>
            A second such flag within a rolling <strong>3-month</strong> period results in a{" "}
            <strong>7-day suspension</strong> from the platform.
          </li>
          <li>
            A suspended user may submit an appeal explaining the circumstances. Vuma reviews each appeal
            and retains final discretion over whether a suspension is lifted early, reduced, or upheld.
          </li>
          <li>
            Either party may instead propose cancelling by mutual agreement (for example, due to illness
            or a flight delay), stating a reason. If the other party accepts, the ride is cancelled with
            no flag to either side.
          </li>
        </ul>
        <p>
          [REPLACE: confirm the flag/suspension mechanism and appeal process described above meet
          applicable consumer-protection and due-process expectations in each jurisdiction Vuma
          operates in.]
        </p>

        <h2>4. Conduct</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Provide false identity, vehicle, or verification information.</li>
          <li>Use the platform for any unlawful purpose.</li>
          <li>Harass, threaten, or endanger another user.</li>
          <li>Misuse the SOS or safety features (e.g., false alarms).</li>
          <li>Attempt to circumvent commission, verification, or safety systems.</li>
        </ul>
        <p>We may suspend or terminate accounts that violate these terms.</p>

        <h2>5. Safety features</h2>
        <p>
          Vuma provides safety tools including SOS alerts, ride sharing, and driver verification. These
          tools are aids, not guarantees of safety. In a genuine emergency, always contact local
          emergency services directly in addition to using in-app features.
        </p>

        <h2>6. Ratings and account action</h2>
        <p>
          We may use ratings, reports, and verification status to restrict, suspend, or remove access to
          the platform for either riders or drivers, at our discretion, to protect the safety and
          integrity of the platform.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Vuma is not liable for the acts or omissions of
          riders or drivers using the platform, including during a trip arranged through the app. Vuma
          provides the platform "as is" without warranties of any kind.
        </p>
        {/*
          NOTE FOR LEGAL REVIEWER — liability rules for ride-hailing
          intermediaries vary significantly by country; this section is a
          starting template, not a substitute for jurisdiction-specific
          advice. See the accompanying note for full context.
        */}

        <h2>8. Changes to these terms</h2>
        <p>We may update these terms from time to time. Continued use of Vuma after changes take effect constitutes acceptance of the updated terms.</p>

        <h2>9. Contact us</h2>
        <p>
          Questions about these terms can be sent to <a href="mailto:legal@example.com">[REPLACE: legal@yourdomain.com]</a>.
        </p>
      </div>
    </main>
  );
}
