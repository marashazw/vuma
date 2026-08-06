"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { StatusPill } from "@/components/ui/StatusPill";
import type { Referral, ReferralSettings, RideCredit, Profile } from "@/lib/types";
import { Loader2, Copy, Gift, Check, MessageCircle, Mail, Facebook, Twitter } from "lucide-react";
import { format } from "date-fns";

export default function ReferralsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [referrals, setReferrals] = useState<(Referral & { referred?: Profile })[]>([]);
  const [credits, setCredits] = useState<RideCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const inviteLink =
    typeof window !== "undefined" && userId ? `${window.location.origin}/signup?ref=${userId}` : "";

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
        .from("referral_settings")
        .select("*")
        .eq("country", profile?.country || "ZA")
        .single();
      setSettings(settingsData as ReferralSettings);

      const { data: referralsData } = await supabase
        .from("referrals")
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

      const { data: creditsData } = await supabase
        .from("ride_credits")
        .select("*")
        .eq("rider_id", user.id)
        .order("created_at", { ascending: false });
      setCredits((creditsData as RideCredit[]) || []);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shareMessage = "Use my invite link to sign up for Vuma and we both get rewarded.";
  const shareWhatsApp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${inviteLink}`)}`, "_blank");
  const shareEmail = () =>
    (window.location.href = `mailto:?subject=${encodeURIComponent("Join me on Vuma")}&body=${encodeURIComponent(
      `${shareMessage}\n\n${inviteLink}`
    )}`);
  const shareFacebook = () =>
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(inviteLink)}`, "_blank");
  const shareTwitter = () =>
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(inviteLink)}`,
      "_blank"
    );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const readyCount = referrals.filter((r) => r.status === "qualified" && !r.counted_toward_reward).length;
  const required = settings?.required_referrals ?? 3;
  const availableCredits = credits.filter((c) => c.status === "available");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Invite friends</h1>
        <p className="text-navy-400 text-sm mt-1">
          Refer {required} friends who complete a trip and get a free ride credit — honored by any driver.
        </p>
      </div>

      <div className="card p-5">
        <p className="label mb-2">Your invite link</p>
        <div className="flex items-center gap-2 mb-4">
          <input readOnly className="input text-xs" value={inviteLink} />
          <button className="btn-ghost !px-3" onClick={copyLink}>
            {copied ? <Check className="w-4 h-4 text-jade-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <p className="label mb-2">Share</p>
        <div className="grid grid-cols-4 gap-2">
          <button className="btn-dark !px-2 flex-col !py-3 gap-1 text-xs" onClick={shareWhatsApp}>
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </button>
          <button className="btn-ghost !px-2 flex-col !py-3 gap-1 text-xs" onClick={shareEmail}>
            <Mail className="w-4 h-4" /> Email
          </button>
          <button className="btn-ghost !px-2 flex-col !py-3 gap-1 text-xs" onClick={shareFacebook}>
            <Facebook className="w-4 h-4" /> Facebook
          </button>
          <button className="btn-ghost !px-2 flex-col !py-3 gap-1 text-xs" onClick={shareTwitter}>
            <Twitter className="w-4 h-4" /> X
          </button>
        </div>
      </div>

      <div className="card p-5">
        <p className="label mb-2">Progress toward your next credit</p>
        <div className="w-full h-2 rounded-full bg-navy-50 overflow-hidden mb-2">
          <div
            className="h-full bg-gold-400 rounded-full transition-all"
            style={{ width: `${Math.min((readyCount / required) * 100, 100)}%` }}
          />
        </div>
        <p className="text-sm text-navy-500">
          {readyCount} / {required} friends have completed their first ride
        </p>
      </div>

      {availableCredits.length > 0 && (
        <div className="card p-5 bg-gold-50">
          <p className="label mb-3 flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5 text-gold-600" /> Available credits
          </p>
          <ul className="space-y-2">
            {availableCredits.map((c) => (
              <li key={c.id} className="fare-figure font-semibold text-gold-700">
                {currencyFormat(c.amount, c.currency)} — apply it next time you request a ride
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="label mb-3">Your referrals ({referrals.length})</p>
        {!referrals.length && <p className="text-navy-400 text-sm">Share your link above to start inviting friends.</p>}
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
