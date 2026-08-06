import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { RidesChart } from "@/components/admin/RidesChart";
import { currencyFormat } from "@/lib/commission";
import { Car, Users, Banknote, Percent } from "lucide-react";
import { subDays, format, startOfDay } from "date-fns";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [{ count: riderCount }, { count: driverCount }, { data: rides }, { data: txns }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "rider"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "driver"),
    supabase.from("rides").select("id, status, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
  ]);

  const completedRides = rides?.filter((r) => r.status === "completed").length || 0;
  const totalCommission =
    txns?.filter((t) => t.type === "ride_commission").reduce((s, t) => s + Number(t.commission_amount || 0), 0) || 0;
  const totalSubRevenue =
    txns?.filter((t) => t.type === "subscription_payment").reduce((s, t) => s + Number(t.amount || 0), 0) || 0;
  const currency = txns?.[0]?.currency || "ZAR";

  const days = Array.from({ length: 14 }).map((_, i) => startOfDay(subDays(new Date(), 13 - i)));
  const chartData = days.map((d) => ({
    day: format(d, "d MMM"),
    rides: rides?.filter((r) => startOfDay(new Date(r.created_at)).getTime() === d.getTime()).length || 0,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Riders" value={String(riderCount || 0)} icon={Users} />
        <StatCard label="Drivers" value={String(driverCount || 0)} icon={Car} accent="gold" />
        <StatCard label="Completed rides" value={String(completedRides)} icon={Percent} accent="jade" />
        <StatCard
          label="Commission + subscription revenue"
          value={currencyFormat(totalCommission + totalSubRevenue, currency)}
          icon={Banknote}
          accent="gold"
        />
      </div>

      <div className="card p-5">
        <p className="label mb-4">Rides — last 14 days</p>
        <RidesChart data={chartData} />
      </div>
    </div>
  );
}
