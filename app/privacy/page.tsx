import { Logo } from "@/components/ui/Logo";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Vuma",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between max-w-3xl mx-auto">
        <Logo />
        <Link href="/" className="text-sm text-navy-400 hover:text-navy-600">
          Back to Vuma
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10 legal-content">
        <h1 className="text-3xl font-bold mb-2">Vuma Privacy Policy</h1>
        <p className="text-navy-400 text-sm mb-8">Last updated: 17 August 2026</p>

        <p>
          This policy explains what information Vuma ("we," "our," "the app") collects from riders and
          drivers, why we collect it, who can see it, and the choices you have. Vuma operates in South
          Africa and Zimbabwe, and is operated by Pearson Marasha, trading as Vuma, of Harare, Zimbabwe.
        </p>

        <h2>1. Information we collect</h2>

        <h3>From every user (rider or driver)</h3>
        <ul>
          <li><strong>Account information:</strong> full name, phone number and/or email address, password (stored securely, never in plain text), country.</li>
          <li><strong>Location data:</strong> your device's GPS location, used to set pickup points, calculate routes and fares, and — for drivers — to show your position to a matched rider and nearby drivers during an SOS alert. Location is only collected while the app is open and, for drivers, while online.</li>
          <li><strong>Trip information:</strong> pickup/drop-off addresses, fare offers, ride status, and in-app chat messages exchanged with your matched rider/driver during a trip.</li>
          <li><strong>Ratings:</strong> a star rating, and — for driver ratings specifically — optional tags (e.g. politeness, punctuality, vehicle cleanliness) and an optional free-text comment. The free-text comment and tags go only to our admin team, not to the driver directly.</li>
          <li><strong>Payment references:</strong> for driver subscriptions, we store transaction reference codes, payment amounts, and — if you choose to submit one — an uploaded proof-of-payment file (e.g. a screenshot or PDF). We do not store full card numbers or mobile money PINs.</li>
        </ul>

        <h3>From drivers specifically</h3>
        <ul>
          <li>Government-issued ID, driver's license, vehicle registration document, and a profile photo, for identity and safety verification.</li>
          <li>Vehicle details: make, model, color, plate number, seat capacity.</li>
          <li>If you request Vuma Deluxe certification: notes from our admin team's physical vehicle inspection, and the inspection/certification dates.</li>
        </ul>

        <h3>Automatically collected</h3>
        <ul>
          <li>Device and usage information (app version, general diagnostics) to keep the service reliable.</li>
        </ul>

        <h2>2. How we use this information</h2>
        <ul>
          <li>To match riders with nearby drivers and facilitate fare negotiation.</li>
          <li>To verify driver identity, vehicle, and documentation before allowing them to accept rides.</li>
          <li>To calculate distances, routes, and fare estimates.</li>
          <li>To operate safety features, including the SOS alert system: if you trigger an SOS, we share your location and the other party's name, vehicle, and plate number with the nearest available verified drivers so they can assist, and this information may also be reviewed by our safety team.</li>
          <li>To process driver subscription payments and referral/wallet credits.</li>
          <li>To communicate with you about your account, a trip, or support requests.</li>
          <li>To comply with legal obligations and investigate misuse of the platform.</li>
        </ul>

        <h2>3. Who we share information with</h2>
        <ul>
          <li><strong>Your matched rider or driver:</strong> name, phone number, vehicle details, and chat messages are shared only while a trip is active, and access ends once the trip is completed or cancelled.</li>
          <li><strong>Emergency contacts and responders:</strong> if you use "Share my ride," trip details and a live tracking link are sent to whoever you share them with. If you trigger SOS, relevant details are shared with nearby drivers and may be shared with law enforcement, emergency services, or — where a private security provider is configured for your area — that provider's rapid-response line, if you or a responding driver chooses to contact them.</li>
          <li><strong>Service providers:</strong> our database and authentication provider (Supabase), mapping/geocoding providers (OpenStreetMap, LocationIQ), and payment gateways (PayFast, Paynow), solely to operate the service.</li>
          <li><strong>Legal and safety reasons:</strong> if required by law, or to protect the rights, property, or safety of Vuma, our users, or the public.</li>
        </ul>
        <p>We do not sell your personal information to third parties.</p>

        <h2>4. Data retention</h2>
        <p>
          We retain account and trip information for as long as your account is active and as needed to
          comply with legal, tax, or dispute-resolution obligations. Driver verification documents are
          retained for the duration of the driver's active status on the platform plus any legally
          required retention period. You can request <Link href="/delete-account">deletion of your account</Link> at any time.
        </p>

        <h2>5. Your choices and rights</h2>
        <ul>
          <li>You can edit your name and phone number at any time in Settings.</li>
          <li>You can control location permissions through your device settings; note that some features (ride matching, live tracking) will not work without location access.</li>
          <li>You can request a copy of your data or <Link href="/delete-account">request that we delete your account</Link>. We may retain limited records where required by law (e.g., completed trip and payment records for financial/tax compliance).</li>
        </ul>

        <h2>6. Children's privacy</h2>
        <p>
          Vuma is not directed at children and is not intended for use by anyone under 18. We do not
          knowingly collect information from children.
        </p>

        <h2>7. Security</h2>
        <p>
          We use industry-standard measures (encrypted connections, access controls, and row-level
          database security) to protect your information. No system is completely secure, and we
          encourage you to use a strong, unique password.
        </p>

        <h2>8. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be notified in-app or via
          email before they take effect.
        </p>

        <h2>9. Contact us</h2>
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a href="mailto:pmarashazw@gmail.com">pmarashazw@gmail.com</a>.
        </p>
      </div>
    </main>
  );
}
