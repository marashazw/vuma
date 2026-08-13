"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaPrivateGroup, VumaPrivateTripRequest, VumaPrivateFeeSettings, Profile } from "@/lib/types";
import { Loader2, Users, MapPin, Save } from "lucide-react";
import { format } from "date-fns";

export default function AdminVumaPrivatePage() {
  const supabase = createClient();
  const modal = useModal();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<(VumaPrivateGroup & { memberCount: number; creator?: Profile })[]>([]);
  const [requests, setRequests] = useState<(VumaPrivateTripRequest & { requester?: Profile })[]>([]);
  const [feeSettings, setFeeSettings] = useState<VumaPrivateFeeSettings>({ fee_type: "none", fee_amount: 0, currency: "USD" });
  const [savingFee, setSavingFee] = useState(false);

  async function load() {
    const { data: groupData } = await supabase.from("vuma_private_groups").select("*").order("created_at", { ascending: false });
    const creatorIds = [...new Set((groupData || []).map((g) => g.created_by))];
    const { data: creators } = await supabase.from("profiles").select("*").in("id", creatorIds.length ? creatorIds : ["-"]);

    const groupsWithCounts = await Promise.all(
      (groupData || []).map(async (g) => {
        const { count } = await supabase.from("vuma_private_group_members").select("*", { count: "exact", head: true }).eq("group_id", g.id);
        return { ...g, memberCount: count || 0, creator: (creators as Profile[] || []).find((c) => c.id === g.created_by) };
      })
    );
    setGroups(groupsWithCounts as any);

    const { data: reqData } = await supabase
      .from("vuma_private_trip_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    const requesterIds = [...new Set((reqData || []).map((r) => r.requested_by))];
    const { data: requesters } = await supabase.from("profiles").select("*").in("id", requesterIds.length ? requesterIds : ["-"]);
    setRequests((reqData || []).map((r: any) => ({ ...r, requester: (requesters as Profile[] || []).find((p) => p.id === r.requested_by) })));

    const { data: fee } = await supabase.from("vuma_private_fee_settings").select("fee_type, fee_amount, currency").eq("id", true).single();
    if (fee) setFeeSettings(fee as VumaPrivateFeeSettings);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveFeeSettings() {
    setSavingFee(true);
    const res = await fetch("/api/admin/vuma-private/fee-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeType: feeSettings.fee_type, feeAmount: feeSettings.fee_amount, currency: feeSettings.currency }),
    });
    setSavingFee(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not save: ${data.error || "Unknown error"}`);
      return;
    }
    await modal.alert("Fee settings saved.");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    open: "text-jade-600",
    locked: "text-gold-600",
    completed: "text-navy-400",
    cancelled: "text-coral-600",
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-jade-500" /> Vuma Private
        </h1>
        <p className="text-navy-400 text-sm mt-1">
          Oversight of private cost-sharing groups and trip activity. Membership approval lives in
          Commissions → Vuma Private.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <p className="label">Membership fee</p>
        <p className="text-xs text-navy-400 -mt-1">
          Shown to members as a "membership fee" — never framed as commission. Charged monthly or per trip.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <select
            className="input"
            value={feeSettings.fee_type}
            onChange={(e) => setFeeSettings((f) => ({ ...f, fee_type: e.target.value as any }))}
          >
            <option value="none">No fee</option>
            <option value="monthly">Monthly</option>
            <option value="per_trip">Per trip</option>
          </select>
          <input
            type="number"
            min={0}
            step="0.01"
            className="input"
            placeholder="Amount"
            value={feeSettings.fee_amount}
            onChange={(e) => setFeeSettings((f) => ({ ...f, fee_amount: Number(e.target.value) }))}
            disabled={feeSettings.fee_type === "none"}
          />
        </div>
        <button className="btn-primary w-full" disabled={savingFee} onClick={saveFeeSettings}>
          {savingFee ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
        </button>
      </div>

      <div>
        <p className="label mb-3">Groups ({groups.length})</p>
        {!groups.length && <p className="text-navy-400 text-sm">No groups created yet.</p>}
        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.id} className="card p-4">
              <p className="font-semibold text-sm text-navy-800">{g.name}</p>
              <p className="text-xs text-navy-400 mt-0.5">
                {g.memberCount} member{g.memberCount === 1 ? "" : "s"} · created by {g.creator?.full_name || "—"} ·{" "}
                {format(new Date(g.created_at), "d MMM yyyy")} · code {g.invite_code}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="label mb-3">Recent trip requests</p>
        {!requests.length && <p className="text-navy-400 text-sm">No trip requests yet.</p>}
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="card p-4 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-navy-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {r.destination_address}
                </p>
                <p className="text-xs text-navy-400 mt-0.5">
                  {r.requester?.full_name || "Member"} · {format(new Date(r.needed_at), "d MMM, HH:mm")} · {r.seats_needed} seat(s)
                </p>
              </div>
              <span className={`text-xs font-bold uppercase shrink-0 ${statusColor[r.status]}`}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
