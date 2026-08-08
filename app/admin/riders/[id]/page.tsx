"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FreezeControl } from "@/components/admin/FreezeControl";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { Profile, Ride, CountryCode } from "@/lib/types";
import { Loader2, ArrowLeft, Wallet, Flag, Gift, Repeat } from "lucide-react";
import { format } from "date-fns";

interface CreditReceived {
  id: string;
  driver_id: string;
  driverName?: string;
  amount: number;
  currency: string;
  created_at: string;
}

interface Strike {
  id: string;
  ride_id: string | null;
  reason: string;
  created_at: string;
}

export default function AdminRiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [creditReceived, setCreditReceived] = useState<CreditReceived[]>([]);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", id).single();
    setProfile(p as Profile);

    const { data: rideData } = await supabase
      .from("rides")
      .select("*")
      .eq("rider_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    setRides((rideData as Ride[]) || []);

    const { data: creditData } = await supabase
      .from("driver_credit_transactions")
      .select("id, driver_id, amount, currency, created_at")
      .eq("rider_id", id)
      .eq("type", "issued_change_credit")
      .order("created_at", { ascending: false })
      .limit(20);
    const driverIds = [...new Set((creditData || []).map((c) => c.driver_id))];
    const { data: driverNames } = await supabase.from("profiles").select("id, full_name").in("id", driverIds.length ? driverIds : ["-"]);
    setCreditReceived(
      (creditData || []).map((c) => ({
        ...c,
        driverName: (driverNames || []).find((d) => d.id === c.driver_id)?.full_name,
      }))
    );

    const { data: strikeData } = await supabase
      .from("cancellation_strikes")
      .select("id, ride_id, reason, created_at")
      .eq("profile_id", id)
      .eq("role", "rider")
      .order("created_at", { ascending: false });
    setStrikes(strikeData || []);

    const { data: credits } = await supabase.from("ride_credits").select("amount").eq("referrer_id", id).eq("status", "available");
    setAvailableCredits((credits || []).reduce((sum, c) => sum + Number(c.amount), 0));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const cfg = COUNTRIES[profile.country as CountryCode];
  const cancelledCount = rides.filter((r) => r.status === "cancelled").length;

  return (
    <div className="space-y-5 max-w-2xl">
      <Link href="/admin/riders" className="inline-flex items-center gap-1.5 text-sm text-navy-400 hover:text-navy-600">
        <ArrowLeft className="w-4 h-4" /> Back to riders
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.full_name}</h1>
          <p className="text-navy-400 text-sm">{profile.phone || profile.email}</p>
        </div>
        <p className="text-xs text-navy-400">Joined {format(new Date(profile.created_at), "d MMM yyyy")}</p>
      </div>

      <FreezeControl
        profileId={id}
        role="rider"
        suspendedUntil={profile.suspended_until}
        suspensionReason={profile.suspension_reason}
        onUpdate={load}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-navy-400 flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</p>
          <p className="fare-figure font-bold mt-1">{currencyFormat(profile.wallet_balance, profile.wallet_currency || cfg.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-navy-400 flex items-center gap-1"><Gift className="w-3 h-3" /> Referral credit</p>
          <p className="fare-figure font-bold mt-1">{currencyFormat(availableCredits, cfg.currency)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-navy-400 flex items-center gap-1"><Flag className="w-3 h-3" /> Strikes</p>
          <p className="fare-figure font-bold mt-1">{profile.scheduled_ride_strikes}</p>
        </div>
      </div>

      {strikes.length > 0 && (
        <div className="card p-5">
          <p className="label mb-3">Scheduled-ride cancellation flags</p>
          <div className="space-y-2">
            {strikes.map((s) => (
              <div key={s.id} className="bg-navy-50 rounded-lg px-3 py-2 text-sm">
                <p className="text-navy-600">{s.reason}</p>
                <p className="text-xs text-navy-400">{format(new Date(s.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {creditReceived.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5" /> Change credit received</p>
          <p className="text-xs text-navy-400 mb-3">From any driver, most recent first.</p>
          <div className="space-y-2">
            {creditReceived.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm bg-navy-50 rounded-lg px-3 py-2">
                <div>
                  <p className="text-navy-700">{c.driverName || "Unknown driver"}</p>
                  <p className="text-xs text-navy-400">{format(new Date(c.created_at), "d MMM yyyy")}</p>
                </div>
                <span className="fare-figure font-semibold text-jade-600">{currencyFormat(c.amount, c.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="label">Recent trips</p>
          {cancelledCount > 0 && <p className="text-xs text-coral-600">{cancelledCount} cancelled (last 20)</p>}
        </div>
        <div className="space-y-2">
          {!rides.length && <p className="text-navy-400 text-sm">No trips yet.</p>}
          {rides.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm bg-navy-50 rounded-lg px-3 py-2">
              <div>
                <p className="text-navy-700">{r.dropoff_address.split(",")[0]}</p>
                <p className="text-xs text-navy-400">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</p>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
