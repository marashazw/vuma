"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { ConstitutionContent, CONSTITUTION_VERSION } from "@/components/vuma-associates/ConstitutionContent";
import { Loader2, Users, Check } from "lucide-react";

function JoinVumaAssociatesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const role = (params.get("role") as "rider" | "driver") || "rider";
  const next = params.get("next") || "/";

  const [step, setStep] = useState<"prompt" | "constitution">("prompt");
  const [submitting, setSubmitting] = useState(false);

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
            <h1 className="text-xl font-bold text-navy-800 mb-1">Vuma Associates Constitution</h1>
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
        <div className="card p-6 text-center">
          <Users className="w-10 h-10 text-gold-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-navy-800 mb-2">Join Vuma Associates?</h1>
          <p className="text-sm text-navy-500 mb-5">
            A membership-based networking society for Vuma riders and drivers — helping each other with
            transportation, entrepreneurship ideas, and mentorship for success. More benefits will be added
            over time.
          </p>
          <button className="btn-primary w-full mb-2" onClick={() => setStep("constitution")}>
            Yes, tell me more
          </button>
          <button className="text-sm text-navy-400 underline" onClick={skip}>
            Not now
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
