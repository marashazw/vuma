import { Logo } from "@/components/ui/Logo";
import Link from "next/link";

export const metadata = {
  title: "Delete Your Account — Vuma",
};

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between max-w-3xl mx-auto">
        <Logo />
        <Link href="/" className="text-sm text-navy-400 hover:text-navy-600">
          Back to Vuma
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10 legal-content">
        <h1 className="text-3xl font-bold mb-2">Delete Your Account</h1>
        <p className="text-navy-400 text-sm mb-8">Last updated: 17 August 2026</p>

        <p>
          You can request that your Vuma account, and the personal data associated with it, be deleted at
          any time. This applies whether you signed up as a rider or a driver.
        </p>

        <h2>How to request deletion</h2>
        <p>
          Send an email to <a href="mailto:pmarashazw@gmail.com">pmarashazw@gmail.com</a> from the email
          address (or including the phone number) associated with your Vuma account, with the subject line
          "Account Deletion Request". Include your full name and the phone number or email you used to sign
          up, so we can locate the correct account.
        </p>

        <h2>What happens next</h2>
        <ul>
          <li>We'll confirm receipt of your request within a few business days.</li>
          <li>
            Your account, profile information, saved locations, and any documents you uploaded (ID, vehicle
            registration, profile photo) will be permanently deleted.
          </li>
          <li>
            Any wallet balance will be handled according to our standard refund process before deletion —
            we'll be in touch about this as part of confirming your request.
          </li>
        </ul>

        <h2>What we may retain</h2>
        <p>
          Some information cannot be deleted immediately, even on request, because we're legally required to
          keep it:
        </p>
        <ul>
          <li>
            Completed trip and payment records, retained for the period required by South African and/or
            Zimbabwean financial and tax record-keeping law, even after your account itself is deleted.
          </li>
          <li>
            Records relevant to an open dispute, safety report, or fraud investigation involving your
            account, retained until that matter is resolved.
          </li>
        </ul>
        <p>
          Retained records are kept solely for these purposes and are not used for any other purpose once
          your account is deleted.
        </p>

        <h2>Questions</h2>
        <p>
          See our full <Link href="/privacy">Privacy Policy</Link> for more detail on what data we collect
          and why, or contact <a href="mailto:pmarashazw@gmail.com">pmarashazw@gmail.com</a> with any
          questions before submitting a deletion request.
        </p>
      </div>
    </main>
  );
}
