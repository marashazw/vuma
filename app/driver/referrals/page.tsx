"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DriverReferral, DriverReferralSettings, Profile } from "@/lib/types";
import { Loader2, Copy, Check, MessageCircle, Info } from "lucide-react";
import { format } from "date-fns";

export default function DriverReferralsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<DriverReferralSettings | null>(null);
  const [referrals, setReferrals] = useState<(DriverReferral & { referred?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const inviteLink = typeof window !== "undefined" && userId ? `${window.location.origin}/signup?driverRef=${userId}` : "";

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        router.push("/login");
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase.from("profiles").select("country").eq("id", user.id).single();

      const { data: settingsData } = await supabase
        .from("driver_referral_settings")
        .select("*")
        .eq("country", profile?.country || "ZA")
        .single();
      setSettings(settingsData as DriverReferralSettings);

      const { data: referralsData } = await supabase
        .from("driver_referrals")
        .select("*")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });

      const referredIds = (referralsData || []).map((r) => r.referred_id);
      const { data: referredProfiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", referredIds.length ? referredIds : ["-"]);

      setReferrals(
        (referralsData || []).map((r: any) => ({
          ...r,
          referred: (referredProfiles || []).find((p) => p.id === r.referred_id),
        }))
      );

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const message = `Drive with Vuma — use my invite link to sign up. ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const readyCount = referrals.filter((r) => r.status === "qualified" && !r.counted_toward_reward).length;
  const required = settings?.required_referrals ?? 3;
  const flaggedCount = referrals.filter((r) => r.status === "flagged").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Invite drivers</h1>
        <p className="text-navy-400 text-sm mt-1">
          Refer {required} drivers who each complete {settings?.min_rides_to_qualify ?? 2} rides and earn{" "}
          {settings ? currencyFormat(settings.credit_amount, settings.currency) : "a"} credit — redeemable toward your
          subscription or a priority boost.
        </p>
      </div>

      <div className="card p-5">
        <p className="label mb-2">Your invite link</p>
        <div className="flex items-center gap-2 mb-3">
          <input readOnly className="input text-xs" value={inviteLink} />
          <button className="btn-ghost !px-3" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 text-jade-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <button className="btn-dark w-full" onClick={shareWhatsApp}>
          <MessageCircle className="w-4 h-4" /> Share on WhatsApp
        </button>
      </div>

      <div className="card p-5">
        <p className="label mb-2">Progress toward your next reward</p>
        <div className="w-full h-2 rounded-full bg-navy-50 overflow-hidden mb-2">
          <div
            className="h-full bg-gold-400 rounded-full transition-all"
            style={{ width: `${Math.min((readyCount / required) * 100, 100)}%` }}
          />
        </div>
        <p className="text-sm text-navy-500">
          {readyCount} / {required} referred drivers have completed {settings?.min_rides_to_qualify ?? 2}+ rides
        </p>
      </div>

      {flaggedCount > 0 && (
        <div className="card p-4 flex items-start gap-2 bg-gold-50 border-gold-200">
          <Info className="w-4 h-4 text-gold-600 shrink-0 mt-0.5" />
          <p className="text-sm text-gold-700">
            {flaggedCount} of your referrals {flaggedCount === 1 ? "is" : "are"} under review before counting toward
            your reward — this happens automatically if a referred driver's vehicle matches an existing account.
          </p>
        </div>
      )}

      <div>
        <p className="label mb-3">Your referrals ({referrals.length})</p>
        {!referrals.length && <p className="text-navy-400 text-sm">Share your link above to start inviting drivers.</p>}
        <ul className="space-y-2">
          {referrals.map((r) => (
            <li key={r.id} className="card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">{r.referred?.full_name || "Pending signup"}</p>
                <p className="text-xs text-navy-400">{format(new Date(r.created_at), "d MMM yyyy")}</p>
              </div>
              <StatusPill status={r.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
