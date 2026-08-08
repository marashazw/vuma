import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/StatCard";
import { RidesChart } from "@/components/admin/RidesChart";
import { QuickTasks } from "@/components/admin/QuickTasks";
import { currencyFormat } from "@/lib/commission";
import { Car, Users, Banknote, Percent } from "lucide-react";
import { subDays, format, startOfDay } from "date-fns";

// Defensive: this page fetches everything server-side each request, and
// Quick Tasks specifically needs to reflect genuinely current pending
// items (a driver's freshly-submitted Deluxe application, etc.) — force
// dynamic rendering rather than relying on the auth cookie read alone to
// implicitly opt this route out of static caching.
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: riderCount },
    { count: driverCount },
    { data: rides },
    { data: txns },
    { count: pendingSubs },
    { count: pendingTopups },
    { data: pendingVerificationsRaw },
    { data: pendingDeluxeRaw },
    { count: activeSos },
    { count: duplicateFlags },
    { count: suspendedDrivers },
    { count: pendingAppeals },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "rider"),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "driver"),
    supabase.from("rides").select("id, status, created_at").order("created_at", { ascending: false }).limit(500),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("manual_payment_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("driver_wallet_topups").select("*", { count: "exact", head: true }).eq("status", "pending"),
    // Only counts as "needs review" once a driver has genuinely submitted
    // documents — verification_status defaults to 'pending' for every
    // brand-new signup too, so submitted_at is what distinguishes a real
    // review request from someone who just hasn't touched the page yet.
    supabase.from("driver_profiles").select("user_id").eq("verification_status", "pending").not("submitted_at", "is", null),
    supabase.from("driver_profiles").select("user_id").eq("deluxe_status", "pending"),
    supabase.from("sos_alerts").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("driver_profiles").select("*", { count: "exact", head: true }).eq("duplicate_vehicle_flag", true),
    supabase
      .from("driver_profiles")
      .select("*", { count: "exact", head: true })
      .gt("suspended_until", new Date().toISOString()),
    supabase.from("suspension_appeals").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  // Separate query + JS join rather than an embedded PostgREST select —
  // driver_profiles.user_id -> profiles.id is a non-standard FK name that
  // PostgREST doesn't always auto-detect reliably, which silently dropped
  // rows the same way in the Income Statement's driver wallet aggregation
  // earlier in this project. Cheap insurance against the same bug here.
  const pendingPersonIds = [...new Set([...(pendingVerificationsRaw || []), ...(pendingDeluxeRaw || [])].map((p) => p.user_id))];
  const { data: pendingPersonProfiles } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", pendingPersonIds.length ? pendingPersonIds : ["-"]);
  const nameById: Record<string, string> = {};
  (pendingPersonProfiles || []).forEach((p) => (nameById[p.id] = p.full_name));

  const pendingVerifications = (pendingVerificationsRaw || []).map((p) => ({
    user_id: p.user_id,
    profiles: { full_name: nameById[p.user_id] || "Unknown" },
  }));
  const pendingDeluxe = (pendingDeluxeRaw || []).map((p) => ({
    user_id: p.user_id,
    profiles: { full_name: nameById[p.user_id] || "Unknown" },
  }));

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

      <QuickTasks
        pendingSubs={pendingSubs || 0}
        pendingTopups={pendingTopups || 0}
        pendingVerifications={pendingVerifications || []}
        pendingDeluxe={pendingDeluxe || []}
        activeSos={activeSos || 0}
        duplicateFlags={duplicateFlags || 0}
        suspendedDrivers={suspendedDrivers || 0}
        pendingAppeals={pendingAppeals || 0}
      />

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
