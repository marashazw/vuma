"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import { Logo } from "@/components/ui/Logo";
import { ShieldAlert, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export function SuspendedScreen({
  role,
  suspendedUntil,
  reason,
}: {
  role: "rider" | "driver";
  suspendedUntil: string;
  reason?: string | null;
}) {
  const supabase = createClient();
  const modal = useModal();
  const [checking, setChecking] = useState(true);
  const [existingAppeal, setExistingAppeal] = useState<{ status: string } | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("suspension_appeals")
        .select("status")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setExistingAppeal(data);
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAppeal() {
    if (!appealReason.trim()) return;
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("suspension_appeals").insert({ profile_id: user.id, role, reason: appealReason.trim() });
    setSubmitting(false);
    if (error) {
      await modal.alert(`Could not submit appeal: ${error.message}`);
      return;
    }
    setSubmitted(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const isIndefinite = new Date(suspendedUntil).getFullYear() > new Date().getFullYear() + 5;

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-5 py-10">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>
        <div className="card p-6 text-center">
          <ShieldAlert className="w-10 h-10 text-coral-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-navy-800 mb-2">
            {isIndefinite ? "Account frozen pending review" : "Account temporarily suspended"}
          </h1>
          <p className="text-sm text-navy-500 mb-1">
            {reason ||
              (role === "rider"
                ? "This follows a second flag for a late cancellation or no-show on a scheduled ride within a 3-month period."
                : "Contact support for details on why your account was suspended.")}
          </p>
          {isIndefinite ? (
            <p className="text-sm font-semibold text-navy-700 flex items-center justify-center gap-1.5 mt-3">
              <Clock className="w-4 h-4" /> Under review — no fixed end date yet
            </p>
          ) : (
            <p className="text-sm font-semibold text-navy-700 flex items-center justify-center gap-1.5 mt-3">
              <Clock className="w-4 h-4" /> Suspended until {format(new Date(suspendedUntil), "d MMM yyyy, HH:mm")}
            </p>
          )}

          <div className="border-t border-navy-100 mt-5 pt-5 text-left">
            {checking ? (
              <div className="flex items-center justify-center gap-2 text-navy-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking appeal status&hellip;
              </div>
            ) : submitted || existingAppeal ? (
              <div className="bg-navy-50 rounded-xl p-4 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-jade-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-navy-700">
                    {(submitted ? "pending" : existingAppeal?.status) === "pending"
                      ? "Appeal submitted"
                      : existingAppeal?.status === "approved"
                      ? "Appeal approved"
                      : "Appeal reviewed"}
                  </p>
                  <p className="text-xs text-navy-400 mt-1">
                    {(submitted ? "pending" : existingAppeal?.status) === "pending"
                      ? "An admin will review this and has final discretion on the outcome."
                      : existingAppeal?.status === "approved"
                      ? "Your suspension has been lifted — try refreshing this page."
                      : "This appeal was reviewed and the suspension was upheld."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="label block">Appeal this suspension</label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Explain the circumstances — a genuine reason like illness or a flight delay is worth including here."
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                />
                <button className="btn-primary w-full" disabled={submitting || !appealReason.trim()} onClick={submitAppeal}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit appeal"}
                </button>
                <p className="text-xs text-navy-400">An admin reviews every appeal and has final discretion on the outcome.</p>
              </div>
            )}
          </div>

          <button className="text-xs text-navy-400 underline mt-5" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
