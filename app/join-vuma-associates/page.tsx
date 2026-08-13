"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { ConstitutionContent, CONSTITUTION_VERSION } from "@/components/vuma-associates/ConstitutionContent";
import { Loader2, Users, Check, CheckCircle2, ArrowRight } from "lucide-react";

function JoinVumaAssociatesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const role = (params.get("role") as "rider" | "driver") || "rider";
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"prompt" | "constitution">("prompt");
  const [submitting, setSubmitting] = useState(false);
  // Riders never have a membership requirement to worry about — only
  // drivers can be gated by the admin-controlled setting below, so the
  // "you don't need to join" reassurance stays accurate for a rider
  // regardless of what that setting is currently configured to.
  const [membershipRequiredForRole, setMembershipRequiredForRole] = useState(false);

  useEffect(() => {
    if (role !== "driver") return;
    supabase
      .from("vuma_associates_settings")
      .select("require_membership_for_driver_registration")
      .eq("id", true)
      .single()
      .then(({ data }) => setMembershipRequiredForRole(!!data?.require_membership_for_driver_registration));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  function skip() {
    router.push(next);
  }

  async function accept() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push(next);
      return;
    }
    await supabase.from("vuma_associates_memberships").insert({
      profile_id: user.id,
      role,
      status: "pending",
      constitution_version: CONSTITUTION_VERSION,
    });
    setSubmitting(false);
    router.push(next);
  }

  if (step === "constitution") {
    return (
      <div className="min-h-screen bg-paper px-5 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <div className="card p-6">
            <h1 className="text-xl font-bold text-navy-800 mb-1">Vuma Private Constitution</h1>
            <p className="text-sm text-navy-400 mb-6">Read it through, then accept below to join.</p>
            <div className="max-h-[50vh] overflow-y-auto border border-navy-100 rounded-lg p-4 mb-5">
              <ConstitutionContent />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-ghost" onClick={skip} disabled={submitting}>
                Not now
              </button>
              <button className="btn-primary" onClick={accept} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} I accept
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        {/* Leads with the actual outcome of what they just did, and the
            thing they came here to do in the first place — booking a ride
            or starting to drive. Vuma Private is a secondary,
            lower-pressure mention below, not the headline of this page. */}
        <div className="card p-6 text-center mb-5">
          <CheckCircle2 className="w-10 h-10 text-jade-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-navy-800 mb-2">You're all set!</h1>
          <p className="text-sm text-navy-500 mb-5">Your Vuma account is ready to go.</p>
          <button className="btn-primary w-full flex items-center justify-center gap-1.5" onClick={skip}>
            {role === "driver" ? "Go to your dashboard" : "Book a ride"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="card p-5 text-center">
          <Users className="w-7 h-7 text-gold-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-navy-700 mb-1">Also, want to join Vuma Private?</p>
          <p className="text-xs text-navy-500 mb-4">
            A membership-based networking society for Vuma riders and drivers — helping each other with
            transportation, entrepreneurship ideas, and mentorship for success. More benefits will be added
            over time.
          </p>
          {membershipRequiredForRole ? (
            <p className="text-xs text-navy-400 mb-4">
              Note: joining is currently required to complete driver registration.
            </p>
          ) : (
            <p className="text-xs text-navy-400 mb-4">
              Entirely optional — you don't need to join to {role === "driver" ? "drive" : "ride"} with Vuma.
            </p>
          )}
          <button className="btn-ghost w-full !text-sm" onClick={() => setStep("constitution")}>
            Tell me more
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinVumaAssociatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-navy-300" /></div>}>
      <JoinVumaAssociatesContent />
    </Suspense>
  );
}
