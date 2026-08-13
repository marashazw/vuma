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
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <button
          className="btn-primary w-full !py-4 !text-base flex items-center justify-center gap-2"
          onClick={() => router.push("/rider")}
        >
          <Car className="w-5 h-5" /> Book a ride
        </button>

        <button
          className="mt-4 text-sm text-navy-500 hover:text-navy-700 flex items-center justify-center gap-1.5 mx-auto"
          onClick={() => router.push("/vuma-private/request")}
        >
          <Users className="w-4 h-4 text-jade-500" /> Or ask my Vuma Private group
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
