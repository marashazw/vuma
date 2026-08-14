"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import type { DriverProfile, Profile } from "@/lib/types";
import { Loader2, Users, ArrowUpDown, X } from "lucide-react";

type Row = DriverProfile & { profile: Profile };
type SortKey = "name" | "verification" | "rating_desc" | "rating_asc" | "commission_mode" | "subscription_plan" | "vuma_private" | "deluxe" | "online";
type FilterKey = "pending_verification" | "pending_deluxe" | null;

const MEMBERSHIP_RANK: Record<string, number> = { active: 0, pending: 1, lapsed: 2, revoked: 3, none: 4 };
const DELUXE_RANK: Record<string, number> = { certified: 0, pending: 1, expired: 2, none: 3 };

export default function AdminDriversPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-navy-300"><Loader2 className="w-5 h-5 animate-spin" /></div>}>
      <AdminDriversPageContent />
    </Suspense>
  );
}

function AdminDriversPageContent() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  // Matches exactly what the admin dashboard's Quick Tasks counted, so
  // the number someone clicked "Review" on is exactly what shows here —
  // verification_status defaults to 'pending' for every brand-new
  // signup too, so submitted_at is what actually distinguishes a real,
  // reviewable application from someone who just hasn't started yet.
  const filter = (searchParams.get("filter") as FilterKey) || null;
  const [rows, setRows] = useState<Row[]>([]);
  const [membershipStatus, setMembershipStatus] = useState<Record<string, string>>({});
  const [subscriptionPlan, setSubscriptionPlan] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    const { data: profiles } = await supabase.from("profiles").select("*").eq("role", "driver");
    const { data: driverProfiles } = await supabase.from("driver_profiles").select("*");
    const merged: Row[] = (driverProfiles || []).map((dp) => ({
      ...(dp as DriverProfile),
      profile: (profiles || []).find((p) => p.id === dp.user_id) as Profile,
    }));
    setRows(merged);

    const driverIds = merged.map((r) => r.user_id);
    if (driverIds.length) {
      const { data: memberships } = await supabase.from("vuma_associates_memberships").select("profile_id, status").in("profile_id", driverIds);
      const memberMap: Record<string, string> = {};
      (memberships || []).forEach((m) => (memberMap[m.profile_id] = m.status));
      setMembershipStatus(memberMap);

      // Same status/window logic already used for commission resolution
      // and the driver's own subscription page — the most recently
      // created row that's still within its own window, active or
      // waived (a free-granted subscription counts too).
      const { data: subs } = await supabase
        .from("driver_subscriptions")
        .select("driver_id, status, ends_at, plan:subscription_plans(name)")
        .in("driver_id", driverIds)
        .in("status", ["active", "waived"])
        .gte("ends_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      const planMap: Record<string, string> = {};
      (subs || []).forEach((s: any) => {
        if (!planMap[s.driver_id]) planMap[s.driver_id] = s.plan?.name || "—";
      });
      setSubscriptionPlan(planMap);
    }

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

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    switch (sortBy) {
      case "verification":
        return copy.sort((a, b) => a.verification_status.localeCompare(b.verification_status));
      case "rating_desc":
        return copy.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
      case "rating_asc":
        return copy.sort((a, b) => (a.rating_avg || 0) - (b.rating_avg || 0));
      case "commission_mode":
        return copy.sort((a, b) => a.commission_mode.localeCompare(b.commission_mode));
      case "subscription_plan":
        return copy.sort((a, b) => (subscriptionPlan[a.user_id] || "").localeCompare(subscriptionPlan[b.user_id] || ""));
      case "vuma_private":
        return copy.sort((a, b) => {
          const rankA = MEMBERSHIP_RANK[membershipStatus[a.user_id] || "none"];
          const rankB = MEMBERSHIP_RANK[membershipStatus[b.user_id] || "none"];
          return rankA - rankB || (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "");
        });
      case "deluxe":
        return copy.sort((a, b) => {
          const rankA = DELUXE_RANK[a.deluxe_status || "none"] ?? DELUXE_RANK.none;
          const rankB = DELUXE_RANK[b.deluxe_status || "none"] ?? DELUXE_RANK.none;
          return rankA - rankB || (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "");
        });
      case "online":
        return copy.sort((a, b) => (a.is_online === b.is_online ? 0 : a.is_online ? -1 : 1));
      case "name":
      default:
        return copy.sort((a, b) => (a.profile?.full_name || "").localeCompare(b.profile?.full_name || ""));
    }
  }, [rows, sortBy, membershipStatus, subscriptionPlan]);

  const filteredRows = useMemo(() => {
    if (filter === "pending_verification") return sortedRows.filter((r) => r.verification_status === "pending" && !!r.submitted_at);
    if (filter === "pending_deluxe") return sortedRows.filter((r) => r.deluxe_status === "pending");
    return sortedRows;
  }, [sortedRows, filter]);

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function bulkVerification(status: "verified" | "rejected") {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/admin/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_status: status }),
      });
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    await load();
  }

  async function bulkDeluxe(action: "certify" | "reject") {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    for (const id of ids) {
      await fetch(`/api/admin/drivers/${id}/deluxe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
    }
    setBulkBusy(false);
    setSelectedIds(new Set());
    await load();
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

      {filter && (
        <div className="card p-4 bg-gold-50 border-gold-200 flex items-center justify-between gap-3">
          <p className="text-sm text-gold-700 font-semibold">
            Showing only: {filter === "pending_verification" ? "verification applications awaiting review" : "Vuma Deluxe applications awaiting review"} ({filteredRows.length})
          </p>
          <Link href="/admin/drivers" className="text-xs text-navy-500 flex items-center gap-1 shrink-0">
            <X className="w-3.5 h-3.5" /> Clear filter
          </Link>
        </div>
      )}

      {filter && filteredRows.length > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredRows.length}
          allSelected={selectedIds.size === filteredRows.length}
          onToggleSelectAll={() =>
            setSelectedIds(selectedIds.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.user_id)))
          }
          actions={
            filter === "pending_verification"
              ? [
                  { label: "Approve", onClick: () => bulkVerification("verified"), busy: bulkBusy },
                  { label: "Reject", onClick: () => bulkVerification("rejected"), danger: true, busy: bulkBusy },
                ]
              : [
                  { label: "Certify", onClick: () => bulkDeluxe("certify"), busy: bulkBusy },
                  { label: "Reject", onClick: () => bulkDeluxe("reject"), danger: true, busy: bulkBusy },
                ]
          }
        />
      )}

      <label className="flex items-center gap-2 text-xs text-navy-500">
        <ArrowUpDown className="w-3.5 h-3.5 shrink-0" /> Sort by
        <select className="input !py-1.5 !text-xs !w-auto" value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
          <option value="name">Name (A–Z)</option>
          <option value="verification">Verification status</option>
          <option value="rating_desc">Rating (highest first)</option>
          <option value="rating_asc">Rating (lowest first)</option>
          <option value="commission_mode">Commission mode</option>
          <option value="subscription_plan">Subscription plan</option>
          <option value="vuma_private">Vuma Private membership</option>
          <option value="deluxe">Vuma Deluxe status</option>
          <option value="online">Online first</option>
        </select>
      </label>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-400 border-b border-navy-100">
              {filter && <th className="p-4 font-medium"></th>}
              <th className="p-4 font-medium">Driver</th>
              <th className="p-4 font-medium">Verification</th>
              <th className="p-4 font-medium">Online</th>
              <th className="p-4 font-medium">Commission mode</th>
              <th className="p-4 font-medium">Subscription</th>
              <th className="p-4 font-medium">Override %</th>
              <th className="p-4 font-medium">Rating</th>
              <th className="p-4 font-medium">Badges</th>
              <th className="p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => (
              <tr key={r.user_id} className="border-b border-navy-50 last:border-0">
                {filter && (
                  <td className="p-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-gold-400"
                      checked={selectedIds.has(r.user_id)}
                      onChange={() => toggleOne(r.user_id)}
                    />
                  </td>
                )}
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
                <td className="p-4 text-xs text-navy-500">{subscriptionPlan[r.user_id] || "—"}</td>
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
                    {membershipStatus[r.user_id] === "active" && (
                      <span className="pill bg-jade-50 text-jade-700 !text-[10px] font-semibold flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> Vuma Private
                      </span>
                    )}
                    {membershipStatus[r.user_id] === "pending" && (
                      <span className="pill bg-gold-50 text-gold-600 !text-[10px] font-semibold flex items-center gap-1">
                        <Users className="w-2.5 h-2.5" /> Vuma Private pending
                      </span>
                    )}
                    {r.deluxe_status === "certified" && (
                      <span className="pill bg-navy-800 text-gold-400 !text-[10px]">Deluxe</span>
                    )}
                    {r.deluxe_status === "pending" && (
                      <span className="pill bg-gold-100 text-gold-700 !text-[10px] font-semibold">Deluxe application pending</span>
                    )}
                    {r.deluxe_status === "expired" && (
                      <span className="pill bg-coral-500/10 text-coral-600 !text-[10px] font-semibold">Deluxe expired</span>
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
