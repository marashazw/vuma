"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { ConstitutionContent, CONSTITUTION_VERSION } from "@/components/vuma-associates/ConstitutionContent";
import { Loader2, Check, Clock, CheckCircle2 } from "lucide-react";

export default function ConstitutionPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<"rider" | "driver" | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    setRole(profile?.role === "driver" ? "driver" : "rider");

    const { data: membership } = await supabase
      .from("vuma_associates_memberships")
      .select("status")
      .eq("profile_id", user.id)
      .maybeSingle();
    setMembershipStatus(membership?.status || null);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function join() {
    if (!userId || !role) return;
    setSubmitting(true);
    const { error } = await supabase.from("vuma_associates_memberships").insert({
      profile_id: userId,
      role,
      status: "pending",
      constitution_version: CONSTITUTION_VERSION,
    });
    setSubmitting(false);
    if (!error) setMembershipStatus("pending");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="px-5 py-4 border-b border-navy-100 flex items-center justify-between max-w-3xl mx-auto">
        <Logo />
        <Link href="/" className="text-sm text-navy-400 hover:text-navy-600">
          Back to Vuma
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-bold mb-2">Vuma Private Constitution</h1>
        <p className="text-navy-400 text-sm mb-6">
          Shown to anyone joining Vuma Private during sign-up, and available here for reference at any time.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-navy-300 mb-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Checking your membership status&hellip;
          </div>
        ) : !userId ? (
          <div className="card p-5 mb-8 bg-navy-50">
            <p className="text-sm text-navy-600 mb-3">Sign up or log in to join Vuma Private.</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/login" className="btn-ghost text-center">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary text-center">
                Sign up
              </Link>
            </div>
          </div>
        ) : membershipStatus === "active" ? (
          <div className="card p-5 mb-8 bg-jade-50 border-jade-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-jade-600 shrink-0" />
            <p className="text-sm font-semibold text-jade-700">You're an active Vuma Private member.</p>
          </div>
        ) : membershipStatus === "pending" ? (
          <div className="card p-5 mb-8 bg-gold-50 border-gold-200 flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-gold-600 shrink-0" />
            <p className="text-sm font-semibold text-gold-700">
              Your membership is awaiting confirmation from Vuma — you'll be notified once it's active.
            </p>
          </div>
        ) : (
          <div className="card p-5 mb-8">
            <p className="text-sm text-navy-600 mb-3">
              Read the constitution below, then accept it to apply to join Vuma Private.
            </p>
            <button className="btn-primary w-full" disabled={submitting} onClick={join}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} I accept — join Vuma Private
            </button>
          </div>
        )}

        <ConstitutionContent />
      </div>
    </main>
  );
}
