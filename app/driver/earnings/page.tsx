import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { CreditBalanceCard } from "@/components/driver/CreditBalanceCard";
import { currencyFormat } from "@/lib/commission";
import { Wallet, TrendingUp, Percent, ShieldCheck, Gift, Zap } from "lucide-react";
import { format } from "date-fns";

const BADGE_LABELS: Record<string, string> = {
  referral_hero: "Referral Hero",
  sos_responder: "SOS Responder",
};

export default async function DriverEarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: driverProfile } = await supabase.from("driver_profiles").select("*").eq("user_id", user?.id).single();

  const { data: txns } = await supabase
    .from("transactions")
    .select("*")
    .eq("driver_id", user?.id)
    .eq("type", "ride_commission")
    .order("created_at", { ascending: false })
    .limit(20);

  const currency = txns?.[0]?.currency || "ZAR";
  const totalRides = txns?.length || 0;
  const avgCommissionPct = totalRides
    ? (txns!.reduce((s, t) => s + Number(t.commission_pct || 0), 0) / totalRides).toFixed(1)
    : "0";

  const badges: string[] = Array.isArray(driverProfile?.badges) ? driverProfile.badges : [];
  const isPriority = driverProfile?.priority_until && new Date(driverProfile.priority_until) > new Date();
  const freeRideCredits = driverProfile?.free_ride_credits || 0;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Earnings</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total earned"
          value={currencyFormat(driverProfile?.total_earnings || 0, currency)}
          icon={Wallet}
          accent="jade"
        />
        <StatCard label="Completed rides" value={String(totalRides)} icon={TrendingUp} accent="gold" />
        <StatCard label="Avg. commission" value={`${avgCommissionPct}%`} icon={Percent} />
        <StatCard
          label="Rating"
          value={`${driverProfile?.rating_avg?.toFixed?.(1) ?? "5.0"} ★`}
          sub={`${driverProfile?.rating_count || 0} ratings`}
        />
      </div>

      {(isPriority || freeRideCredits > 0 || badges.length > 0) && (
        <div className="card p-5 space-y-3">
          <p className="label">Rewards</p>

          {isPriority && (
            <div className="flex items-center gap-2 text-sm text-gold-600">
              <Zap className="w-4 h-4" />
              Priority ranking active until {format(new Date(driverProfile!.priority_until!), "d MMM yyyy, HH:mm")}
            </div>
          )}

          {freeRideCredits > 0 && (
            <div className="flex items-center gap-2 text-sm text-jade-600">
              <Gift className="w-4 h-4" />
              {freeRideCredits} commission-free ride{freeRideCredits > 1 ? "s" : ""} banked
            </div>
          )}

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {badges.map((b) => (
                <span key={b} className="pill bg-navy-800 text-gold-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> {BADGE_LABELS[b] || b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <CreditBalanceCard />

      <div className="card p-5">
        <p className="label mb-4">Recent trips</p>
        {!txns?.length && <p className="text-navy-400 text-sm">No completed trips yet.</p>}
        <ul className="space-y-3">
          {txns?.map((t) => (
            <li key={t.id} className="flex items-center justify-between text-sm border-b border-navy-50 last:border-0 pb-3 last:pb-0">
              <div>
                <p className="text-navy-500">{format(new Date(t.created_at), "d MMM, HH:mm")}</p>
                <p className="text-xs text-navy-400">Commission {t.commission_pct}%</p>
              </div>
              <div className="text-right">
                <p className="fare-figure font-semibold">{currencyFormat(Number(t.amount), t.currency)}</p>
                <p className="fare-figure text-xs text-jade-600">
                  +{currencyFormat(Number(t.amount) - Number(t.commission_amount), t.currency)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
