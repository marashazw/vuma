"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { currencyFormat } from "@/lib/commission";
import { COUNTRIES } from "@/lib/constants";
import type { CountryCode, Profile } from "@/lib/types";
import { Loader2, AlertTriangle, Repeat, XCircle, Flag, Car, ShieldAlert } from "lucide-react";
import { format, subMonths, startOfMonth, subDays } from "date-fns";

interface RepeatedPairing {
  driverId: string;
  driverName: string;
  riderId: string;
  riderName: string;
  months: string[];
  totalAmount: number;
  currency: string;
}

interface CappedMonths {
  personId: string;
  personName: string;
  months: { label: string; amount: number; cap: number }[];
  currency: string;
}

interface CancelPattern {
  personId: string;
  personName: string;
  role: "rider" | "driver";
  count: number;
}

interface StrikeSummary {
  personId: string;
  personName: string;
  role: "rider" | "driver";
  count: number;
  mostRecent: string;
}

export default function AdminFraudPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [repeatedPairings, setRepeatedPairings] = useState<RepeatedPairing[]>([]);
  const [driversNearCap, setDriversNearCap] = useState<CappedMonths[]>([]);
  const [ridersNearCap, setRidersNearCap] = useState<CappedMonths[]>([]);
  const [cancelPatterns, setCancelPatterns] = useState<CancelPattern[]>([]);
  const [strikeSummaries, setStrikeSummaries] = useState<StrikeSummary[]>([]);
  const [duplicateVehicles, setDuplicateVehicles] = useState<(Profile & { user_id: string })[]>([]);

  async function nameFor(ids: string[]): Promise<Record<string, string>> {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids.length ? ids : ["-"]);
    const map: Record<string, string> = {};
    (data || []).forEach((p: any) => (map[p.id] = p.full_name || "Unknown"));
    return map;
  }

  async function load() {
    setLoading(true);
    const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();
    const threeMonthsAgo = subMonths(new Date(), 3).toISOString();

    // --- Signal 1: same driver-rider change-credit pairing repeated
    // across multiple different calendar months. A driver genuinely
    // running short on physical change now and then is normal; the same
    // pairing recurring month after month is a different pattern worth a
    // human look, not automatically flagged as wrongdoing.
    const { data: creditTxns } = await supabase
      .from("driver_credit_transactions")
      .select("driver_id, rider_id, amount, currency, created_at")
      .eq("type", "issued_change_credit")
      .gte("created_at", sixMonthsAgo);

    const pairMap: Record<string, { months: Set<string>; total: number; currency: string; driverId: string; riderId: string }> = {};
    (creditTxns || []).forEach((t: any) => {
      if (!t.rider_id) return;
      const key = `${t.driver_id}::${t.rider_id}`;
      const monthKey = format(new Date(t.created_at), "MMM yyyy");
      if (!pairMap[key]) pairMap[key] = { months: new Set(), total: 0, currency: t.currency, driverId: t.driver_id, riderId: t.rider_id };
      pairMap[key].months.add(monthKey);
      pairMap[key].total += Math.abs(Number(t.amount));
    });
    const flaggedPairs = Object.values(pairMap).filter((p) => p.months.size >= 2);
    const pairNameIds = [...new Set(flaggedPairs.flatMap((p) => [p.driverId, p.riderId]))];
    const pairNames = await nameFor(pairNameIds);
    setRepeatedPairings(
      flaggedPairs
        .map((p) => ({
          driverId: p.driverId,
          driverName: pairNames[p.driverId] || "Unknown",
          riderId: p.riderId,
          riderName: pairNames[p.riderId] || "Unknown",
          months: [...p.months].sort(),
          totalAmount: p.total,
          currency: p.currency,
        }))
        .sort((a, b) => b.months.length - a.months.length)
    );

    // --- Signal 2 & 3: drivers/riders repeatedly at or near their
    // monthly change-credit cap, two or more of the last three months.
    const { data: fareSettingsAll } = await supabase.from("fare_settings").select("*");
    const capsByCountry: Record<string, { driverCap: number; riderCap: number; currency: string }> = {};
    (fareSettingsAll || []).forEach((f: any) => {
      const cfg = COUNTRIES[f.country as CountryCode];
      capsByCountry[f.country] = {
        driverCap: f.change_credit_driver_monthly ?? cfg.changeCreditDriverMonthly,
        riderCap: f.rider_wallet_accrual_monthly ?? cfg.riderWalletAccrualMonthly,
        currency: cfg.currency,
      };
    });

    const { data: allProfiles } = await supabase.from("profiles").select("id, country");
    const countryById: Record<string, string> = {};
    (allProfiles || []).forEach((p: any) => (countryById[p.id] = p.country));

    const last3Months = [0, 1, 2].map((i) => format(startOfMonth(subMonths(new Date(), i)), "MMM yyyy"));

    const driverMonthly: Record<string, Record<string, number>> = {};
    const riderMonthly: Record<string, Record<string, number>> = {};
    (creditTxns || []).forEach((t: any) => {
      const monthKey = format(new Date(t.created_at), "MMM yyyy");
      if (!last3Months.includes(monthKey)) return;
      driverMonthly[t.driver_id] = driverMonthly[t.driver_id] || {};
      driverMonthly[t.driver_id][monthKey] = (driverMonthly[t.driver_id][monthKey] || 0) + Math.abs(Number(t.amount));
      if (t.rider_id) {
        riderMonthly[t.rider_id] = riderMonthly[t.rider_id] || {};
        riderMonthly[t.rider_id][monthKey] = (riderMonthly[t.rider_id][monthKey] || 0) + Math.abs(Number(t.amount));
      }
    });

    function buildCapped(monthly: Record<string, Record<string, number>>, capKey: "driverCap" | "riderCap") {
      const results: { personId: string; months: { label: string; amount: number; cap: number }[]; currency: string }[] = [];
      Object.entries(monthly).forEach(([personId, months]) => {
        const country = countryById[personId] || "ZA";
        const caps = capsByCountry[country] || capsByCountry["ZA"];
        if (!caps) return;
        const cap = caps[capKey];
        const nearCapMonths = Object.entries(months)
          .filter(([, amount]) => amount >= cap * 0.9)
          .map(([label, amount]) => ({ label, amount, cap }));
        if (nearCapMonths.length >= 2) {
          results.push({ personId, months: nearCapMonths, currency: caps.currency });
        }
      });
      return results;
    }

    const cappedDrivers = buildCapped(driverMonthly, "driverCap");
    const cappedRiders = buildCapped(riderMonthly, "riderCap");
    const cappedNames = await nameFor([...cappedDrivers.map((d) => d.personId), ...cappedRiders.map((d) => d.personId)]);
    setDriversNearCap(cappedDrivers.map((d) => ({ ...d, personName: cappedNames[d.personId] || "Unknown" })));
    setRidersNearCap(cappedRiders.map((d) => ({ ...d, personName: cappedNames[d.personId] || "Unknown" })));

    // --- Signal 4: repeated cancellation of an already-accepted ride —
    // driver_id being set means a driver was actually matched before the
    // cancellation happened, not just an open, never-bid-on request.
    const { data: cancelledRides } = await supabase
      .from("rides")
      .select("cancelled_by, driver_id, rider_id, created_at")
      .eq("status", "cancelled")
      .not("driver_id", "is", null)
      .not("cancelled_by", "is", null)
      .gte("created_at", thirtyDaysAgo);

    const cancelCounts: Record<string, { count: number; role: "rider" | "driver" }> = {};
    (cancelledRides || []).forEach((r: any) => {
      const role = r.cancelled_by === r.driver_id ? "driver" : r.cancelled_by === r.rider_id ? "rider" : null;
      if (!role) return;
      cancelCounts[r.cancelled_by] = cancelCounts[r.cancelled_by] || { count: 0, role };
      cancelCounts[r.cancelled_by].count += 1;
    });
    const flaggedCancellers = Object.entries(cancelCounts).filter(([, v]) => v.count >= 3);
    const cancelNames = await nameFor(flaggedCancellers.map(([id]) => id));
    setCancelPatterns(
      flaggedCancellers
        .map(([id, v]) => ({ personId: id, personName: cancelNames[id] || "Unknown", role: v.role, count: v.count }))
        .sort((a, b) => b.count - a.count)
    );

    // --- Signal 5: cancellation_strikes accumulating — shown here for
    // early visibility even below the 2-strike auto-suspension threshold.
    const { data: strikes } = await supabase
      .from("cancellation_strikes")
      .select("profile_id, role, created_at")
      .gte("created_at", threeMonthsAgo)
      .order("created_at", { ascending: false });
    const strikeCounts: Record<string, { count: number; role: "rider" | "driver"; mostRecent: string }> = {};
    (strikes || []).forEach((s: any) => {
      if (!strikeCounts[s.profile_id]) strikeCounts[s.profile_id] = { count: 0, role: s.role, mostRecent: s.created_at };
      strikeCounts[s.profile_id].count += 1;
    });
    const strikeNames = await nameFor(Object.keys(strikeCounts));
    setStrikeSummaries(
      Object.entries(strikeCounts)
        .map(([id, v]) => ({ personId: id, personName: strikeNames[id] || "Unknown", role: v.role, count: v.count, mostRecent: v.mostRecent }))
        .sort((a, b) => b.count - a.count)
    );

    // --- Signal 6: duplicate vehicle plate flags — an existing signal,
    // consolidated here for a single unified view.
    const { data: dupes } = await supabase
      .from("driver_profiles")
      .select("user_id, plate_number, submitted_at")
      .eq("duplicate_vehicle_flag", true);
    const dupeNames = await nameFor((dupes || []).map((d: any) => d.user_id));
    setDuplicateVehicles(
      (dupes || []).map((d: any) => ({ user_id: d.user_id, full_name: dupeNames[d.user_id] || "Unknown", plate_number: d.plate_number, submitted_at: d.submitted_at }) as any)
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Scanning for irregular activity&hellip;
      </div>
    );
  }

  const totalFlags =
    repeatedPairings.length + driversNearCap.length + ridersNearCap.length + cancelPatterns.length + strikeSummaries.length + duplicateVehicles.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fraud &amp; Suspicious Activity</h1>
        <p className="text-navy-400 text-sm mt-1">
          Patterns the system surfaces for your review — nothing here is automatically actioned. These are signals
          worth a look, not accusations; there's often a perfectly ordinary explanation.
        </p>
      </div>

      {totalFlags === 0 && (
        <div className="card p-6 text-center text-navy-400 text-sm">Nothing irregular surfaced right now.</div>
      )}

      {repeatedPairings.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-gold-600" /> Repeated driver–rider change-credit pairing
          </p>
          <p className="text-xs text-navy-400 mb-3">
            The same driver has credited the same rider's wallet in 2 or more different months — occasional change
            shortages are normal, a recurring pairing is a different pattern.
          </p>
          <div className="space-y-2">
            {repeatedPairings.map((p) => (
              <div key={`${p.driverId}-${p.riderId}`} className="bg-navy-50 rounded-lg px-3 py-2.5 text-sm">
                <p className="font-medium text-navy-700">
                  <a href={`/admin/drivers/${p.driverId}`} className="text-navy-700 hover:underline">{p.driverName}</a>{" "}
                  <span className="text-navy-400">→</span>{" "}
                  <a href={`/admin/riders/${p.riderId}`} className="text-navy-700 hover:underline">{p.riderName}</a>
                </p>
                <p className="text-xs text-navy-400 mt-0.5">
                  {p.months.length} months ({p.months.join(", ")}) &middot; {currencyFormat(p.totalAmount, p.currency)} total
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {driversNearCap.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-gold-600" /> Drivers repeatedly at their change-credit cap
          </p>
          <p className="text-xs text-navy-400 mb-3">At or near their monthly issuing limit in 2+ of the last 3 months.</p>
          <div className="space-y-2">
            {driversNearCap.map((d) => (
              <div key={d.personId} className="bg-navy-50 rounded-lg px-3 py-2.5 text-sm">
                <a href={`/admin/drivers/${d.personId}`} className="font-medium text-navy-700 hover:underline">{d.personName}</a>
                <p className="text-xs text-navy-400 mt-0.5">
                  {d.months.map((m) => `${m.label}: ${currencyFormat(m.amount, d.currency)}/${currencyFormat(m.cap, d.currency)}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {ridersNearCap.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-gold-600" /> Riders repeatedly at their wallet accrual cap
          </p>
          <p className="text-xs text-navy-400 mb-3">At or near their monthly accrual limit (from any driver) in 2+ of the last 3 months.</p>
          <div className="space-y-2">
            {ridersNearCap.map((d) => (
              <div key={d.personId} className="bg-navy-50 rounded-lg px-3 py-2.5 text-sm">
                <a href={`/admin/riders/${d.personId}`} className="font-medium text-navy-700 hover:underline">{d.personName}</a>
                <p className="text-xs text-navy-400 mt-0.5">
                  {d.months.map((m) => `${m.label}: ${currencyFormat(m.amount, d.currency)}/${currencyFormat(m.cap, d.currency)}`).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelPatterns.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-coral-600" /> Repeatedly cancelling after being matched
          </p>
          <p className="text-xs text-navy-400 mb-3">3 or more rides cancelled after reaching "accepted" status, in the last 30 days.</p>
          <div className="space-y-2">
            {cancelPatterns.map((c) => (
              <div key={c.personId} className="bg-navy-50 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
                <div>
                  <a href={`/admin/${c.role}s/${c.personId}`} className="font-medium text-navy-700 hover:underline">{c.personName}</a>
                  <p className="text-xs text-navy-400 capitalize">{c.role}</p>
                </div>
                <span className="fare-figure font-semibold text-coral-600">{c.count} cancellations</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {strikeSummaries.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-coral-600" /> Scheduled-ride cancellation flags
          </p>
          <p className="text-xs text-navy-400 mb-3">
            Late cancellations or no-shows on scheduled rides in the last 3 months — 2 triggers an automatic 7-day
            suspension, shown here from the first flag for earlier visibility.
          </p>
          <div className="space-y-2">
            {strikeSummaries.map((s) => (
              <div key={s.personId} className="bg-navy-50 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between">
                <div>
                  <a href={`/admin/${s.role}s/${s.personId}`} className="font-medium text-navy-700 hover:underline">{s.personName}</a>
                  <p className="text-xs text-navy-400 capitalize">
                    {s.role} &middot; most recent {format(new Date(s.mostRecent), "d MMM yyyy")}
                  </p>
                </div>
                <span className={`fare-figure font-semibold ${s.count >= 2 ? "text-coral-600" : "text-gold-600"}`}>
                  {s.count} flag{s.count > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {duplicateVehicles.length > 0 && (
        <div className="card p-5">
          <p className="label mb-1 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5 text-coral-600" /> Duplicate vehicle plate flags
          </p>
          <p className="text-xs text-navy-400 mb-3">Registered with a plate number that matches another driver already on file.</p>
          <div className="space-y-2">
            {duplicateVehicles.map((d: any) => (
              <a key={d.user_id} href={`/admin/drivers/${d.user_id}`} className="block bg-navy-50 rounded-lg px-3 py-2.5 text-sm hover:bg-navy-100">
                <p className="font-medium text-navy-700">{d.full_name}</p>
                <p className="text-xs text-navy-400">Plate: {d.plate_number || "—"}</p>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
