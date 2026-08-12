"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useModal } from "@/components/ui/ModalProvider";
import type { VumaAssociateMembership, RideAccessRestriction, Profile } from "@/lib/types";
import { Loader2, Users, Check, X, Power, Plus, ArrowRight, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

const emptyRestrictionForm = { scope: "all_rides" as "all_rides" | "deluxe_only", startsAt: "", endsAt: "", note: "" };

export default function AdminVumaAssociatesPage() {
  const supabase = createClient();
  const modal = useModal();

  const [memberships, setMemberships] = useState<(VumaAssociateMembership & { profile?: Profile })[]>([]);
  const [restrictions, setRestrictions] = useState<RideAccessRestriction[]>([]);
  const [requireMembership, setRequireMembership] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRestrictionForm, setShowRestrictionForm] = useState(false);
  const [restrictionForm, setRestrictionForm] = useState(emptyRestrictionForm);
  const [submittingRestriction, setSubmittingRestriction] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  async function load() {
    const { data: mems } = await supabase
      .from("vuma_associates_memberships")
      .select("*")
      .order("created_at", { ascending: false });
    const profileIds = [...new Set((mems || []).map((m) => m.profile_id))];
    const { data: profiles } = await supabase.from("profiles").select("*").in("id", profileIds.length ? profileIds : ["-"]);
    setMemberships(
      (mems || []).map((m: any) => ({ ...m, profile: (profiles as Profile[] || []).find((p) => p.id === m.profile_id) }))
    );

    const { data: restr } = await supabase
      .from("ride_access_restrictions")
      .select("*")
      .order("starts_at", { ascending: false });
    setRestrictions((restr as RideAccessRestriction[]) || []);

    const { data: settings } = await supabase
      .from("vuma_associates_settings")
      .select("require_membership_for_driver_registration")
      .eq("id", true)
      .single();
    setRequireMembership(!!settings?.require_membership_for_driver_registration);

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function approveMembership(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/vuma-associates/memberships/${id}/approve`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not approve: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  async function revokeMembership(id: string) {
    const ok = await modal.confirm("Revoke this membership? The member will lose access to member-only benefits.", {
      confirmLabel: "Revoke",
      danger: true,
    });
    if (!ok) return;
    setBusyId(id);
    const res = await fetch(`/api/admin/vuma-associates/memberships/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "revoked" }),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not revoke: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  async function toggleSetting() {
    setSavingSettings(true);
    const res = await fetch("/api/admin/vuma-associates/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireMembershipForDriverRegistration: !requireMembership }),
    });
    setSavingSettings(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not save: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  async function submitRestriction() {
    if (!restrictionForm.startsAt || !restrictionForm.endsAt) return;
    setSubmittingRestriction(true);
    const res = await fetch("/api/admin/vuma-associates/restrictions/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: restrictionForm.scope,
        startsAt: new Date(restrictionForm.startsAt).toISOString(),
        endsAt: new Date(restrictionForm.endsAt).toISOString(),
        note: restrictionForm.note || null,
      }),
    });
    setSubmittingRestriction(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not create restriction: ${data.error || "Unknown error"}`);
      return;
    }
    setRestrictionForm(emptyRestrictionForm);
    setShowRestrictionForm(false);
    await load();
  }

  async function toggleRestriction(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/admin/vuma-associates/restrictions/${id}/toggle`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      await modal.alert(`Could not update: ${data.error || "Unknown error"}`);
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  const pending = memberships.filter((m) => m.status === "pending");
  const active = memberships.filter((m) => m.status === "active");
  const now = Date.now();

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-gold-500" /> Vuma Associates
          </h1>
          <p className="text-navy-400 text-sm mt-1">
            {active.length} active member{active.length === 1 ? "" : "s"} · {pending.length} awaiting confirmation
          </p>
        </div>
        <Link href="/admin/rider-wallet-topups" className="btn-ghost !text-sm">
          Rider top-ups <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Global settings */}
      <div className="card p-5">
        <p className="label mb-3">Global settings</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 mt-0.5 shrink-0 accent-gold-400"
            checked={requireMembership}
            disabled={savingSettings}
            onChange={toggleSetting}
          />
          <span className="text-sm text-navy-600">
            <span className="font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Require Vuma Associates membership to register as a driver
            </span>
            <span className="text-xs text-navy-400 block mt-0.5">
              When on, a new driver cannot submit verification for review until they have an active membership.
            </span>
          </span>
        </label>
      </div>

      {/* Restrictions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="label">Ride-access restrictions</p>
          <button className="btn-ghost !py-1.5 !px-2.5 !text-xs" onClick={() => setShowRestrictionForm((s) => !s)}>
            {showRestrictionForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-navy-400 -mt-2 mb-3">
          During an active window, only active (paid-up) members can request or bid on rides within the chosen scope.
        </p>

        {showRestrictionForm && (
          <div className="card p-5 space-y-3 mb-3">
            <div>
              <label className="label block mb-1">Scope</label>
              <select
                className="input"
                value={restrictionForm.scope}
                onChange={(e) => setRestrictionForm((f) => ({ ...f, scope: e.target.value as "all_rides" | "deluxe_only" }))}
              >
                <option value="all_rides">All rides</option>
                <option value="deluxe_only">Vuma Deluxe only</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">Starts</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={restrictionForm.startsAt}
                  onChange={(e) => setRestrictionForm((f) => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <label className="label block mb-1">Ends</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={restrictionForm.endsAt}
                  onChange={(e) => setRestrictionForm((f) => ({ ...f, endsAt: e.target.value }))}
                />
              </div>
            </div>
            <input
              className="input"
              placeholder="Note (optional, internal only)"
              value={restrictionForm.note}
              onChange={(e) => setRestrictionForm((f) => ({ ...f, note: e.target.value }))}
            />
            <button className="btn-primary w-full" disabled={submittingRestriction} onClick={submitRestriction}>
              {submittingRestriction ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create restriction"}
            </button>
          </div>
        )}

        {!restrictions.length && <p className="text-navy-400 text-sm">No restrictions configured.</p>}
        <div className="space-y-2">
          {restrictions.map((r) => {
            const isCurrentlyLive = r.is_active && new Date(r.starts_at).getTime() <= now && new Date(r.ends_at).getTime() >= now;
            return (
              <div key={r.id} className={`card p-4 flex items-center justify-between gap-3 ${!r.is_active ? "opacity-50" : ""}`}>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-navy-800 flex items-center gap-2">
                    {r.scope === "deluxe_only" ? "Vuma Deluxe only" : "All rides"}
                    {isCurrentlyLive && (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-coral-500 text-white px-1.5 py-0.5 rounded">
                        Live now
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-navy-400 mt-0.5">
                    {format(new Date(r.starts_at), "d MMM, HH:mm")} – {format(new Date(r.ends_at), "d MMM, HH:mm")}
                  </p>
                  {r.note && <p className="text-xs text-navy-400 mt-0.5">{r.note}</p>}
                </div>
                <button
                  className={`btn-ghost !py-1.5 !px-2.5 text-xs shrink-0 ${r.is_active ? "!text-coral-600" : "!text-jade-600"}`}
                  disabled={busyId === r.id}
                  onClick={() => toggleRestriction(r.id)}
                >
                  <Power className="w-3.5 h-3.5" /> {r.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending memberships */}
      <div>
        <p className="label mb-3">Awaiting confirmation ({pending.length})</p>
        {!pending.length && <p className="text-navy-400 text-sm">Nothing waiting on review.</p>}
        <div className="space-y-2">
          {pending.map((m) => (
            <div key={m.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-navy-800">{m.profile?.full_name || "Member"}</p>
                <p className="text-xs text-navy-400">
                  {m.role === "rider" ? "Rider" : "Driver"} · accepted constitution v{m.constitution_version} ·{" "}
                  {format(new Date(m.constitution_accepted_at), "d MMM yyyy")}
                </p>
              </div>
              <button className="btn-primary !py-1.5 !px-3 !text-xs shrink-0" disabled={busyId === m.id} onClick={() => approveMembership(m.id)}>
                {busyId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm paid up
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Active memberships */}
      <div>
        <p className="label mb-3">Active members ({active.length})</p>
        {!active.length && <p className="text-navy-400 text-sm">No active members yet.</p>}
        <div className="space-y-2">
          {active.map((m) => (
            <div key={m.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm text-navy-800">{m.profile?.full_name || "Member"}</p>
                <p className="text-xs text-navy-400">
                  {m.role === "rider" ? "Rider" : "Driver"} · active since{" "}
                  {m.approved_at ? format(new Date(m.approved_at), "d MMM yyyy") : "—"}
                  {m.paid_up_until && ` · paid up until ${format(new Date(m.paid_up_until), "d MMM yyyy")}`}
                </p>
              </div>
              <button
                className="btn-ghost !py-1.5 !px-2.5 !text-xs !text-coral-600 shrink-0"
                disabled={busyId === m.id}
                onClick={() => revokeMembership(m.id)}
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
