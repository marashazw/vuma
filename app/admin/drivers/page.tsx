"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import type { DriverProfile, Profile } from "@/lib/types";
import { Loader2 } from "lucide-react";

type Row = DriverProfile & { profile: Profile };

export default function AdminDriversPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const { data: profiles } = await supabase.from("profiles").select("*").eq("role", "driver");
    const { data: driverProfiles } = await supabase.from("driver_profiles").select("*");
    const merged: Row[] = (driverProfiles || []).map((dp) => ({
      ...(dp as DriverProfile),
      profile: (profiles || []).find((p) => p.id === dp.user_id) as Profile,
    }));
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(userId: string, body: Record<string, any>) {
    setSavingId(userId);
    await fetch(`/api/admin/drivers/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
    setSavingId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading drivers&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Drivers ({rows.length})</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-400 border-b border-navy-100">
              <th className="p-4 font-medium">Driver</th>
              <th className="p-4 font-medium">Verification</th>
              <th className="p-4 font-medium">Online</th>
              <th className="p-4 font-medium">Commission mode</th>
              <th className="p-4 font-medium">Override %</th>
              <th className="p-4 font-medium">Rating</th>
              <th className="p-4 font-medium">Badges</th>
              <th className="p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.user_id} className="border-b border-navy-50 last:border-0">
                <td className="p-4">
                  <p className="font-semibold">{r.profile?.full_name}</p>
                  <p className="text-xs text-navy-400">{r.profile?.phone || r.profile?.email}</p>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <StatusPill status={r.verification_status} />
                    <select
                      className="text-xs border border-navy-100 rounded-lg px-2 py-1"
                      value={r.verification_status}
                      disabled={savingId === r.user_id}
                      onChange={(e) => update(r.user_id, { verification_status: e.target.value })}
                    >
                      <option value="pending">pending</option>
                      <option value="verified">verified</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </div>
                </td>
                <td className="p-4">
                  <StatusPill status={r.is_online ? "online" : "offline"} />
                </td>
                <td className="p-4">
                  <select
                    className="text-xs border border-navy-100 rounded-lg px-2 py-1"
                    value={r.commission_mode}
                    disabled={savingId === r.user_id}
                    onChange={(e) => update(r.user_id, { commission_mode: e.target.value })}
                  >
                    <option value="per_ride">per_ride</option>
                    <option value="subscription">subscription</option>
                  </select>
                </td>
                <td className="p-4">
                  <input
                    type="number"
                    className="w-20 text-xs border border-navy-100 rounded-lg px-2 py-1"
                    placeholder="default"
                    defaultValue={r.commission_override_pct ?? ""}
                    disabled={savingId === r.user_id}
                    onBlur={(e) =>
                      update(r.user_id, {
                        commission_override_pct: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </td>
                <td className="p-4 fare-figure">{r.rating_avg?.toFixed(1)} ★</td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1">
                    {r.deluxe_status === "certified" && (
                      <span className="pill bg-navy-800 text-gold-400 !text-[10px]">Deluxe</span>
                    )}
                    {(Array.isArray(r.badges) ? r.badges : []).map((b) => (
                      <span key={b} className="pill bg-navy-800 text-gold-400 !text-[10px]">
                        {b === "referral_hero" ? "Referral" : b === "sos_responder" ? "SOS" : b}
                      </span>
                    ))}
                    {r.priority_until && new Date(r.priority_until) > new Date() && (
                      <span className="pill bg-gold-50 text-gold-600 !text-[10px]">Priority</span>
                    )}
                    {r.duplicate_vehicle_flag && (
                      <span className="pill bg-coral-500/10 text-coral-600 !text-[10px]">Duplicate plate</span>
                    )}
                  </div>
                </td>
                <td className="p-4">
                  <Link href={`/admin/drivers/${r.user_id}`} className="btn-ghost !py-1.5 !px-3 text-xs">
                    Review
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
