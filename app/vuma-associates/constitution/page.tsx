import { Logo } from "@/components/ui/Logo";
import { ConstitutionContent } from "@/components/vuma-associates/ConstitutionContent";
import Link from "next/link";

export const metadata = {
  title: "Vuma Associates Constitution — Vuma",
};

export default function ConstitutionPage() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between max-w-3xl mx-auto">
        <Logo />
        <Link href="/" className="text-sm text-navy-400 hover:text-navy-600">
          Back to Vuma
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-bold mb-2">Vuma Associates Constitution</h1>
        <p className="text-navy-400 text-sm mb-8">
          Shown to anyone joining Vuma Associates during sign-up, and available here for reference at any time.
        </p>
        <ConstitutionContent />
      </div>
    </main>
  );
}
