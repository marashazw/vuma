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

        <p>
          These terms govern your use of Vuma. By creating an account, you agree to them. [REPLACE:
          legal entity name, registration number, registered address, and governing law/jurisdiction
          before publishing — recommend having a local lawyer review this document, this is a starting
          template, not final legal advice.]
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
          [REPLACE: have this section reviewed by a lawyer licensed in your operating jurisdiction(s) —
          liability rules for ride-hailing intermediaries vary by country and this template section is
          not a substitute for local legal advice.]
        </p>

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
