"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DriverWarning, DriverProfile, Profile } from "@/lib/types";
import { Loader2, AlertTriangle, ShieldOff, Check } from "lucide-react";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  rude: "Rude",
  very_late: "Very late",
  dirty: "Car dirty",
};

export default function AdminModerationPage() {
  const supabase = createClient();
  const [warnings, setWarnings] = useState<(DriverWarning & { driver?: Profile })[]>([]);
  const [suspended, setSuspended] = useState<(DriverProfile & { profile?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data: warningsData } = await supabase
      .from("driver_warnings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    const driverIds = [...new Set((warningsData || []).map((w) => w.driver_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", driverIds.length ? driverIds : ["-"]);

    setWarnings((warningsData || []).map((w: any) => ({ ...w, driver: (profiles || []).find((p) => p.id === w.driver_id) })));

    const { data: suspendedData } = await supabase
      .from("driver_profiles")
      .select("*")
      .not("suspended_until", "is", null)
      .gte("suspended_until", new Date().toISOString());

    const suspendedIds = (suspendedData || []).map((d) => d.user_id);
    const { data: suspendedProfiles } = await supabase.from("profiles").select("*").in("id", suspendedIds.length ? suspendedIds : ["-"]);

    setSuspended(
      (suspendedData || []).map((d: any) => ({ ...d, profile: (suspendedProfiles || []).find((p) => p.id === d.user_id) }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function liftSuspension(userId: string) {
    setBusyId(userId);
    await fetch(`/api/admin/drivers/${userId}/lift-suspension`, { method: "POST" });
    await load();
    setBusyId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Moderation</h1>
        <p className="text-navy-400 text-sm mt-1">
          Riders can tag a driver rating as Rude / Very late / Car dirty. 5+ of the same tag in a calendar month
          triggers a warning; a 3rd warning for the same issue automatically suspends the driver for 7 days.
        </p>
      </div>

      {suspended.length > 0 && (
        <div>
          <p className="label mb-3 flex items-center gap-1.5">
            <ShieldOff className="w-3.5 h-3.5 text-coral-500" /> Currently suspended ({suspended.length})
          </p>
          <div className="space-y-3">
            {suspended.map((d) => (
              <div key={d.user_id} className="card p-4 flex items-center justify-between bg-coral-500/5 border-coral-500/20">
                <div>
                  <p className="font-semibold text-sm">{d.profile?.full_name || "Driver"}</p>
                  <p className="text-xs text-coral-600 mt-0.5">{d.suspension_reason}</p>
                  <p className="text-xs text-navy-400 mt-0.5">
                    Until {format(new Date(d.suspended_until!), "d MMM yyyy")}
                  </p>
                </div>
                <button
                  className="btn-ghost !py-2 !px-3 text-xs"
                  disabled={busyId === d.user_id}
                  onClick={() => liftSuspension(d.user_id)}
                >
                  {busyId === d.user_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Lift early
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="label mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-gold-500" /> Warning history
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-navy-400 border-b border-navy-100">
                <th className="p-4 font-medium">Driver</th>
                <th className="p-4 font-medium">Issue</th>
                <th className="p-4 font-medium">Warning #</th>
                <th className="p-4 font-medium">Triggered by</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w) => (
                <tr key={w.id} className="border-b border-navy-50 last:border-0">
                  <td className="p-4">{w.driver?.full_name || "—"}</td>
                  <td className="p-4">{CATEGORY_LABELS[w.category] || w.category}</td>
                  <td className="p-4">
                    <StatusPill status={w.warning_number >= 3 ? "flagged" : "pending"} />
                    <span className="ml-2 text-navy-400">#{w.warning_number}</span>
                  </td>
                  <td className="p-4 text-navy-400">{w.triggered_by_count} ratings this cycle</td>
                  <td className="p-4 text-navy-400">{format(new Date(w.created_at), "d MMM yyyy")}</td>
                </tr>
              ))}
              {!warnings.length && (
                <tr>
                  <td className="p-4 text-navy-400" colSpan={5}>
                    No warnings issued yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
