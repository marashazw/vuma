"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { Loader2, Car, Users, ArrowRight } from "lucide-react";

// Shown once per login (not on every page load — see afterAuthSuccess in
// AuthForm.tsx, which only routes here right after a rider logs in), so
// a returning rider who's also an active Vuma Private member gets a
// deliberate choice up front, rather than needing to already know Vuma
// Private exists and navigate there separately every time.
export default function RiderStartPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isVumaPrivateMember, setIsVumaPrivateMember] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: membership } = await supabase
        .from("vuma_associates_memberships")
        .select("status")
        .eq("profile_id", user.id)
        .maybeSingle();
      setIsVumaPrivateMember(membership?.status === "active");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-navy-300" />
      </div>
    );
  }

  // A non-member never actually sees a choice — nothing here duplicates
  // what /join-vuma-associates already does at sign-up, and routing a
  // non-member straight through avoids an extra, pointless tap on every
  // single login for the large majority of riders who aren't members.
  if (!isVumaPrivateMember) {
    router.push("/rider");
    return null;
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <p className="text-center text-sm text-navy-500 mb-5">What would you like to do?</p>
        <div className="space-y-3">
          <button
            className="card p-5 w-full text-left flex items-center justify-between hover:border-gold-300"
            onClick={() => router.push("/rider")}
          >
            <div>
              <p className="font-semibold text-navy-800 flex items-center gap-1.5">
                <Car className="w-4 h-4 text-gold-500" /> Book a ride
              </p>
              <p className="text-xs text-navy-400 mt-0.5">Name your fare, get matched with a nearby driver.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-navy-300 shrink-0" />
          </button>
          <button
            className="card p-5 w-full text-left flex items-center justify-between hover:border-jade-300"
            onClick={() => router.push("/vuma-private")}
          >
            <div>
              <p className="font-semibold text-navy-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-jade-500" /> Ask my Vuma Private group
              </p>
              <p className="text-xs text-navy-400 mt-0.5">Cost-share a trip with people you already know.</p>
            </div>
            <ArrowRight className="w-4 h-4 text-navy-300 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
