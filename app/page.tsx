import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/ui/Logo";
import { ArrowRight, ShieldCheck, Wallet, MapPinned, Users } from "lucide-react";

export default async function LandingPage() {
  // Skip the marketing page entirely for anyone already logged in — this
  // is what makes the app open straight to the map/location on repeat
  // visits (particularly the installed app, where the marketing page has
  // no real purpose once someone's already signed up) instead of an extra
  // tap through "Log in" every single time.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    redirect(profile?.role === "driver" ? "/driver" : profile?.role === "admin" ? "/admin" : "/rider");
  }

  return (
    <main className="bg-paper text-navy-800">
      {/* Nav */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="label text-gold-600 mb-4">South Africa &middot; Zimbabwe &middot; and beyond</p>
          <h1 className="text-5xl sm:text-6xl font-bold leading-[1.05] mb-6">
            Name your fare.
            <br />
            <span className="text-gold-500">Meet in the middle.</span>
          </h1>
          <p className="text-lg text-navy-500 max-w-md mb-8">
            Vuma is the ride-hailing app where riders and drivers agree on a price together —
            transparent commission, instant driver payouts, and fair terms on both sides of the
            trip.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn-primary">
              Ride with Vuma <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/signup" className="btn-dark">
              Drive with Vuma
            </Link>
          </div>
        </div>

        {/* Negotiation mock */}
        <div className="card p-8">
          <p className="label mb-6">How a fare gets agreed</p>
          <div className="relative h-28 mb-6">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-navy-100" />
            <div className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-gold-300" style={{ left: "18%", width: "34%" }} />
            <div className="absolute top-0 flex flex-col items-center" style={{ left: "18%", transform: "translateX(-50%)" }}>
              <div className="w-16 h-16 rounded-full bg-navy-800 text-paper flex items-center justify-center font-mono text-sm font-semibold shadow-md">
                R65
              </div>
              <span className="text-[10px] text-navy-400 mt-1 font-semibold uppercase">Rider offer</span>
            </div>
            <div className="absolute bottom-0 flex flex-col-reverse items-center" style={{ left: "52%", transform: "translateX(-50%)" }}>
              <span className="text-[10px] text-navy-400 mb-1 font-semibold uppercase">Driver counter</span>
              <div className="w-16 h-16 rounded-full bg-gold-400 text-navy-900 flex items-center justify-center font-mono text-sm font-semibold shadow-md">
                R78
              </div>
            </div>
          </div>
          <p className="text-sm text-navy-400">
            Both sides see the same offer thread in real time — no hidden algorithm decides the price for you.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-navy-800 text-paper py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-12 max-w-lg">Built to fix what riders and drivers complain about most</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Feature
              icon={Wallet}
              title="Transparent commission"
              body="Every driver sees the exact commission on every ride before they accept — no surprise deductions."
            />
            <Feature
              icon={ShieldCheck}
              title="Verified both ways"
              body="Riders and drivers are both ID-verified, with SOS and live trip sharing built in."
            />
            <Feature
              icon={Users}
              title="Driver subscriptions"
              body="Drivers can choose a flat periodic subscription instead of per-ride commission — set per driver, adjustable by admins anytime."
            />
            <Feature
              icon={MapPinned}
              title="Fair-range guidance"
              body="Riders get a data-informed fair price range before they make an offer, so negotiation starts sensibly."
            />
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-navy-400">
        <Logo />
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-navy-600">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-navy-600">Terms of Service</Link>
        </div>
        <p>&copy; {new Date().getFullYear()} Vuma. Built for Southern Africa, ready anywhere.</p>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="border border-navy-600 rounded-xl2 p-6 bg-navy-700/40">
      <Icon className="w-5 h-5 text-gold-400 mb-4" />
      <h3 className="font-display font-semibold mb-2">{title}</h3>
      <p className="text-sm text-navy-300">{body}</p>
    </div>
  );
}
